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
  it("never interprets input as a regex (no injection / ReDoS); punctuation only separates words", async () => {
    const t = await seedTenant();
    await book(t);
    const list = (search: string) => ReservationService.listReservations(t.orgId, t.propertyId, { search, page: 1, limit: 20 } as any);
    // "." is not a wildcard: "c.sey" = words "c" + "sey"; no token starts with "sey".
    expect((await list("c.sey")).reservations).toHaveLength(0);
    // A catastrophic-backtracking pattern is just the word "a" (matches site "A1") and returns fast.
    const started = Date.now();
    expect((await list("(a+)+$")).pagination.total).toBe((await list("a")).pagination.total);
    expect(Date.now() - started).toBeLessThan(1000);
    expect((await list("Casey")).reservations).toHaveLength(1);
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

describe("search pagination (capped count, code fast path)", () => {
  it("confirmation-code search uses an anchored prefix and returns the booking", async () => {
    const t = await seedTenant();
    const r = await book(t);
    const prefix = r.confirmationCode.slice(0, 6).toLowerCase().replace("-", ""); // e.g. "rv7mnd"
    const res = await ReservationService.listReservations(t.orgId, t.propertyId, { search: prefix, page: 1, limit: 20 } as any);
    expect(res.reservations.map((x: any) => x.confirmationCode)).toEqual([r.confirmationCode]);
    expect(res.pagination).toMatchObject({ total: 1, totalCapped: false });
  });

  it("caps the total for broad searches and flags it", async () => {
    const t = await seedTenant();
    const { SEARCH_COUNT_CAP } = await import("@/lib/utils/pagination");
    const docs = Array.from({ length: SEARCH_COUNT_CAP + 5 }, (_, i) => ({
      organizationId: t.org._id, propertyId: t.property._id, siteId: t.site._id, guestId: t.site._id,
      confirmationCode: `RV-BULK${i}`, guestSnapshot: { fullName: "Pat Smith", email: `p${i}@x.com`, phone: "1" },
      siteSnapshot: { siteNumber: "A1" }, checkInDate: new Date("2020-01-01"), checkOutDate: new Date("2020-01-02"), status: "checked_out",
    }));
    await Reservation.collection.insertMany(docs);
    const res = await ReservationService.listReservations(t.orgId, t.propertyId, { search: "smith", page: 1, limit: 20 } as any);
    expect(res.pagination).toMatchObject({ total: SEARCH_COUNT_CAP, totalCapped: true, totalPages: SEARCH_COUNT_CAP / 20 });
    expect(res.reservations).toHaveLength(20);
    const all = await ReservationService.listReservations(t.orgId, t.propertyId, { page: 1, limit: 20 } as any);
    expect(all.pagination).toMatchObject({ total: SEARCH_COUNT_CAP + 5, totalCapped: false }); // non-search counts stay exact
  });
});

describe("staff add-on pricing (catalog-backed)", () => {
  it("prices catalog items from the catalog, keeps manual charges, and never re-prices booked items", async () => {
    const t = await seedTenant({ taxRatePercent: 0 });
    const { AddOn } = await import("@/models/AddOn");
    const cart = t.addOn._id.toString(); // Golf Cart, $45/night
    const r = await book(t, {
      checkInDate: "2030-06-01",
      checkOutDate: "2030-06-03",
      addOns: [
        { addOnId: cart, name: "Golf Cart", price: 0, pricingType: "per_stay", quantity: 1, taxable: false }, // tampered
        { name: "Broken window fee", price: 120, pricingType: "per_stay", quantity: 1, taxable: false }, // manual charge
      ],
    });
    expect(r.addOns!.find((a: any) => a.name === "Golf Cart")).toMatchObject({ price: 45, pricingType: "per_night", subtotal: 90 });
    expect(r.addOns!.find((a: any) => a.name === "Broken window fee")).toMatchObject({ price: 120, subtotal: 120 });

    // Catalog price rises after booking; editing the folio keeps the booked price.
    await AddOn.updateOne({ _id: t.addOn._id }, { $set: { price: 60 } });
    const firewood = await AddOn.create({ organizationId: t.org._id, propertyId: t.property._id, name: "Firewood", pricingType: "per_unit", price: 8.5 });
    const updated = await ReservationService.updateReservation(t.orgId, t.propertyId, r._id.toString(), {
      addOns: [
        { addOnId: cart, name: "Golf Cart", price: 1, pricingType: "per_night", quantity: 1, taxable: true },
        { addOnId: firewood._id.toString(), name: "Firewood", price: 0, pricingType: "per_unit", quantity: 2, taxable: true },
      ],
    } as any);
    expect(updated.addOns!.find((a: any) => a.name === "Golf Cart")).toMatchObject({ price: 45 });
    expect(updated.addOns!.find((a: any) => a.name === "Firewood")).toMatchObject({ price: 8.5, subtotal: 17 });
  });

  it("rejects add-ons from another property", async () => {
    const a = await seedTenant();
    const b = await seedTenant();
    await expect(
      book(a, { addOns: [{ addOnId: b.addOn._id.toString(), name: "x", price: 0, pricingType: "per_stay", quantity: 1 }] })
    ).rejects.toMatchObject({ name: "ValidationError" });
  });
});

describe("indexed word-prefix search", () => {
  it("matches name/email/phone/code/site prefixes, multi-word AND, and not mid-word substrings", async () => {
    const t = await seedTenant();
    const r = await book(t, { guest: { ...guestInput("josé.garcía@Example.com"), firstName: "José", lastName: "García", phone: "(555) 867-5309" } });
    const list = (search: string) =>
      ReservationService.listReservations(t.orgId, t.propertyId, { search, page: 1, limit: 20 } as any).then((x) => x.reservations.length);
    expect(await list("gar")).toBe(1); // accent-insensitive prefix
    expect(await list("jose garcia")).toBe(1); // every word must match
    expect(await list("jose smith")).toBe(0);
    expect(await list("example")).toBe(1); // email domain word
    expect(await list("5309")).toBe(1); // phone last 4
    expect(await list("555867")).toBe(1); // phone digits prefix
    expect(await list("a1")).toBe(1); // site number
    expect(await list(r.confirmationCode.slice(3, 7).toLowerCase())).toBe(1); // code body prefix
    expect(await list("arcia")).toBe(0); // mid-word substring no longer matches (documented)
  });

  it("tokens follow edits made through the service", async () => {
    const t = await seedTenant();
    const r = await book(t);
    await ReservationService.updateReservation(t.orgId, t.propertyId, r._id.toString(), { guestSnapshot: { fullName: "Robin Renamed" } });
    const res = await ReservationService.listReservations(t.orgId, t.propertyId, { search: "renamed", page: 1, limit: 20 } as any);
    expect(res.reservations).toHaveLength(1);
  });

  it("legacy documents without tokens are still found (fallback), and the backfill enables the index path", async () => {
    const t = await seedTenant();
    await Reservation.collection.insertOne({
      organizationId: t.org._id, propertyId: t.property._id, siteId: t.site._id, guestId: t.site._id, confirmationCode: "RV-LEGACY99",
      guestSnapshot: { fullName: "Old Timer", email: "old@x.com", phone: "5551112222" }, siteSnapshot: { siteNumber: "A1" },
      checkInDate: new Date("2020-01-01"), checkOutDate: new Date("2020-01-02"), status: "checked_out",
    });
    const list = (search: string) =>
      ReservationService.listReservations(t.orgId, t.propertyId, { search, page: 1, limit: 20 } as any).then((x) => x.reservations.length);
    expect(await list("timer")).toBe(1); // regex fallback while a legacy doc exists
    const { backfillSearchTokens } = await import("@/lib/migrations/backfill-search-tokens");
    expect((await backfillSearchTokens()).reservations).toBe(1);
    expect(await Reservation.exists({ propertyId: t.property._id, searchTokens: null })).toBeNull();
    expect(await list("timer")).toBe(1); // now via the token index
  });
});

describe("cancellation notice (audit L3)", () => {
  it("emails the guest once per actual cancellation, with escaped content", async () => {
    const { MailService } = await import("@/services/mail.service");
    const { vi } = await import("vitest");
    const spy = vi.spyOn(MailService, "sendReservationCancelled").mockResolvedValue({ success: true } as any);
    const t = await seedTenant();
    const r = await book(t, { guest: { ...guestInput("cx@x.com"), firstName: "<b>Pat</b>" } });
    await ReservationService.cancelReservation(t.orgId, t.propertyId, r._id.toString(), "weather");
    await ReservationService.cancelReservation(t.orgId, t.propertyId, r._id.toString()); // idempotent repeat
    await new Promise((res) => setTimeout(res, 50));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatchObject({ to: "cx@x.com", confirmationCode: r.confirmationCode });
    spy.mockRestore();

    const { reservationCancelledTemplate } = await import("@/lib/mail/templates");
    const html = reservationCancelledTemplate({ guestName: "<b>Pat</b>", propertyName: "P", confirmationCode: "RV-X", siteNumber: "A1", checkInDate: "2030-01-01", checkOutDate: "2030-01-02", paidAmount: 10 });
    expect(html).not.toContain("<b>Pat</b>");
  });
});
