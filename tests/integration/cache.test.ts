import { describe, it, expect, vi, afterEach } from "vitest";
import { setupTestDatabase } from "../helpers/db";
import { seedTenant, guestInput, createSite } from "../helpers/fixtures";
import { cached, cacheStats, invalidate, CacheGeneration, propertyScope } from "@/lib/cache";
import { DashboardService } from "@/services/dashboard.service";
import { ReportService } from "@/services/report.service";
import { ReservationService } from "@/services/reservation.service";
import { PaymentService } from "@/services/payment.service";
import { PublicBookingService } from "@/services/public-booking.service";
import { AddOnService } from "@/services/addon.service";
import { rateLimit, __resetRateLimits } from "@/lib/utils/rate-limit";
import { zonedDateKey, addDaysStr } from "@/lib/utils/date";

setupTestDatabase();
afterEach(() => vi.restoreAllMocks());

const today = () => zonedDateKey(new Date(), "America/Denver");
const book = (t: any, over: Record<string, any> = {}) =>
  ReservationService.createReservation(t.orgId, t.propertyId, {
    siteId: t.site._id.toString(), guest: guestInput(), checkInDate: today(), checkOutDate: addDaysStr(today(), 2),
    adults: 2, children: 0, pets: 0, addOns: [], status: "confirmed", source: "admin", specialRequests: "", notes: "", ...over,
  } as any);

describe("cache primitives", () => {
  it("single-flight: concurrent misses run the loader once", async () => {
    let loads = 0;
    const loader = async () => {
      loads++;
      await new Promise((r) => setTimeout(r, 30));
      return { v: 1 };
    };
    const results = await Promise.all(Array.from({ length: 20 }, () => cached("t", "scope:a", "k", 10_000, loader)));
    expect(loads).toBe(1);
    expect(new Set(results).size).toBe(1);
    await cached("t", "scope:a", "k", 10_000, loader);
    expect(loads).toBe(1);
  });

  it("failures are not cached", async () => {
    let calls = 0;
    const loader = async () => {
      calls++;
      if (calls === 1) throw new Error("boom");
      return 42;
    };
    await expect(cached("t", "scope:b", "k", 10_000, loader)).rejects.toThrow("boom");
    expect(await cached("t", "scope:b", "k", 10_000, loader)).toBe(42);
  });

  it("an invalidation during a load prevents storing the stale value", async () => {
    let n = 0;
    const loader = async () => {
      n++;
      if (n === 1) await invalidate("scope:c"); // a write lands while we're loading
      return n;
    };
    expect(await cached("t", "scope:c", "k", 10_000, loader)).toBe(1);
    expect(await cached("t", "scope:c", "k", 10_000, loader)).toBe(2); // not served the stale 1
  });

  it("TTL expiry reloads", async () => {
    let n = 0;
    const now = Date.now();
    const spy = vi.spyOn(Date, "now").mockReturnValue(now);
    await cached("t", "scope:d", "k", 1_000, async () => ++n);
    spy.mockReturnValue(now + 1_500);
    expect(await cached("t", "scope:d", "k", 1_000, async () => ++n)).toBe(2);
  });

  it("cross-instance: a generation bump by another instance is seen within the memo window", async () => {
    let n = 0;
    const now = Date.now();
    const spy = vi.spyOn(Date, "now").mockReturnValue(now);
    await cached("t", "scope:e", "k", 60_000, async () => ++n);
    // Another instance invalidates (writes directly to the shared generation doc).
    await CacheGeneration.updateOne({ _id: "scope:e" }, { $inc: { v: 1 } }, { upsert: true });
    expect(await cached("t", "scope:e", "k", 60_000, async () => ++n)).toBe(1); // still within 1s memo
    spy.mockReturnValue(now + 1_100);
    expect(await cached("t", "scope:e", "k", 60_000, async () => ++n)).toBe(2);
  });
});

