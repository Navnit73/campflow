import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase } from "../helpers/db";
import { seedTenant, guestInput } from "../helpers/fixtures";
import { ExportService } from "@/services/export.service";
import { ReservationService } from "@/services/reservation.service";
import { ExportJob } from "@/models/ExportJob";
import { ExportSchedule } from "@/models/ExportSchedule";

setupTestDatabase();

describe("schedule timing (audit M4)", () => {
  const from = new Date("2026-11-11T12:00:00Z"); // 05:00 in Denver (MST, UTC-7)

  it("daily runs at the park's local time, not the server's", () => {
    expect(ExportService.calculateNextRunDate("daily", "08:00", 1, 1, "America/Denver", from).toISOString()).toBe("2026-11-11T15:00:00.000Z");
    expect(ExportService.calculateNextRunDate("daily", "04:00", 1, 1, "America/Denver", from).toISOString()).toBe("2026-11-12T11:00:00.000Z");
  });

  it("midnight stays midnight (was `hours || 8`)", () => {
    expect(ExportService.calculateNextRunDate("daily", "00:30", 1, 1, "UTC", from).toISOString()).toBe("2026-11-12T00:30:00.000Z");
  });

  it("weekly picks the right weekday", () => {
    // 2026-11-11 is a Wednesday (3); next Monday is 2026-11-16
    expect(ExportService.calculateNextRunDate("weekly", "09:00", 1, 1, "UTC", from).toISOString()).toBe("2026-11-16T09:00:00.000Z");
  });

  it("monthly clamps the 31st to the month's last day (was overflowing into the next month)", () => {
    const jan31Late = new Date("2027-01-31T23:00:00Z");
    expect(ExportService.calculateNextRunDate("monthly", "06:00", 1, 31, "UTC", jan31Late).toISOString()).toBe("2027-02-28T06:00:00.000Z");
  });

  it("respects DST", () => {
    const summer = new Date("2026-07-01T00:00:00Z");
    expect(ExportService.calculateNextRunDate("daily", "08:00", 1, 1, "America/Denver", summer).toISOString()).toBe("2026-07-01T14:00:00.000Z");
  });
});

