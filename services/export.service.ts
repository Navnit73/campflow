import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connection";
import { ExportJob, ExportReportType } from "@/models/ExportJob";
import { ExportSchedule } from "@/models/ExportSchedule";
import { Reservation } from "@/models/Reservation";
import { Payment } from "@/models/Payment";
import { Guest } from "@/models/Guest";
import { Property } from "@/models/Property";
import { AuditLog } from "@/models/AuditLog";
import { ExcelExportService } from "./excel-export.service";
import { MailService } from "./mail.service";
import {
  CreateOnDemandExportInput,
  CreateScheduleInput,
  UpdateScheduleInput,
  QueryHistoryInput,
} from "@/lib/validations/export.schema";
import { NotFoundError, ValidationError } from "@/lib/utils/errors";
import {
  addDaysStr,
  daysInMonth,
  parseDateOnly,
  zonedDateKey,
  zonedMidnight,
  zonedTimeToInstant,
} from "@/lib/utils/date";
import { deleteExportFile, readExportFile, saveExportFile } from "@/lib/storage/export-files";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Hard cap per collection so one export can't exhaust server memory. */
export const MAX_EXPORT_ROWS = 50_000;
/** Stored export files are purged after this many days (history rows are kept). */
export const EXPORT_RETENTION_DAYS = Number(process.env.EXPORT_RETENTION_DAYS) || 30;

const oid = (id: string | mongoose.Types.ObjectId) => new mongoose.Types.ObjectId(id);

export interface ResolvedRange {
  /** Inclusive instant range (for createdAt). */
  start: Date;
  end: Date;
  /** Inclusive date-only range (for checkInDate, stored as UTC midnight). */
  startDay: Date;
  endDay: Date;
  text: string;
}

type ReportFilters = { status?: string; paymentMethod?: string };

interface ReportData {
  // Mongoose lean docs with populated refs, consumed by ExcelExportService.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reservations: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payments: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  guests: any[];
}

const NEEDS: Record<ExportReportType, { reservations: boolean; payments: boolean; guests: boolean }> = {
  excel_master_accounting: { reservations: true, payments: true, guests: true },
  excel_bookings: { reservations: true, payments: false, guests: false },
  excel_invoices: { reservations: true, payments: false, guests: false },
  excel_transactions: { reservations: false, payments: true, guests: false },
  excel_customers: { reservations: false, payments: false, guests: true },
};

function assertWithinCap(count: number, what: string) {
  if (count > MAX_EXPORT_ROWS) {
    throw new ValidationError(
      `This export would include more than ${MAX_EXPORT_ROWS.toLocaleString()} ${what}. Please narrow the date range or filters.`
    );
  }
}

export class ExportService {
  /**
   * Resolves a reporting window in the property's timezone.
   * (Previously server-local midnight was used, so on a UTC host "today" was the UTC day.)
   */
  static resolveDateRange(
    params: { startDate?: string; endDate?: string; preset?: string; frequency?: string },
    timezone?: string | null
  ): ResolvedRange {
    const todayKey = zonedDateKey(new Date(), timezone);
    const [y, m] = todayKey.split("-").map(Number);
    const isDateKey = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

    const preset =
      params.preset || (params.frequency === "daily" ? "today" : params.frequency === "monthly" ? "30d" : "7d");

    let startKey = todayKey;
    let endKey = todayKey;
    let label: string;

    switch (preset) {
      case "today":
        label = "Today";
        break;
      case "7d":
        startKey = addDaysStr(todayKey, -7);
        label = "Last 7 Days";
        break;
      case "30d":
        startKey = addDaysStr(todayKey, -30);
        label = "Last 30 Days";
        break;
      case "mtd":
        startKey = `${y}-${String(m).padStart(2, "0")}-01`;
        label = "Month to Date";
        break;
      case "qtd": {
        const qMonth = Math.floor((m - 1) / 3) * 3 + 1;
        startKey = `${y}-${String(qMonth).padStart(2, "0")}-01`;
        label = "Quarter to Date";
        break;
      }
      case "ytd":
        startKey = `${y}-01-01`;
        label = "Year to Date";
        break;
      case "custom":
      default:
        if (isDateKey(params.startDate)) {
          startKey = params.startDate!;
          endKey = isDateKey(params.endDate) ? params.endDate! : todayKey;
          label = isDateKey(params.endDate) ? "" : `Since ${startKey}`;
        } else {
          startKey = addDaysStr(todayKey, -30);
          label = "Last 30 Days";
        }
        if (startKey > endKey) [startKey, endKey] = [endKey, startKey];
    }

    const start = zonedMidnight(startKey, timezone);
    const end = new Date(zonedMidnight(addDaysStr(endKey, 1), timezone).getTime() - 1);
    const range = startKey === endKey ? startKey : `${startKey} to ${endKey}`;

    return {
      start,
      end,
      startDay: parseDateOnly(startKey),
      endDay: parseDateOnly(endKey),
      text: label ? `${label} (${range})` : range,
    };
  }