describe("dashboard / reports caching with invalidation", () => {
  it("serves repeat reads from cache and refreshes after each kind of write", async () => {
    const t = await seedTenant({ taxRatePercent: 0 });
    const d1 = await DashboardService.getDashboardSummary(t.orgId, t.propertyId);
    const hitsBefore = cacheStats.hits;
    await DashboardService.getDashboardSummary(t.orgId, t.propertyId);
    expect(cacheStats.hits).toBe(hitsBefore + 1);
    expect(d1.stats.todayArrivalsCount).toBe(0);

    const r = await book(t); // create → invalidates
    let d = await DashboardService.getDashboardSummary(t.orgId, t.propertyId);
    expect(d.stats.todayArrivalsCount).toBe(1);
    expect(d.stats.outstandingBalance).toBe(100);

    await PaymentService.recordPayment(t.orgId, t.propertyId, { reservationId: r._id.toString(), amount: 40, type: "payment", method: "cash", status: "completed" } as any);
    d = await DashboardService.getDashboardSummary(t.orgId, t.propertyId);
    expect(d.stats.outstandingBalance).toBe(60);
    expect(d.stats.todayRevenue).toBe(40);

    await ReservationService.checkIn(t.orgId, t.propertyId, r._id.toString());
    d = await DashboardService.getDashboardSummary(t.orgId, t.propertyId);
    expect(d.stats.currentlyOnsite).toBe(1);

    await createSite(t.org._id, t.property._id, t.siteType, "Z9"); // raw insert (no service) → not invalidated…
    d = await DashboardService.getDashboardSummary(t.orgId, t.propertyId);
    expect(d.stats.totalSites).toBe(2); // …so the cached value is served (documented: raw writes must invalidate)

    const { SiteService } = await import("@/services/site.service");
    await SiteService.createSite(t.orgId, t.propertyId, { siteNumber: "Z10", siteTypeId: t.siteType._id.toString() } as any);
    d = await DashboardService.getDashboardSummary(t.orgId, t.propertyId);
    expect(d.stats.totalSites).toBe(4);
  });

  it("reports are keyed by period and invalidated by payments", async () => {
    const t = await seedTenant({ taxRatePercent: 0 });
    const r = await book(t);
    const a = await ReportService.getFinancialReports(t.orgId, t.propertyId, 30);
    expect(a.summary.totalRevenue).toBe(0);
    await PaymentService.recordPayment(t.orgId, t.propertyId, { reservationId: r._id.toString(), amount: 25, type: "payment", method: "cash", status: "completed" } as any);
    expect((await ReportService.getFinancialReports(t.orgId, t.propertyId, 30)).summary.totalRevenue).toBe(25);
    expect((await ReportService.getFinancialReports(t.orgId, t.propertyId, 7)).periodDays).toBe(7);
  });

  it("tenants never share cache entries", async () => {
    const a = await seedTenant();
    const b = await seedTenant();
    await book(a);
    const da = await DashboardService.getDashboardSummary(a.orgId, a.propertyId);
    const db = await DashboardService.getDashboardSummary(b.orgId, b.propertyId);
    expect(da.stats.todayArrivalsCount).toBe(1);
    expect(db.stats.todayArrivalsCount).toBe(0);
  });

  it("availability is never cached: a booking is immediately visible to public search", async () => {
    const t = await seedTenant();
    const q = { slug: t.property.slug, checkInDate: addDaysStr(today(), 10), checkOutDate: addDaysStr(today(), 12), rigLengthFt: 30 } as any;
    expect((await PublicBookingService.searchAvailableSites(q)).availableSites).toHaveLength(2);
    await book(t, { checkInDate: addDaysStr(today(), 10), checkOutDate: addDaysStr(today(), 12) });
    expect((await PublicBookingService.searchAvailableSites(q)).availableSites).toHaveLength(1);
  });

  it("public add-on catalog refreshes after add-on writes", async () => {
    const t = await seedTenant();
    const q = { slug: t.property.slug, checkInDate: addDaysStr(today(), 10), checkOutDate: addDaysStr(today(), 12), rigLengthFt: 30 } as any;
    expect((await PublicBookingService.searchAvailableSites(q)).availableAddOns).toHaveLength(1);
    await AddOnService.updateAddOn(t.orgId, t.propertyId, t.addOn._id.toString(), { isActive: false });
    expect((await PublicBookingService.searchAvailableSites(q)).availableAddOns).toHaveLength(0);
    void propertyScope;
  });
});

describe("shared rate limiter", () => {
  it("is atomic under concurrency (exactly `limit` requests pass)", async () => {
    await __resetRateLimits();
    const results = await Promise.allSettled(Array.from({ length: 30 }, () => rateLimit("test:ip", 10, 60_000)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);
  });

  it("resets after the window", async () => {
    await __resetRateLimits();
    for (let i = 0; i < 3; i++) await rateLimit("test:win", 3, 50);
    await expect(rateLimit("test:win", 3, 50)).rejects.toMatchObject({ name: "TooManyRequestsError" });
    await new Promise((r) => setTimeout(r, 80));
    await expect(rateLimit("test:win", 3, 50)).resolves.toBeUndefined();
  });
});
