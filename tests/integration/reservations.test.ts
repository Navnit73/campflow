import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase } from "../helpers/db";
import { seedTenant, guestInput } from "../helpers/fixtures";
import { ReservationService } from "@/services/reservation.service";
import { Reservation } from "@/models/Reservation";
import { Guest } from "@/models/Guest";
import { Discount } from "@/models/Discount";

setupTestDatabase();

const base = { adults: 2, children: 0, pets: 0, addOns: [], status: "confirmed", source: "admin", specialRequests: "", notes: "" };
const book = (t: any, over: Record<string, any> = {}) =>
  ReservationService.createReservation(t.orgId, t.propertyId, {
    ...base,
    siteId: t.site._id.toString(),
    guest: guestInput(),
    checkInDate: "2030-06-01",
    checkOutDate: "2030-06-04",
    ...over,
  } as any);

describe("reservation creation", () => {
  it("prices correctly, freezes tax rate and generates an 8-char CSPRNG code", async () => {
    const t = await seedTenant({ taxRatePercent: 10 });
    const r = await book(t);
    expect(r.pricing.totalAmount).toBe(165); // 3 nights × 50 + 10% tax
    expect(r.taxRatePercent).toBe(10);
    expect(r.confirmationCode).toMatch(/^RV-[2-9A-HJ-NP-Z]{8}$/);
  });

  it("rejects an initial payment above the total", async () => {
    const t = await seedTenant();
    await expect(book(t, { initialPayment: { amount: 9999, method: "cash" } })).rejects.toMatchObject({ name: "ValidationError" });
    expect(await Reservation.countDocuments()).toBe(0);
  });

  it("rejects a site belonging to another tenant", async () => {
    const a = await seedTenant();
    const b = await seedTenant();
    await expect(book(a, { siteId: b.site._id.toString() })).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("rejects unknown or expired discount codes instead of silently ignoring them", async () => {
    const t = await seedTenant();
    await Discount.create({ organizationId: t.org._id, propertyId: t.property._id, code: "OLD", name: "old", type: "percentage", value: 10, validUntil: new Date("2020-01-01") });
    await expect(book(t, { discountCode: "NOPE" })).rejects.toMatchObject({ name: "ValidationError" });
    await expect(book(t, { discountCode: "OLD" })).rejects.toMatchObject({ name: "ValidationError" });
  });

  it("caps percentage discounts at 100%", async () => {
    const t = await seedTenant({ taxRatePercent: 0 });
    await Discount.create({ organizationId: t.org._id, propertyId: t.property._id, code: "BIG", name: "big", type: "percentage", value: 150 });
    const r = await book(t, { discountCode: "BIG" });
    expect(r.pricing.discountAmount).toBe(150);
    expect(r.pricing.totalAmount).toBe(0);
  });
});

describe("reservation update (audit H2/H3/M1/M2)", () => {
  it("H2: cannot move a reservation onto another tenant's site", async () => {
    const a = await seedTenant();
    const b = await seedTenant();
    const r = await book(a);
    await expect(
      ReservationService.updateReservation(a.orgId, a.propertyId, r._id.toString(), { siteId: b.site._id.toString() })
    ).rejects.toMatchObject({ name: "NotFoundError" });
    const after = await Reservation.findById(r._id).lean();
    expect(after!.siteId.toString()).toBe(a.site._id.toString());
  });

  it("H3: reactivating a cancelled booking re-checks availability", async () => {
    const t = await seedTenant();
    const r1 = await book(t);
    await ReservationService.cancelReservation(t.orgId, t.propertyId, r1._id.toString());
    await book(t, { guest: guestInput("other@x.com") }); // slot resold
    await expect(
      ReservationService.updateReservation(t.orgId, t.propertyId, r1._id.toString(), { status: "confirmed" })
    ).rejects.toMatchObject({ name: "ConflictError" });
  });

  it("H3: rejects invalid status transitions", async () => {
    const t = await seedTenant();
    const r = await book(t);
    await ReservationService.checkIn(t.orgId, t.propertyId, r._id.toString());
    await ReservationService.checkOut(t.orgId, t.propertyId, r._id.toString());
    await expect(
      ReservationService.updateReservation(t.orgId, t.propertyId, r._id.toString(), { status: "cancelled" })
    ).rejects.toMatchObject({ name: "ConflictError" });
  });

  it("M2: an edit keeps the booked tax rate even if the property rate changed", async () => {
    const t = await seedTenant({ taxRatePercent: 10 });
    const r = await book(t);
    await mongoose.model("Property").updateOne({ _id: t.property._id }, { $set: { taxRatePercent: 20 } });
    const u = await ReservationService.updateReservation(t.orgId, t.propertyId, r._id.toString(), { adults: 3 });
    expect(u.pricing.taxAmount).toBe(15);
  });

  it("M1: a deactivated discount stays applied on edit; empty string removes it", async () => {
    const t = await seedTenant({ taxRatePercent: 0 });
    const d = await Discount.create({ organizationId: t.org._id, propertyId: t.property._id, code: "TEN", name: "ten", type: "percentage", value: 10 });
    const r = await book(t, { discountCode: "TEN" });
    expect(r.pricing.discountAmount).toBe(15);
    await Discount.updateOne({ _id: d._id }, { $set: { isActive: false } });
    const kept = await ReservationService.updateReservation(t.orgId, t.propertyId, r._id.toString(), { checkOutDate: "2030-06-05" });
    expect(kept.pricing.discountAmount).toBe(20);
    const removed = await ReservationService.updateReservation(t.orgId, t.propertyId, r._id.toString(), { discountCode: "" });
    expect(removed.pricing.discountAmount).toBe(0);
    expect(removed.discountCode).toBeUndefined();
  });
});

describe("check-in / check-out / cancel guards (audit H3, M6)", () => {
  it("cannot check in a cancelled reservation", async () => {
    const t = await seedTenant();
    const r = await book(t);
    await ReservationService.cancelReservation(t.orgId, t.propertyId, r._id.toString(), "guest called");
    await expect(ReservationService.checkIn(t.orgId, t.propertyId, r._id.toString())).rejects.toMatchObject({ name: "ConflictError" });
  });

  it("cannot check out a reservation that never checked in; check-out is idempotent", async () => {
    const t = await seedTenant();
    const r = await book(t);
    await expect(ReservationService.checkOut(t.orgId, t.propertyId, r._id.toString())).rejects.toMatchObject({ name: "ConflictError" });
    await ReservationService.checkIn(t.orgId, t.propertyId, r._id.toString());
    const first = await ReservationService.checkOut(t.orgId, t.propertyId, r._id.toString());
    const second = await ReservationService.checkOut(t.orgId, t.propertyId, r._id.toString());
    expect(second.checkOutTimeActual!.getTime()).toBe(first.checkOutTimeActual!.getTime());
  });

  it("cannot cancel after check-out; cancel appends notes and decrements guest stays", async () => {
    const t = await seedTenant();
    const r = await book(t);
    expect((await Guest.findById(r.guestId).lean())!.totalStays).toBe(1);
    const c = await ReservationService.cancelReservation(t.orgId, t.propertyId, r._id.toString(), "weather");
    expect(c.notes).toContain("[Cancelled]: weather");
    expect((await Guest.findById(r.guestId).lean())!.totalStays).toBe(0);
    // idempotent
    await ReservationService.cancelReservation(t.orgId, t.propertyId, r._id.toString());
    expect((await Guest.findById(r.guestId).lean())!.totalStays).toBe(0);

    const r2 = await book(t, { checkInDate: "2030-07-01", checkOutDate: "2030-07-02" });
    await ReservationService.checkIn(t.orgId, t.propertyId, r2._id.toString());
    await ReservationService.checkOut(t.orgId, t.propertyId, r2._id.toString());
    await expect(ReservationService.cancelReservation(t.orgId, t.propertyId, r2._id.toString())).rejects.toMatchObject({ name: "ConflictError" });
  });

  it("is tenant-scoped", async () => {
    const a = await seedTenant();
    const b = await seedTenant();
    const r = await book(a);
    await expect(ReservationService.checkIn(b.orgId, b.propertyId, r._id.toString())).rejects.toMatchObject({ name: "NotFoundError" });
  });
});

describe("list search (audit M5)", () => {
  it("treats regex metacharacters literally", async () => {
    const t = await seedTenant();
    await book(t);
    const res = await ReservationService.listReservations(t.orgId, t.propertyId, { search: "(a+)+$", page: 1, limit: 20 } as any);
    expect(res.reservations).toHaveLength(0);
    const ok = await ReservationService.listReservations(t.orgId, t.propertyId, { search: "Casey", page: 1, limit: 20 } as any);
    expect(ok.reservations).toHaveLength(1);
  });
});

describe("standalone compensation (audit H5, no replica set)", () => {
  it("a failing initial payment leaves no reservation or payment behind", async () => {
    const t = await seedTenant();
    await expect(book(t, { initialPayment: { amount: 10, method: "bitcoin" } })).rejects.toThrow();
    expect(await Reservation.countDocuments()).toBe(0);
    expect(await mongoose.model("Payment").countDocuments()).toBe(0);
  });
});
