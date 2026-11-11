import { describe, it, expect } from "vitest";
import { setupTestDatabase } from "../helpers/db";
import { seedTenant, guestInput } from "../helpers/fixtures";
import { PublicBookingService } from "@/services/public-booking.service";
import { Payment } from "@/models/Payment";
import { Guest } from "@/models/Guest";
import { Site } from "@/models/Site";

setupTestDatabase();

const input = (t: any, over: Record<string, any> = {}) =>
  ({
    slug: t.property.slug,
    siteId: t.site._id.toString(),
    checkInDate: "2030-06-01",
    checkOutDate: "2030-06-03",
    adults: 2,
    children: 0,
    pets: 0,
    addOns: [],
    guest: guestInput(),
    specialRequests: "",
    paymentMethod: "credit_card",
    ...over,
  }) as any;

describe("public booking (audit C2, C3, C5, H6, H7, M3)", () => {
  it("C5: unknown slug is a 404, never another tenant's park", async () => {
    await seedTenant();
    await expect(PublicBookingService.getPropertyBySlug("does-not-exist")).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("C2: add-on price comes from the catalog, not the client", async () => {
    const t = await seedTenant({ taxRatePercent: 0 });
    const res = await PublicBookingService.createPublicBooking(
      input(t, { addOns: [{ addOnId: t.addOn._id.toString(), name: "Golf Cart", price: 0, pricingType: "per_stay", quantity: 1, taxable: false }] })
    );
    // 2 nights × $50 + golf cart $45/night × 2 nights
    expect(res.reservation!.pricing.addOnsSubtotal).toBe(90);
    expect(res.reservation!.pricing.totalAmount).toBe(190);
  });

  it("C2: add-ons without a valid catalog id are rejected", async () => {
    const t = await seedTenant();
    await expect(
      PublicBookingService.createPublicBooking(input(t, { addOns: [{ name: "Free stuff", price: 0, pricingType: "per_stay", quantity: 1 }] }))
    ).rejects.toMatchObject({ name: "ValidationError" });
  });

  it("C3: no fabricated payment; full balance is due", async () => {
    const t = await seedTenant({ taxRatePercent: 0 });
    const res = await PublicBookingService.createPublicBooking(input(t));
    expect(await Payment.countDocuments()).toBe(0);
    expect(res.reservation!.pricing.paidAmount).toBe(0);
    expect(res.reservation!.pricing.balanceDue).toBe(100);
  });

  it("H7: does not overwrite an existing guest profile, blocks blacklisted guests", async () => {
    const t = await seedTenant();
    await Guest.create({ organizationId: t.org._id, propertyId: t.property._id, firstName: "Real", lastName: "Owner", email: "camper@example.com", phone: "5550000000", notes: "VIP - prefers A1" });
    await PublicBookingService.createPublicBooking(input(t, { guest: { ...guestInput(), firstName: "Attacker" } }));
    const g = await Guest.findOne({ email: "camper@example.com" }).lean();
    expect(g!.firstName).toBe("Real");

    await Guest.updateOne({ _id: g!._id }, { $set: { isBlacklisted: true } });
    await expect(
      PublicBookingService.createPublicBooking(input(t, { checkInDate: "2030-08-01", checkOutDate: "2030-08-02" }))
    ).rejects.toMatchObject({ name: "ForbiddenError" });
  });

  it("H6/H7: responses never include internal guest/site fields", async () => {
    const t = await seedTenant();
    await Site.updateOne({ _id: t.site._id }, { $set: { notes: "INTERNAL: broken sewer cap" } });
    const res = await PublicBookingService.createPublicBooking(input(t));
    const conf = await PublicBookingService.getBookingConfirmation(res.confirmationCode, t.property.slug);
    const json = JSON.stringify(conf) + JSON.stringify(res);
    expect(json).not.toContain("INTERNAL");
    expect(json).not.toContain("isBlacklisted");
    expect(json).not.toContain("totalSpent");
    expect(json).not.toContain("organizationId");
    expect(conf.reservation!.confirmationCode).toBe(res.confirmationCode);
  });

  it("H6: confirmation lookup is scoped by slug when provided", async () => {
    const a = await seedTenant();
    const b = await seedTenant();
    const res = await PublicBookingService.createPublicBooking(input(a));
    await expect(PublicBookingService.getBookingConfirmation(res.confirmationCode, b.property.slug)).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("M3: rejects past dates, oversized rigs and pets on non-pet sites", async () => {
    const t = await seedTenant();
    await expect(PublicBookingService.createPublicBooking(input(t, { checkInDate: "2020-01-01", checkOutDate: "2020-01-03" }))).rejects.toMatchObject({ name: "ValidationError" });
    await expect(PublicBookingService.createPublicBooking(input(t, { guest: { ...guestInput(), rvLengthFt: 60 } }))).rejects.toMatchObject({ name: "ValidationError" });
    await Site.updateOne({ _id: t.site._id }, { $set: { petFriendly: false } });
    await expect(PublicBookingService.createPublicBooking(input(t, { pets: 1 }))).rejects.toMatchObject({ name: "ValidationError" });
  });

  it("search hides booked sites and returns only public fields", async () => {
    const t = await seedTenant();
    await PublicBookingService.createPublicBooking(input(t));
    const res = await PublicBookingService.searchAvailableSites({ slug: t.property.slug, checkInDate: "2030-06-02", checkOutDate: "2030-06-03", rigLengthFt: 30 } as any);
    expect(res.availableSites.map((s: any) => s.siteNumber)).toEqual(["A2"]);
    expect(JSON.stringify(res)).not.toContain("organizationId");
  });
});
