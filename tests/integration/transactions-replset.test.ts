import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { seedTenant, guestInput } from "../helpers/fixtures";
import { ReservationService } from "@/services/reservation.service";
import { Reservation } from "@/models/Reservation";
import { Payment } from "@/models/Payment";
import { Guest } from "@/models/Guest";
import { transactionsSupported } from "@/lib/db/transaction";

// Runs against a real replica set so the multi-document transaction path is exercised
// (the rest of the suite uses a standalone server and the compensation path).
let rs: MongoMemoryReplSet;

beforeAll(async () => {
  rs = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  process.env.MONGODB_URI = rs.getUri();
  (global as any).mongooseCache = { conn: null, promise: null };
  const { connectDB } = await import("@/lib/db/connection");
  await connectDB();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
});
afterEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});
afterAll(async () => {
  await mongoose.disconnect();
  await rs?.stop();
});

const base = { adults: 2, children: 0, pets: 0, addOns: [], status: "confirmed", source: "admin", specialRequests: "", notes: "" };

describe("transactional booking on a replica set (audit H5)", () => {
  it("detects transaction support", async () => {
    expect(await transactionsSupported()).toBe(true);
  });

  it("a failing payment write rolls back the reservation and counters", async () => {
    const t = await seedTenant();
    await expect(
      ReservationService.createReservation(t.orgId, t.propertyId, {
        ...base,
        siteId: t.site._id.toString(),
        guest: guestInput(),
        checkInDate: "2030-06-01",
        checkOutDate: "2030-06-03",
        initialPayment: { amount: 10, method: "bitcoin" }, // invalid enum → Payment validation fails
      } as any)
    ).rejects.toThrow();
    expect(await Reservation.countDocuments()).toBe(0);
    expect(await Payment.countDocuments()).toBe(0);
    const g = await Guest.findOne({ email: "camper@example.com" }).lean();
    expect(g?.totalStays ?? 0).toBe(0);
    expect(g?.totalSpent ?? 0).toBe(0);
  });

  it("commits reservation, payment and counters together", async () => {
    const t = await seedTenant({ taxRatePercent: 0 });
    const r = await ReservationService.createReservation(t.orgId, t.propertyId, {
      ...base,
      siteId: t.site._id.toString(),
      guest: guestInput(),
      checkInDate: "2030-06-01",
      checkOutDate: "2030-06-03",
      initialPayment: { amount: 40, method: "cash" },
    } as any);
    expect(await Payment.countDocuments({ reservationId: r._id })).toBe(1);
    const g = await Guest.findById(r.guestId).lean();
    expect(g!.totalStays).toBe(1);
    expect(g!.totalSpent).toBe(40);
  });

  it("still prevents double booking under concurrency with transactions", async () => {
    const t = await seedTenant();
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        ReservationService.createReservation(t.orgId, t.propertyId, {
          ...base,
          siteId: t.site._id.toString(),
          guest: guestInput(`c${i}@x.com`),
          checkInDate: "2030-07-01",
          checkOutDate: "2030-07-04",
        } as any)
      )
    );
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    expect(await Reservation.countDocuments({ siteId: t.site._id })).toBe(1);
  });
});