  /**
   * Next run instant for a recurring schedule, evaluated in the property's timezone.
   * Fixes: server-local time, `hours || 8` turning 00:xx into 08:xx, and day-of-month overflow
   * (31st in a 30-day month or February now clamps to the month's last day).
   */
  static calculateNextRunDate(
    frequency: "daily" | "weekly" | "monthly",
    timeStr: string,
    dayOfWeek = 1,
    dayOfMonth = 1,
    timezone?: string | null,
    from: Date = new Date()
  ): Date {
    const [hRaw, mRaw] = String(timeStr || "08:00").split(":").map(Number);
    const hours = Number.isFinite(hRaw) ? Math.min(23, Math.max(0, hRaw)) : 8;
    const minutes = Number.isFinite(mRaw) ? Math.min(59, Math.max(0, mRaw)) : 0;
    const todayKey = zonedDateKey(from, timezone);
    const at = (key: string) => zonedTimeToInstant(key, hours, minutes, timezone);

    if (frequency === "daily" || frequency === "weekly") {
      for (let d = 0; d <= 8; d++) {
        const key = addDaysStr(todayKey, d);
        const weekdayOk = frequency === "daily" || parseDateOnly(key).getUTCDay() === dayOfWeek;
        const candidate = at(key);
        if (weekdayOk && candidate > from) return candidate;
      }
    } else {
      const [y, m] = todayKey.split("-").map(Number);
      for (let i = 0; i <= 2; i++) {
        const monthIndex = m - 1 + i;
        const year = y + Math.floor(monthIndex / 12);
        const month0 = monthIndex % 12;
        const day = Math.min(Math.max(1, dayOfMonth), daysInMonth(year, month0));
        const key = `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const candidate = at(key);
        if (candidate > from) return candidate;
      }
    }
    // Unreachable for valid input; fall back to one day later.
    return new Date(from.getTime() + 24 * 3600_000);
  }

  static getReportTypeName(type: ExportReportType): string {
    switch (type) {
      case "excel_master_accounting":
        return "Master Campground Accounting Workbook";
      case "excel_bookings":
        return "Bookings & Occupancy Report";
      case "excel_transactions":
        return "Financial Transactions & Payment Ledger";
      case "excel_invoices":
        return "Invoices & Lodging Tax Liability Audit";
      case "excel_customers":
        return "Guest CRM Directory & Camper Roster";
      default:
        return "Campground Excel Report";
    }
  }

  /** Loads only the collections the report type needs, within the row cap. */
  private static async loadReportData(
    propertyId: mongoose.Types.ObjectId,
    type: ExportReportType,
    range: ResolvedRange,
    filters: ReportFilters
  ): Promise<ReportData> {
    const need = NEEDS[type] || NEEDS.excel_master_accounting;

    const reservationQuery: Record<string, unknown> = {
      propertyId,
      $or: [
        { createdAt: { $gte: range.start, $lte: range.end } },
        { checkInDate: { $gte: range.startDay, $lte: range.endDay } },
      ],
    };
    if (filters.status && filters.status !== "all") reservationQuery.status = String(filters.status);

    const paymentQuery: Record<string, unknown> = { propertyId, createdAt: { $gte: range.start, $lte: range.end } };
    if (filters.paymentMethod && filters.paymentMethod !== "all") paymentQuery.method = String(filters.paymentMethod);

    const guestQuery = { propertyId };

    // Count first (cheap, index-backed) so oversized exports fail fast instead of OOM-ing.
    const [rCount, pCount, gCount] = await Promise.all([
      need.reservations ? Reservation.countDocuments(reservationQuery) : 0,
      need.payments ? Payment.countDocuments(paymentQuery) : 0,
      need.guests ? Guest.countDocuments(guestQuery) : 0,
    ]);
    assertWithinCap(rCount, "reservations");
    assertWithinCap(pCount, "payments");
    assertWithinCap(gCount, "guests");

    const [reservations, payments, guests] = await Promise.all([
      need.reservations
        ? // No DB sort: a sort on createdAt makes the planner walk the whole property via the sort index
          // instead of using an index per $or branch. The result is capped, so sorting in memory is cheap.
          Reservation.find(reservationQuery)
            .populate("guestId", "firstName lastName email phone")
            .lean()
            .then((rows) => rows.sort((x, y) => +new Date(y.createdAt) - +new Date(x.createdAt)))
        : [],
      need.payments
        ? Payment.find(paymentQuery)
            .populate("guestId", "firstName lastName email")
            .populate("reservationId", "confirmationCode")
            .populate("processedByUserId", "name")
            .sort({ createdAt: -1 })
            .lean()
        : [],
      need.guests ? Guest.find(guestQuery).sort({ createdAt: -1 }).lean() : [],
    ]);

    return { reservations, payments, guests };
  }

  /** Builds the workbook for a report type (shared by on-demand and scheduled exports). */
  private static async buildWorkbook(
    type: ExportReportType,
    propertyName: string,
    dateRangeText: string,
    data: ReportData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    property: any
  ): Promise<{ fileBuffer: Buffer; fileName: string; recordsCount: number }> {
    const dateStamp = new Date().toISOString().split("T")[0];
    const safePropName = propertyName.replace(/[^a-zA-Z0-9_-]/g, "_");

    switch (type) {
      case "excel_bookings":
        return {
          recordsCount: data.reservations.length,
          fileName: `${safePropName}_Bookings_${dateStamp}.xlsx`,
          fileBuffer: await ExcelExportService.generateBookingsWorkbook({ propertyName, dateRangeText, reservations: data.reservations }),
        };
      case "excel_transactions":
        return {
          recordsCount: data.payments.length,
          fileName: `${safePropName}_Payment_Ledger_${dateStamp}.xlsx`,
          fileBuffer: await ExcelExportService.generateTransactionsWorkbook({ propertyName, dateRangeText, payments: data.payments }),
        };
      case "excel_invoices":
        return {
          recordsCount: data.reservations.length,
          fileName: `${safePropName}_Invoices_Tax_Audit_${dateStamp}.xlsx`,
          fileBuffer: await ExcelExportService.generateInvoicesTaxWorkbook({
            propertyName,
            dateRangeText,
            reservations: data.reservations,
            propertySettings: property,
          }),
        };
      case "excel_customers":
        return {
          recordsCount: data.guests.length,
          fileName: `${safePropName}_Guest_CRM_${dateStamp}.xlsx`,
          fileBuffer: await ExcelExportService.generateCustomersWorkbook({ propertyName, guests: data.guests }),
        };
      case "excel_master_accounting":
      default:
        return {
          recordsCount: data.reservations.length + data.payments.length + data.guests.length,
          fileName: `${safePropName}_Master_Accounting_${dateStamp}.xlsx`,
          fileBuffer: await ExcelExportService.generateMasterAccountingWorkbook({
            propertyName,
            dateRangeText,
            reservations: data.reservations,
            payments: data.payments,
            guests: data.guests,
            propertySettings: property,
          }),
        };
    }
  }

  /** Strips storage internals from a job before returning it to clients. */
  private static toJobSummary(job: { toObject?: () => Record<string, unknown> } & Record<string, unknown>) {
    const obj = (typeof job.toObject === "function" ? job.toObject() : { ...job }) as Record<string, unknown>;
    delete obj.fileBufferBase64;
    return obj;
  }

  /** 1. Generate an on-demand Excel export. */
  static async generateOnDemandExport(
    organizationId: string,
    propertyId: string,
    userId: string | undefined,
    input: CreateOnDemandExportInput
  ) {
    await connectDB();

    const orgId = oid(organizationId);
    const propId = oid(propertyId);
    const property = await Property.findOne({ _id: propId, organizationId: orgId }).lean();
    const propertyName = property?.name || "Campground";
    const range = this.resolveDateRange(
      { startDate: input.startDate, endDate: input.endDate, preset: input.preset },
      property?.timezone
    );
    const filtersRecord = {
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status,
      paymentMethod: input.paymentMethod,
      category: input.category,
      preset: input.preset,
    };

    let built: { fileBuffer: Buffer; fileName: string; recordsCount: number };
    try {
      const data = await this.loadReportData(propId, input.type, range, input);
      built = await this.buildWorkbook(input.type, propertyName, range.text, data, property);
    } catch (err) {
      // Failures are recorded in history (status "failed") instead of vanishing.
      await ExportJob.create({
        organizationId: orgId,
        propertyId: propId,
        userId: userId ? oid(userId) : undefined,
        type: input.type,
        status: "failed",
        fileName: `${this.getReportTypeName(input.type)} (failed)`,
        errorMessage: (err as Error)?.message?.slice(0, 500) || "Export failed",
        filters: filtersRecord,
        isScheduled: false,
      }).catch(() => {});
      throw err;
    }

    const fileId = await saveExportFile(built.fileBuffer, built.fileName, { organizationId: orgId, propertyId: propId });
    const job = await ExportJob.create({
      organizationId: orgId,
      propertyId: propId,
      userId: userId ? oid(userId) : undefined,
      type: input.type,
      status: "completed",
      fileName: built.fileName,
      fileId,
      fileSizeBytes: built.fileBuffer.length,
      recordsCount: built.recordsCount,
      filters: filtersRecord,
      isScheduled: false,
      completedAt: new Date(),
    });

    await AuditLog.create({
      organizationId: orgId,
      propertyId: propId,
      userId: userId ? oid(userId) : undefined,
      action: "export.generated",
      resourceType: "ExportJob",
      resourceId: job._id,
      details: {
        type: input.type,
        fileName: built.fileName,
        recordsCount: built.recordsCount,
        fileSizeBytes: built.fileBuffer.length,
        dateRangeText: range.text,
      },
    });

    return {
      job: this.toJobSummary(job as unknown as Record<string, unknown>),
      fileBuffer: built.fileBuffer,
      fileName: built.fileName,
      contentType: XLSX_CONTENT_TYPE,
    };
  }

  /** 2. Download a previously generated export (GridFS, with legacy inline fallback). */
  static async downloadExportJob(organizationId: string, propertyId: string, jobId: string) {
    await connectDB();

    const job = await ExportJob.findOne({
      _id: oid(jobId),
      organizationId: oid(organizationId),
      propertyId: oid(propertyId),
    })
      .select("+fileBufferBase64 fileName fileId fileDeletedAt status")
      .lean();

    if (!job || job.status !== "completed" || job.fileDeletedAt) {
      throw new NotFoundError("Export file not found or expired.");
    }

    let fileBuffer: Buffer | null = null;
    if (job.fileId) {
      fileBuffer = await readExportFile(job.fileId).catch(() => null);
    } else if (job.fileBufferBase64) {
      fileBuffer = Buffer.from(job.fileBufferBase64, "base64");
    }
    if (!fileBuffer) throw new NotFoundError("Export file not found or expired.");

    return { fileBuffer, fileName: job.fileName, contentType: XLSX_CONTENT_TYPE };
  }

  /** 3. Export history (never includes file contents). */
  static async listExportHistory(organizationId: string, propertyId: string, query: QueryHistoryInput) {
    await connectDB();

    const filter: Record<string, unknown> = { organizationId: oid(organizationId), propertyId: oid(propertyId) };
    if (query.type && query.type !== "all") filter.type = String(query.type);
    if (query.status && query.status !== "all") filter.status = String(query.status);

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));

    const [jobs, total] = await Promise.all([
      ExportJob.find(filter)
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ExportJob.countDocuments(filter),
    ]);

    return { jobs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  /** 4. Recurring schedules */
  static async listSchedules(organizationId: string, propertyId: string) {
    await connectDB();
    return ExportSchedule.find({ organizationId: oid(organizationId), propertyId: oid(propertyId) })
      .populate("createdByUserId", "name email")
      .sort({ createdAt: -1 })
      .lean();
  }

  private static async propertyTimezone(propertyId: mongoose.Types.ObjectId | string) {
    const p = await Property.findById(propertyId).select("timezone").lean();
    return p?.timezone;
  }

  static async createSchedule(
    organizationId: string,
    propertyId: string,
    userId: string | undefined,
    input: CreateScheduleInput
  ) {
    await connectDB();

    const tz = await this.propertyTimezone(propertyId);
    const nextRunAt = this.calculateNextRunDate(input.frequency, input.time, input.dayOfWeek ?? 1, input.dayOfMonth ?? 1, tz);

    const schedule = await ExportSchedule.create({
      organizationId: oid(organizationId),
      propertyId: oid(propertyId),
      createdByUserId: userId ? oid(userId) : undefined,
      name: input.name,
      type: input.type,
      frequency: input.frequency,
      dayOfWeek: input.dayOfWeek ?? 1,
      dayOfMonth: input.dayOfMonth ?? 1,
      time: input.time,
      recipients: input.recipients,
      filters: input.filters,
      isActive: input.isActive ?? true,
      nextRunAt,
    });

    await AuditLog.create({
      organizationId: oid(organizationId),
      propertyId: oid(propertyId),
      userId: userId ? oid(userId) : undefined,
      action: "export_schedule.created",
      resourceType: "ExportSchedule",
      resourceId: schedule._id,
      details: { name: schedule.name, frequency: schedule.frequency },
    });

    return schedule;
  }

  static async updateSchedule(
    organizationId: string,
    propertyId: string,
    scheduleId: string,
    input: UpdateScheduleInput,
    userId?: string
  ) {
    await connectDB();

    const schedule = await ExportSchedule.findOne({
      _id: oid(scheduleId),
      organizationId: oid(organizationId),
      propertyId: oid(propertyId),
    });
    if (!schedule) throw new NotFoundError("Export schedule not found.");

    const timingChanged =
      (input.frequency !== undefined && input.frequency !== schedule.frequency) ||
      (input.time !== undefined && input.time !== schedule.time) ||
      (input.dayOfWeek !== undefined && input.dayOfWeek !== schedule.dayOfWeek) ||
      (input.dayOfMonth !== undefined && input.dayOfMonth !== schedule.dayOfMonth) ||
      (input.isActive === true && !schedule.isActive);

    if (input.name !== undefined) schedule.name = input.name;
    if (input.type !== undefined) schedule.type = input.type;
    if (input.frequency !== undefined) schedule.frequency = input.frequency;
    if (input.dayOfWeek !== undefined) schedule.dayOfWeek = input.dayOfWeek;
    if (input.dayOfMonth !== undefined) schedule.dayOfMonth = input.dayOfMonth;
    if (input.time !== undefined) schedule.time = input.time;
    if (input.recipients !== undefined) schedule.recipients = input.recipients;
    if (input.filters !== undefined) schedule.filters = input.filters;
    if (input.isActive !== undefined) schedule.isActive = input.isActive;

    // Only re-plan when timing changed (a rename no longer shifts the next run).
    if (timingChanged || !schedule.nextRunAt) {
      const tz = await this.propertyTimezone(schedule.propertyId);
      schedule.nextRunAt = this.calculateNextRunDate(schedule.frequency, schedule.time, schedule.dayOfWeek, schedule.dayOfMonth, tz);
    }

    await schedule.save();
    await AuditLog.create({
      organizationId: schedule.organizationId,
      propertyId: schedule.propertyId,
      userId: userId ? oid(userId) : undefined,
      action: "export_schedule.updated",
      resourceType: "ExportSchedule",
      resourceId: schedule._id,
      details: { changed: Object.keys(input) },
    }).catch(() => {});
    return schedule;
  }

  static async deleteSchedule(organizationId: string, propertyId: string, scheduleId: string, userId?: string) {
    await connectDB();

    const deleted = await ExportSchedule.findOneAndDelete({
      _id: oid(scheduleId),
      organizationId: oid(organizationId),
      propertyId: oid(propertyId),
    }).lean();
    if (!deleted) throw new NotFoundError("Export schedule not found.");

    await AuditLog.create({
      organizationId: deleted.organizationId,
      propertyId: deleted.propertyId,
      userId: userId ? oid(userId) : undefined,
      action: "export_schedule.deleted",
      resourceType: "ExportSchedule",
      resourceId: deleted._id,
      details: { name: deleted.name },
    }).catch(() => {});

    return { success: true };
  }

  /** 5. Run a schedule now. Tenant scope is mandatory for user-initiated runs (see runDueSchedules for cron). */
  static async runScheduleNow(scheduleId: string, organizationId?: string, propertyId?: string) {
    await connectDB();

    const query: Record<string, unknown> = { _id: oid(scheduleId) };
    if (organizationId) query.organizationId = oid(organizationId);
    if (propertyId) query.propertyId = oid(propertyId);

    const schedule = await ExportSchedule.findOne(query);
    if (!schedule) throw new NotFoundError("Export schedule not found.");

    const property = await Property.findById(schedule.propertyId).lean();
    const propertyName = property?.name || "Campground";
    const range = this.resolveDateRange({ frequency: schedule.frequency }, property?.timezone);

    const data = await this.loadReportData(schedule.propertyId, schedule.type, range, schedule.filters || {});
    const built = await this.buildWorkbook(schedule.type, propertyName, range.text, data, property);

    const fileId = await saveExportFile(built.fileBuffer, built.fileName, {
      organizationId: schedule.organizationId,
      propertyId: schedule.propertyId,
    });
    const job = await ExportJob.create({
      organizationId: schedule.organizationId,
      propertyId: schedule.propertyId,
      type: schedule.type,
      status: "completed",
      fileName: built.fileName,
      fileId,
      fileSizeBytes: built.fileBuffer.length,
      recordsCount: built.recordsCount,
      isScheduled: true,
      scheduleId: schedule._id,
      completedAt: new Date(),
    });

    const totalRevenue = data.payments
      .filter((p) => p.status === "completed")
      .reduce((sum: number, p) => sum + (p.type === "refund" ? -p.amount : p.amount), 0);

    const mailResult = await MailService.sendScheduledExportReport({
      recipients: schedule.recipients,
      propertyName,
      scheduleName: schedule.name,
      reportTypeName: this.getReportTypeName(schedule.type),
      frequency: schedule.frequency.toUpperCase(),
      dateRangeText: range.text,
      recordsCount: built.recordsCount,
      fileSizeBytes: built.fileBuffer.length,
      fileName: built.fileName,
      fileBuffer: built.fileBuffer,
      summaryMetrics: {
        totalRevenue,
        totalTransactions: data.payments.length,
        totalBookings: data.reservations.length,
      },
    });

    schedule.lastRunAt = new Date();
    schedule.lastStatus = mailResult.success ? "success" : "failed";
    schedule.lastError = mailResult.success ? undefined : (mailResult as { error?: string }).error || "Email delivery failed";
    schedule.nextRunAt = this.calculateNextRunDate(
      schedule.frequency,
      schedule.time,
      schedule.dayOfWeek,
      schedule.dayOfMonth,
      property?.timezone
    );
    await schedule.save();

    return {
      success: true,
      jobId: job._id,
      fileName: built.fileName,
      recordsCount: built.recordsCount,
      fileSizeBytes: built.fileBuffer.length,
      mailResult,
    };
  }

  /** Purges stored files older than the retention window; history rows are kept. */
  static async purgeExpiredExportFiles(now: Date = new Date()) {
    await connectDB();
    const cutoff = new Date(now.getTime() - EXPORT_RETENTION_DAYS * 24 * 3600_000);
    const expired = await ExportJob.find({ completedAt: { $lt: cutoff }, fileDeletedAt: { $exists: false } })
      .select("_id fileId")
      .limit(500)
      .lean();

    for (const job of expired) {
      if (job.fileId) await deleteExportFile(job.fileId);
      await ExportJob.updateOne({ _id: job._id }, { $set: { fileDeletedAt: now }, $unset: { fileBufferBase64: 1, fileId: 1 } });
    }
    return { purged: expired.length };
  }

  /** 6. Process all due recurring schedules (cron). */
  static async runDueSchedules() {
    await connectDB();

    const now = new Date();
    const dueSchedules = await ExportSchedule.find({ isActive: true, nextRunAt: { $lte: now } })
      .select("_id name propertyId frequency time dayOfWeek dayOfMonth nextRunAt")
      .lean();

    const tzCache = new Map<string, string | undefined>();
    const results = [];
    for (const s of dueSchedules) {
      const key = s.propertyId.toString();
      if (!tzCache.has(key)) tzCache.set(key, await this.propertyTimezone(s.propertyId));

      // Atomic claim (compare-and-set on the nextRunAt we read): overlapping cron invocations
      // or retries can't both run — and email — the same schedule.
      const next = this.calculateNextRunDate(s.frequency, s.time, s.dayOfWeek, s.dayOfMonth, tzCache.get(key));
      const claimed = await ExportSchedule.findOneAndUpdate(
        { _id: s._id, isActive: true, nextRunAt: s.nextRunAt },
        { $set: { nextRunAt: next } }
      ).lean();
      if (!claimed) continue;

      try {
        const res = await this.runScheduleNow(s._id.toString());
        results.push({ scheduleId: s._id, name: s.name, status: "success", res });
      } catch (err: unknown) {
        const message = (err as Error)?.message || "Execution error";
        await ExportSchedule.updateOne(
          { _id: s._id },
          { $set: { lastStatus: "failed", lastError: message, lastRunAt: new Date() } }
        ).catch((e) => console.error("[Export Cron] Failed to record schedule failure:", e));
        results.push({ scheduleId: s._id, name: s.name, status: "failed", error: message });
      }
    }

    const retention = await this.purgeExpiredExportFiles(now).catch((e) => {
      console.error("[Export Cron] Retention purge failed:", e);
      return { purged: 0 };
    });

    return { processedCount: results.length, results, purgedFiles: retention.purged };
  }
}