describe("date ranges", () => {
  it("custom ranges are inclusive local days", () => {
    const r = ExportService.resolveDateRange({ preset: "custom", startDate: "2026-06-01", endDate: "2026-06-30" }, "America/Denver");
    expect(r.start.toISOString()).toBe("2026-06-01T06:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-07-01T05:59:59.999Z");
    expect(r.startDay.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });
});

describe("export storage & lifecycle (audit H14, M13)", () => {
  async function withData() {
    const t = await seedTenant();
    await ReservationService.createReservation(t.orgId, t.propertyId, {
      siteId: t.site._id.toString(), guest: guestInput(), checkInDate: "2030-06-01", checkOutDate: "2030-06-03",
      adults: 2, children: 0, pets: 0, addOns: [], status: "confirmed", source: "admin", specialRequests: "", notes: "",
    } as any);
    return t;
  }

  it("stores files in GridFS, never returns them inline, and downloads the same bytes", async () => {
    const t = await withData();
    const res = await ExportService.generateOnDemandExport(t.orgId, t.propertyId, undefined, { type: "excel_customers" } as any);
    expect(res.job.fileBufferBase64).toBeUndefined();
    const stored = await ExportJob.findById(res.job._id).select("+fileBufferBase64").lean();
    expect(stored!.fileBufferBase64).toBeUndefined();
    expect(stored!.fileId).toBeTruthy();
    const dl = await ExportService.downloadExportJob(t.orgId, t.propertyId, String(res.job._id));
    expect(Buffer.compare(dl.fileBuffer, res.fileBuffer)).toBe(0);
  });

  it("downloads are tenant-scoped", async () => {
    const a = await withData();
    const b = await seedTenant();
    const res = await ExportService.generateOnDemandExport(a.orgId, a.propertyId, undefined, { type: "excel_customers" } as any);
    await expect(ExportService.downloadExportJob(b.orgId, b.propertyId, String(res.job._id))).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("legacy inline (base64) jobs still download", async () => {
    const t = await seedTenant();
    const job = await ExportJob.create({
      organizationId: t.org._id, propertyId: t.property._id, type: "excel_customers", status: "completed",
      fileName: "legacy.xlsx", fileBufferBase64: Buffer.from("legacy").toString("base64"), recordsCount: 0, completedAt: new Date(),
    });
    const dl = await ExportService.downloadExportJob(t.orgId, t.propertyId, String(job._id));
    expect(dl.fileBuffer.toString()).toBe("legacy");
  });

  it("retention purge removes the file but keeps the history row", async () => {
    const t = await withData();
    const res = await ExportService.generateOnDemandExport(t.orgId, t.propertyId, undefined, { type: "excel_bookings" } as any);
    const later = new Date(Date.now() + 365 * 24 * 3600_000);
    expect((await ExportService.purgeExpiredExportFiles(later)).purged).toBe(1);
    const job = await ExportJob.findById(res.job._id).lean();
    expect(job!.fileDeletedAt).toBeTruthy();
    await expect(ExportService.downloadExportJob(t.orgId, t.propertyId, String(res.job._id))).rejects.toMatchObject({ name: "NotFoundError" });
    const files = await mongoose.connection.db!.collection("export_files.files").countDocuments();
    expect(files).toBe(0);
  });

  it("concurrent cron invocations run a due schedule only once (audit H11)", async () => {
    const t = await withData();
    await ExportSchedule.create({
      organizationId: t.org._id, propertyId: t.property._id, name: "Daily", type: "excel_bookings",
      frequency: "daily", time: "06:00", recipients: ["owner@x.com"], isActive: true, nextRunAt: new Date(Date.now() - 1000),
    });
    const [a, b] = await Promise.all([ExportService.runDueSchedules(), ExportService.runDueSchedules()]);
    expect(a.processedCount + b.processedCount).toBe(1);
    expect(await ExportJob.countDocuments({ isScheduled: true })).toBe(1);
    const s = await ExportSchedule.findOne().lean();
    expect(s!.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
    expect(s!.lastStatus).toBe("success");
  });

  it("schedule rename doesn't shift the next run; timing change does", async () => {
    const t = await seedTenant();
    const s = await ExportService.createSchedule(t.orgId, t.propertyId, undefined, {
      name: "Weekly", type: "excel_bookings", frequency: "weekly", dayOfWeek: 1, time: "07:00", recipients: ["a@x.com"], isActive: true,
    } as any);
    const original = s.nextRunAt!.getTime();
    const renamed = await ExportService.updateSchedule(t.orgId, t.propertyId, String(s._id), { name: "Renamed" });
    expect(renamed.nextRunAt!.getTime()).toBe(original);
    const retimed = await ExportService.updateSchedule(t.orgId, t.propertyId, String(s._id), { time: "09:30" });
    expect(retimed.nextRunAt!.getTime()).not.toBe(original);
  });
});

describe("workbook content (ported from legacy tests/export-excel.test.ts)", () => {
  it("master accounting workbook has every sheet and is a valid xlsx; each report type builds", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const t = await seedTenant();
    await ReservationService.createReservation(t.orgId, t.propertyId, {
      siteId: t.site._id.toString(), guest: guestInput(), checkInDate: "2030-06-01", checkOutDate: "2030-06-03",
      adults: 2, children: 0, pets: 0, addOns: [], status: "confirmed", source: "admin", specialRequests: "", notes: "",
      initialPayment: { amount: 20, method: "cash" },
    } as any);

    const master = await ExportService.generateOnDemandExport(t.orgId, t.propertyId, undefined, { type: "excel_master_accounting", preset: "ytd" } as any);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(master.fileBuffer as any);
    const names = wb.worksheets.map((w) => w.name);
    for (const sheet of ["Executive Summary", "Bookings & Occupancy", "Payment Transactions Ledger", "Invoices & Tax Audit", "Guest CRM Directory"]) {
      expect(names).toContain(sheet);
    }

    for (const type of ["excel_bookings", "excel_transactions", "excel_invoices", "excel_customers"]) {
      const r = await ExportService.generateOnDemandExport(t.orgId, t.propertyId, undefined, { type } as any);
      expect(r.fileBuffer.length).toBeGreaterThan(1000);
    }
  });

  it("an empty property still produces valid workbooks", async () => {
    const t = await seedTenant();
    const r = await ExportService.generateOnDemandExport(t.orgId, t.propertyId, undefined, { type: "excel_master_accounting" } as any);
    expect(r.job.recordsCount).toBe(0);
  });
});
