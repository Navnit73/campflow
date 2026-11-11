import { describe, it, expect } from "vitest";
import { setupTestDatabase } from "../helpers/db";
import { seedTenant } from "../helpers/fixtures";
import { DashboardService, ONSITE_LIST_LIMIT } from "@/services/dashboard.service";
import { Reservation } from "@/models/Reservation";

setupTestDatabase();

describe("dashboard payload bounds (load-test finding)", () => {
  it("returns an exact on-site count but at most ONSITE_LIST_LIMIT rows, soonest departure first", async () => {
    const t = await seedTenant();
    const day = 86_400_000;
    const base = Date.UTC(2030, 0, 1);
    await Reservation.collection.insertMany(
      Array.from({ length: ONSITE_LIST_LIMIT + 10 }, (_, i) => ({
        organizationId: t.org._id, propertyId: t.property._id, siteId: t.site._id, guestId: t.site._id,
        confirmationCode: `RV-ONSITE${i}`, status: "checked_in",
        checkInDate: new Date(base), checkOutDate: new Date(base + (ONSITE_LIST_LIMIT + 10 - i) * day),
        guestSnapshot: { fullName: `G${i}` }, siteSnapshot: { siteNumber: "A1" }, pricing: { totalAmount: 10, balanceDue: 0 },
      }))
    );
    const d = await DashboardService.computeDashboardSummary(t.orgId, t.propertyId);
    expect(d.stats.currentlyOnsite).toBe(ONSITE_LIST_LIMIT + 10);
    expect(d.currentlyOnsiteReservations).toHaveLength(ONSITE_LIST_LIMIT);
    const outs = d.currentlyOnsiteReservations.map((r: any) => +new Date(r.checkOutDate));
    expect([...outs].sort((a, b) => a - b)).toEqual(outs);
  });
});
