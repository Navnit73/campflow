import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase } from "../helpers/db";
import { seedTenant } from "../helpers/fixtures";
import { Guest } from "@/models/Guest";
import { Reservation } from "@/models/Reservation";
import { dedupeGuests } from "@/lib/migrations/dedupe-guests";

setupTestDatabase();

describe("guest dedupe migration (audit M7)", () => {
  it("merges duplicates, re-points references and enforces uniqueness", async () => {
    const t = await seedTenant();
    // Simulate a legacy database: drop the unique index and insert duplicates directly.
    await Guest.collection.dropIndex("organizationId_1_email_1");
    await Guest.collection.createIndex({ organizationId: 1, email: 1 });
    const base = { organizationId: t.org._id, propertyId: t.property._id, firstName: "A", lastName: "B", phone: "5550000000", rvDetails: { type: "van", lengthFt: 20 } };
    const g1 = await Guest.collection.insertOne({ ...base, email: "dup@x.com", totalStays: 2, totalSpent: 100, isVip: false, isBlacklisted: false, notes: "first", createdAt: new Date("2025-01-01") });
    const g2 = await Guest.collection.insertOne({ ...base, email: "DUP@x.com ", totalStays: 1, totalSpent: 50, isVip: true, isBlacklisted: false, notes: "second", createdAt: new Date("2025-06-01") });
    await Reservation.collection.insertOne({ organizationId: t.org._id, propertyId: t.property._id, guestId: g2.insertedId, confirmationCode: "RV-LEGACY01" });

    const dry = await dedupeGuests({ dryRun: true });
    expect(dry).toMatchObject({ duplicateGroups: 1, guestsMerged: 1, reservationsRepointed: 1, indexCreated: false });
    expect(await Guest.countDocuments()).toBe(2);

    const real = await dedupeGuests();
    expect(real.indexCreated).toBe(true);
    const guests = await Guest.find().lean();
    expect(guests).toHaveLength(1);
    expect(String(guests[0]._id)).toBe(String(g1.insertedId));
    expect(guests[0]).toMatchObject({ totalStays: 3, totalSpent: 150, isVip: true, notes: "first\nsecond", email: "dup@x.com" });
    const r = await Reservation.findOne({ confirmationCode: "RV-LEGACY01" }).lean();
    expect(String(r!.guestId)).toBe(String(g1.insertedId));

    await expect(Guest.collection.insertOne({ ...base, email: "dup@x.com" })).rejects.toMatchObject({ code: 11000 });
    // idempotent
    expect((await dedupeGuests()).duplicateGroups).toBe(0);
    void mongoose;
  });
});
