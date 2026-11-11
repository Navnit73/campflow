import { describe, it, expect } from "vitest";
import { setupTestDatabase } from "../helpers/db";
import { seedTenant, guestInput } from "../helpers/fixtures";
import { ReservationService } from "@/services/reservation.service";
import { PublicBookingService } from "@/services/public-booking.service";
import { Reservation } from "@/models/Reservation";

setupTestDatabase();

const ATTEMPTS = 15;

describe("double-booking protection under concurrency", () => {
  it("admin: only one of N concurrent bookings for the same site/nights succeeds", async () => {
    const t = await seedTenant();
    const results = await Promise.allSettled(
      Array.from({ length: ATTEMPTS }, (_, i) =>
        ReservationService.createReservation(t.orgId, t.propertyId, {
          siteId: t.site._id.toString(),
          guest: guestInput(`g${i}@example.com`),
          checkInDate: "2030-06-01",
          checkOutDate: "2030-06-04",
          adults: 2, children: 0, pets: 0, addOns: [],
          status: "confirmed", source: "admin", specialRequests: "", notes: "",
        } as any)
      )
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(1);
    expect(await Reservation.countDocuments({ siteId: t.site._id })).toBe(1);
  });

  it("public: only one of N concurrent online bookings succeeds", async () => {
    const t = await seedTenant();
    const results = await Promise.allSettled(
      Array.from({ length: ATTEMPTS }, (_, i) =>
        PublicBookingService.createPublicBooking({
          slug: t.property.slug,
          siteId: t.site._id.toString(),
          checkInDate: "2030-07-01",
          checkOutDate: "2030-07-03",
          adults: 2, children: 0, pets: 0, addOns: [],
          guest: guestInput(`p${i}@example.com`),
          specialRequests: "", paymentMethod: "credit_card",
        } as any)
      )
    );
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    expect(await Reservation.countDocuments({ siteId: t.site._id })).toBe(1);
  });

  it("drag-and-drop: two reservations moved onto the same free slot concurrently — only one wins", async () => {
    const t = await seedTenant();
    const base = { adults: 2, children: 0, pets: 0, addOns: [], status: "confirmed", source: "admin", specialRequests: "", notes: "" };
    const r1 = await ReservationService.createReservation(t.orgId, t.propertyId, { ...base, siteId: t.site._id.toString(), guest: guestInput("a@x.com"), checkInDate: "2030-08-01", checkOutDate: "2030-08-03" } as any);
    const r2 = await ReservationService.createReservation(t.orgId, t.propertyId, { ...base, siteId: t.site._id.toString(), guest: guestInput("b@x.com"), checkInDate: "2030-08-10", checkOutDate: "2030-08-12" } as any);
    const results = await Promise.allSettled(
      [r1, r2].map((r) =>
        ReservationService.updateReservation(t.orgId, t.propertyId, r._id.toString(), {
          siteId: t.site2._id.toString(), checkInDate: "2030-09-01", checkOutDate: "2030-09-05",
        })
      )
    );
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    expect(await Reservation.countDocuments({ siteId: t.site2._id })).toBe(1);
  });
});
