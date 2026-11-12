import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { setupTestDatabase } from "../helpers/db";
import { seedTenant, guestInput } from "../helpers/fixtures";
import { User } from "@/models/User";
import { Site } from "@/models/Site";
import { SiteType } from "@/models/SiteType";
import { signAuthToken } from "@/lib/auth/jwt";
import { invalidateUserSession } from "@/lib/auth/session";
import { __resetRateLimits } from "@/lib/utils/rate-limit";
import * as propertyRoute from "@/app/api/property/route";
import { ReservationService } from "@/services/reservation.service";
import { PublicBookingService } from "@/services/public-booking.service";
import { AuthService } from "@/services/auth.service";

setupTestDatabase();
beforeEach(async () => { await __resetRateLimits(); });

async function tokenFor(t: any, role: "owner" | "staff") {
  const u = await User.create({ organizationId: t.org._id, name: role, email: `${role}${Math.random()}@x.com`, passwordHash: "x", role });
  invalidateUserSession(u._id.toString());
  return signAuthToken({ userId: u._id.toString(), organizationId: t.orgId, propertyId: t.propertyId, email: u.email, role, name: role });
}
const req = (method: string, token: string, body?: unknown) =>
  new NextRequest("http://localhost/api/property", {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("property settings API (Settings page used to save nothing)", () => {
  it("owner saves settings; staff can read but not write; invalid input is rejected", async () => {
    const t = await seedTenant({ taxRatePercent: 10 });
    const owner = await tokenFor(t, "owner");
    const staff = await tokenFor(t, "staff");

    const patch = await propertyRoute.PATCH(req("PATCH", owner, { taxRatePercent: 12.5, checkInTime: "15:00", address: { street: "9 Lake Rd", city: "Moab" }, timezone: "America/Denver" }));
    expect(patch.status).toBe(200);
    const saved = (await (await propertyRoute.GET(req("GET", staff))).json()).data;
    expect(saved).toMatchObject({ taxRatePercent: 12.5, checkInTime: "15:00", address: { street: "9 Lake Rd", city: "Moab", zip: "80000" } });

    expect((await propertyRoute.PATCH(req("PATCH", staff, { taxRatePercent: 0 }))).status).toBe(403);
    expect((await propertyRoute.PATCH(req("PATCH", owner, { timezone: "Mars/Olympus" }))).status).toBe(422);
    expect((await propertyRoute.PATCH(req("PATCH", owner, { checkInTime: "3pm" }))).status).toBe(422);
    expect((await propertyRoute.PATCH(req("PATCH", owner, { slug: "hijack" }))).status).toBe(422); // unknown keys refused
  });

  it("a tax change applies to new bookings; existing ones keep their frozen rate; public profile refreshes", async () => {
    const t = await seedTenant({ taxRatePercent: 10 });
    const owner = await tokenFor(t, "owner");
    const base = { adults: 2, children: 0, pets: 0, addOns: [], status: "confirmed", source: "admin", specialRequests: "", notes: "" };
    const before = await ReservationService.createReservation(t.orgId, t.propertyId, { ...base, siteId: t.site._id.toString(), guest: guestInput("a@x.com"), checkInDate: "2030-06-01", checkOutDate: "2030-06-02" } as any);
    await PublicBookingService.getPropertyBySlug(t.property.slug); // warm the public cache
    await propertyRoute.PATCH(req("PATCH", owner, { taxRatePercent: 20, name: "Renamed Park" }));
    const after = await ReservationService.createReservation(t.orgId, t.propertyId, { ...base, siteId: t.site._id.toString(), guest: guestInput("b@x.com"), checkInDate: "2030-07-01", checkOutDate: "2030-07-02" } as any);
    expect(before.pricing.taxAmount).toBe(5);
    expect(after.pricing.taxAmount).toBe(10);
    const edited = await ReservationService.updateReservation(t.orgId, t.propertyId, before._id.toString(), { adults: 3 });
    expect(edited.pricing.taxAmount).toBe(5);
    expect((await PublicBookingService.getPropertyBySlug(t.property.slug)).name).toBe("Renamed Park");
  });
});

describe("registration no longer invents an address (audit L4)", () => {
  it("creates the property with an empty address", async () => {
    const r = await AuthService.register({ name: "N", email: `n${Date.now()}@x.com`, password: "longpassword1", organizationName: "Real Park", phone: "5551234567" });
    const p = await (await import("@/models/Property")).Property.findById(r.property.id).lean();
    expect(p!.address).toMatchObject({ street: "", city: "", state: "", zip: "" });
  });
});

describe("weekend rate and occupancy in booking flows (audit M3)", () => {
  it("staff and public bookings charge the weekend rate; edits keep the booked weekend rate", async () => {
    const t = await seedTenant({ taxRatePercent: 0 });
    await Site.updateMany({ propertyId: t.property._id }, { $set: { weekendBaseRate: 80 } });
    const base = { adults: 2, children: 0, pets: 0, addOns: [], status: "confirmed", source: "admin", specialRequests: "", notes: "" };
    // 2030-06-06 is a Thursday: Thu, Fri, Sat nights → 50 + 80 + 80
    const r = await ReservationService.createReservation(t.orgId, t.propertyId, { ...base, siteId: t.site._id.toString(), guest: guestInput(), checkInDate: "2030-06-06", checkOutDate: "2030-06-09" } as any);
    expect(r.pricing.baseSubtotal).toBe(210);
    await Site.updateMany({ propertyId: t.property._id }, { $set: { weekendBaseRate: 999 } });
    const edited = await ReservationService.updateReservation(t.orgId, t.propertyId, r._id.toString(), { adults: 3 });
    expect(edited.pricing.baseSubtotal).toBe(210); // frozen at booking

    const pub = await PublicBookingService.createPublicBooking({
      slug: t.property.slug, siteId: t.site2._id.toString(), checkInDate: "2030-06-06", checkOutDate: "2030-06-09",
      adults: 2, children: 0, pets: 0, addOns: [], guest: guestInput("p@x.com"), specialRequests: "", paymentMethod: "credit_card",
    } as any);
    expect(pub.reservation!.pricing.baseSubtotal).toBe(50 + 999 * 2);
  });

  it("public search hides sites that are too small for the party; booking rejects oversized parties", async () => {
    const t = await seedTenant();
    await SiteType.updateOne({ _id: t.siteType._id }, { $set: { maxOccupancy: 4 } });
    const q = { slug: t.property.slug, checkInDate: "2030-06-01", checkOutDate: "2030-06-03", rigLengthFt: 30 };
    expect((await PublicBookingService.searchAvailableSites({ ...q, adults: 2, children: 2 } as any)).availableSites).toHaveLength(2);
    expect((await PublicBookingService.searchAvailableSites({ ...q, adults: 3, children: 2 } as any)).availableSites).toHaveLength(0);
    await expect(
      PublicBookingService.createPublicBooking({ ...q, siteId: t.site._id.toString(), adults: 4, children: 1, pets: 0, addOns: [], guest: guestInput(), specialRequests: "", paymentMethod: "credit_card" } as any)
    ).rejects.toMatchObject({ name: "ValidationError" });
  });
});
