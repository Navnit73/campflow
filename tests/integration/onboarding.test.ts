import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { setupTestDatabase } from "../helpers/db";
import { seedTenant, guestInput } from "../helpers/fixtures";
import { User } from "@/models/User";
import { AddOn } from "@/models/AddOn";
import { SiteType } from "@/models/SiteType";
import { Site } from "@/models/Site";
import { signAuthToken } from "@/lib/auth/jwt";
import { invalidateUserSession } from "@/lib/auth/session";
import { __resetRateLimits } from "@/lib/utils/rate-limit";
import * as seedRoute from "@/app/api/addons/seed/route";
import * as typeTemplatesRoute from "@/app/api/sites/types/templates/route";
import * as setupRoute from "@/app/api/property/setup/route";
import * as propertyRoute from "@/app/api/property/route";
import { ADDON_TEMPLATES, SITE_CATEGORY_TEMPLATES } from "@/lib/onboarding/templates";
import { ExportService } from "@/services/export.service";
import { ReservationService } from "@/services/reservation.service";

setupTestDatabase();
beforeEach(async () => { await __resetRateLimits(); });

async function tokenFor(t: any, role: "owner" | "manager" | "staff") {
  const u = await User.create({ organizationId: t.org._id, name: role, email: `${role}${Math.random()}@x.com`, passwordHash: "x", role });
  invalidateUserSession(u._id.toString());
  return signAuthToken({ userId: u._id.toString(), organizationId: t.orgId, propertyId: t.propertyId, email: u.email, role, name: role });
}
const post = (url: string, token: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const get = (url: string, token: string) => new NextRequest(`http://localhost${url}`, { headers: { authorization: `Bearer ${token}` } });
const json = async (r: Response) => (await r.json()) as any;

describe("starter templates carry no prices", () => {
  it("template definitions contain no price or rate fields", () => {
    for (const t of [...ADDON_TEMPLATES, ...SITE_CATEGORY_TEMPLATES]) {
      expect(Object.keys(t)).not.toContain("price");
      expect(Object.keys(t)).not.toContain("defaultBaseRate");
    }
  });

  it("services: created only with owner-entered prices; unknown keys/no prices rejected; duplicates skipped; staff blocked", async () => {
    const t = await seedTenant(); // fixture already has "Golf Cart"
    const owner = await tokenFor(t, "owner");
    expect((await seedRoute.POST(post("/api/addons/seed", owner))).status).toBe(422); // no body
    expect((await seedRoute.POST(post("/api/addons/seed", owner, { items: [{ key: "firewood" }] }))).status).toBe(422); // no price
    expect((await seedRoute.POST(post("/api/addons/seed", owner, { items: [{ key: "nope", price: 1 }] }))).status).toBe(422);
    expect((await seedRoute.POST(post("/api/addons/seed", await tokenFor(t, "staff"), { items: [{ key: "firewood", price: 1 }] }))).status).toBe(403);

    const res = await seedRoute.POST(post("/api/addons/seed", owner, { items: [{ key: "firewood", price: 7.25 }, { key: "pet-fee", price: 0 }] }));
    expect(res.status).toBe(201);
    expect((await json(res)).data).toEqual({ created: 2, skipped: 0 });
    const firewood = await AddOn.findOne({ propertyId: t.property._id, name: "Firewood Bundle" }).lean();
    expect(firewood).toMatchObject({ price: 7.25, pricingType: "per_unit", taxable: true });
    expect((await AddOn.findOne({ name: "Pet Fee" }).lean())!.price).toBe(0); // $0 is a valid owner choice

    const again = await seedRoute.POST(post("/api/addons/seed", owner, { items: [{ key: "firewood", price: 99 }] }));
    expect((await json(again)).data).toEqual({ created: 0, skipped: 1 });
    expect((await AddOn.findOne({ name: "Firewood Bundle" }).lean())!.price).toBe(7.25);
  });

  it("site categories: owner sets the nightly rate; managers allowed", async () => {
    const t = await seedTenant();
    const mgr = await tokenFor(t, "manager");
    const res = await typeTemplatesRoute.POST(post("/api/sites/types/templates", mgr, { items: [{ key: "rv-50a-full-pull", price: 72 }, { key: "tent", price: 30 }] }));
    expect(res.status).toBe(201);
    const t50 = await SiteType.findOne({ propertyId: t.property._id, name: "50 Amp Full Hookup Pull-Through" }).lean();
    expect(t50).toMatchObject({ defaultBaseRate: 72, maxRigLength: 45, hookups: { electric: "50A", water: true, sewer: true } });
    expect((await typeTemplatesRoute.POST(post("/api/sites/types/templates", mgr, { items: [] }))).status).toBe(422);
  });
});

describe("owner setup checklist", () => {
  it("tracks real progress and only reports ready when guests can actually book", async () => {
    const t = await seedTenant();
    await Site.deleteMany({ propertyId: t.property._id });
    const owner = await tokenFor(t, "owner");
    const status = async () => (await json(await setupRoute.GET(get("/api/property/setup", owner)))).data;

    let s = await status();
    const step = (key: string) => s.steps.find((x: any) => x.key === key);
    expect(s.readyForBookings).toBe(false);
    expect(step("operations").done).toBe(false);
    expect(step("operations").detail).toMatch(/defaults — not yet confirmed/);
    expect(step("categories").done).toBe(true); // fixture has one site type
    expect(step("sites").done).toBe(false);

    // Fixture address has street+city; confirming settings and adding a bookable site makes it ready.
    await propertyRoute.PATCH(new NextRequest("http://localhost/api/property", { method: "PATCH", headers: { authorization: `Bearer ${owner}`, "content-type": "application/json" }, body: JSON.stringify({ checkInTime: "14:00", bookingPolicy: "Full refund 7 days out." }) }));
    s = await status();
    expect(step("operations").done).toBe(true);
    expect(step("policy").done).toBe(true);
    expect(s.readyForBookings).toBe(false);

    const { SiteService } = await import("@/services/site.service");
    await SiteService.createSite(t.orgId, t.propertyId, { siteNumber: "N1", siteTypeId: t.siteType._id.toString(), status: "maintenance" } as any);
    s = await status();
    expect(step("sites").done).toBe(false); // a site under maintenance isn't bookable
    await Site.updateOne({ siteNumber: "N1" }, { $set: { status: "available" } });
    s = await status();
    expect(s.readyForBookings).toBe(true);
    expect(s.requiredRemaining).toBe(0);
    expect(step("booking").detail).toBe(`/book/${t.property.slug}`);
  });
});

describe("regressions from the hard-coded data cleanup", () => {
  it("Excel tax audit reports 0% for a tax-free park (was a phantom 7.5%) and the real rate otherwise", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const rateFor = async (taxRatePercent: number) => {
      const t = await seedTenant({ taxRatePercent });
      await ReservationService.createReservation(t.orgId, t.propertyId, {
        siteId: t.site._id.toString(), guest: guestInput(`x${taxRatePercent}@x.com`), checkInDate: "2030-06-01", checkOutDate: "2030-06-03",
        adults: 2, children: 0, pets: 0, addOns: [], status: "confirmed", source: "admin", specialRequests: "", notes: "",
      } as any);
      const out = await ExportService.generateOnDemandExport(t.orgId, t.propertyId, undefined, { type: "excel_invoices", preset: "ytd", startDate: "2020-01-01", endDate: "2031-01-01" } as any);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(out.fileBuffer as any);
      const sheet = wb.getWorksheet("Invoices & Tax Audit")!;
      let headerRow = 0;
      let col = 0;
      sheet.eachRow((row, n) => row.eachCell((cell, c) => { if (cell.value === "Lodging Tax Rate (%)") { headerRow = n; col = c; } }));
      return Number(sheet.getRow(headerRow + 1).getCell(col).value);
    };
    expect(await rateFor(0)).toBe(0);
    expect(await rateFor(10)).toBeCloseTo(0.1, 5);
  });
});
