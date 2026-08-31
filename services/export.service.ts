import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connection";
import { ExportJob, IExportJob, ExportReportType } from "@/models/ExportJob";
import { ExportSchedule, IExportSchedule } from "@/models/ExportSchedule";
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

export class ExportService {
  /**
   * Helper: Resolve start & end Date objects from presets or custom date strings
   */
  static resolveDateRange(params: {
    startDate?: string;
    endDate?: string;
    preset?: string;
    frequency?: string;
  }): { start: Date; end: Date; text: string } {
    const now = new Date();
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    let start = new Date();
    start.setHours(0, 0, 0, 0);

    const preset = params.preset || (params.frequency === "daily" ? "today" : params.frequency === "monthly" ? "30d" : "7d");

    switch (preset) {
      case "today":
        // start is today 00:00:00
        return {
          start,
          end,
          text: `Today (${start.toISOString().split("T")[0]})`,
        };
      case "7d":
        start.setDate(now.getDate() - 7);
        return {
          start,
          end,
          text: `Last 7 Days (${start.toISOString().split("T")[0]} to ${end.toISOString().split("T")[0]})`,
        };
      case "30d":
        start.setDate(now.getDate() - 30);
        return {
          start,
          end,
          text: `Last 30 Days (${start.toISOString().split("T")[0]} to ${end.toISOString().split("T")[0]})`,
        };
      case "mtd":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
          start,
          end,
          text: `Month to Date (${start.toISOString().split("T")[0]} to ${end.toISOString().split("T")[0]})`,
        };
      case "qtd": {
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), quarterMonth, 1);
        return {
          start,
          end,
          text: `Quarter to Date (${start.toISOString().split("T")[0]} to ${end.toISOString().split("T")[0]})`,
        };
      }
      case "ytd":
        start = new Date(now.getFullYear(), 0, 1);
        return {
          start,
          end,
          text: `Year to Date (${start.toISOString().split("T")[0]} to ${end.toISOString().split("T")[0]})`,
        };
      case "custom":
      default:
        if (params.startDate && params.endDate) {
          start = new Date(params.startDate);
          start.setHours(0, 0, 0, 0);
          const customEnd = new Date(params.endDate);
          customEnd.setHours(23, 59, 59, 999);
          return {
            start,
            end: customEnd,
            text: `${params.startDate} to ${params.endDate}`,
          };
        }
        if (params.startDate) {
          start = new Date(params.startDate);
          start.setHours(0, 0, 0, 0);
          return {
            start,
            end,
            text: `Since ${params.startDate}`,
          };
        }
        // Default to last 30 days
        start.setDate(now.getDate() - 30);
        return {
          start,
          end,
          text: `Last 30 Days (${start.toISOString().split("T")[0]} to ${end.toISOString().split("T")[0]})`,
        };
    }
  }

  /**
   * Helper: Calculate next run timestamp for a recurring schedule
   */
  static calculateNextRunDate(
    frequency: "daily" | "weekly" | "monthly",
    timeStr: string,
    dayOfWeek = 1,
    dayOfMonth = 1
  ): Date {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const next = new Date();
    next.setHours(hours || 8, minutes || 0, 0, 0);

    if (frequency === "daily") {
      if (next <= new Date()) {
        next.setDate(next.getDate() + 1);
      }
    } else if (frequency === "weekly") {
      const currentDay = next.getDay();
      let diff = dayOfWeek - currentDay;
      if (diff < 0 || (diff === 0 && next <= new Date())) {
        diff += 7;
      }
      next.setDate(next.getDate() + diff);
    } else if (frequency === "monthly") {
      next.setDate(dayOfMonth);
      if (next <= new Date()) {
        next.setMonth(next.getMonth() + 1);
      }
    }

    return next;
  }

  /**
   * Human-readable report title
   */
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

  /**
   * 1. Generate On-Demand Excel Export
   */
  static async generateOnDemandExport(
    organizationId: string,
    propertyId: string,
    userId: string | undefined,
    input: CreateOnDemandExportInput
  ): Promise<{
    job: IExportJob;
    fileBuffer: Buffer;
    fileName: string;
    contentType: string;
  }> {
    await connectDB();

    const orgId = new mongoose.Types.ObjectId(organizationId);
    const propId = new mongoose.Types.ObjectId(propertyId);

    const property = await Property.findById(propId).lean();
    const propertyName = property?.name || "CampFlow RV Resort";

    const { start, end, text: dateRangeText } = this.resolveDateRange({
      startDate: input.startDate,
      endDate: input.endDate,
      preset: input.preset,
    });

    // Query relevant collections
    const reservationQuery: Record<string, any> = {
      propertyId: propId,
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { checkInDate: { $gte: start, $lte: end } },
      ],
    };
    if (input.status && input.status !== "all") {
      reservationQuery.status = input.status;
    }

    const paymentQuery: Record<string, any> = {
      propertyId: propId,
      createdAt: { $gte: start, $lte: end },
    };
    if (input.paymentMethod && input.paymentMethod !== "all") {
      paymentQuery.method = input.paymentMethod;
    }

    const [reservations, payments, guests] = await Promise.all([
      Reservation.find(reservationQuery)
        .populate("guestId", "firstName lastName email phone")
        .sort({ createdAt: -1 })
        .lean(),
      Payment.find(paymentQuery)
        .populate("guestId", "firstName lastName email")
        .populate("reservationId", "confirmationCode")
        .populate("processedByUserId", "name")
        .sort({ createdAt: -1 })
        .lean(),
      Guest.find({ propertyId: propId }).sort({ createdAt: -1 }).lean(),
    ]);

    let fileBuffer: Buffer;
    let recordsCount = 0;
    const dateStamp = new Date().toISOString().split("T")[0];
    const safePropName = propertyName.replace(/[^a-zA-Z0-9_-]/g, "_");
    let fileName = "";

    switch (input.type) {
      case "excel_bookings":
        recordsCount = reservations.length;
        fileName = `${safePropName}_Bookings_${dateStamp}.xlsx`;
        fileBuffer = await ExcelExportService.generateBookingsWorkbook({
          propertyName,
          dateRangeText,
          reservations,
        });
        break;

      case "excel_transactions":
        recordsCount = payments.length;
        fileName = `${safePropName}_Payment_Ledger_${dateStamp}.xlsx`;
        fileBuffer = await ExcelExportService.generateTransactionsWorkbook({
          propertyName,
          dateRangeText,
          payments,
        });
        break;

      case "excel_invoices":
        recordsCount = reservations.length;
        fileName = `${safePropName}_Invoices_Tax_Audit_${dateStamp}.xlsx`;
        fileBuffer = await ExcelExportService.generateInvoicesTaxWorkbook({
          propertyName,
          dateRangeText,
          reservations,
          propertySettings: property,
        });
        break;

      case "excel_customers":
        recordsCount = guests.length;
        fileName = `${safePropName}_Guest_CRM_${dateStamp}.xlsx`;
        fileBuffer = await ExcelExportService.generateCustomersWorkbook({
          propertyName,
          guests,
        });
        break;

      case "excel_master_accounting":
      default:
        recordsCount = reservations.length + payments.length + guests.length;
        fileName = `${safePropName}_Master_Accounting_${dateStamp}.xlsx`;
        fileBuffer = await ExcelExportService.generateMasterAccountingWorkbook({
          propertyName,
          dateRangeText,
          reservations,
          payments,
          guests,
          propertySettings: property,
        });
        break;
    }

    const fileSizeBytes = fileBuffer.length;
    const fileBufferBase64 = fileBuffer.toString("base64");

    // Save Export Job to DB
    const job = await ExportJob.create({
      organizationId: orgId,
      propertyId: propId,
      userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      type: input.type,
      status: "completed",
      fileName,
      fileBufferBase64,
      fileSizeBytes,
      recordsCount,
      filters: {
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status,
        paymentMethod: input.paymentMethod,
        category: input.category,
        preset: input.preset,
      },
      isScheduled: false,
      completedAt: new Date(),
    });

    // Create Audit Log
    await AuditLog.create({
      organizationId: orgId,
      propertyId: propId,
      userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      action: "export.generated",
      resourceType: "ExportJob",
      resourceId: job._id,
      details: {
        type: input.type,
        fileName,
        recordsCount,
        fileSizeBytes,
        dateRangeText,
      },
    });

    return {
      job,
      fileBuffer,
      fileName,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  /**
   * 2. Download a previously generated export job by ID
   */
  static async downloadExportJob(
    organizationId: string,
    propertyId: string,
    jobId: string
  ): Promise<{
    fileBuffer: Buffer;
    fileName: string;
    contentType: string;
  }> {
    await connectDB();

    const job = await ExportJob.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    }).select("+fileBufferBase64");

    if (!job || !job.fileBufferBase64) {
      throw new Error("Export file not found or expired.");
    }

    const fileBuffer = Buffer.from(job.fileBufferBase64, "base64");

    return {
      fileBuffer,
      fileName: job.fileName,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  /**
   * 3. List Export Activity History
   */
  static async listExportHistory(
    organizationId: string,
    propertyId: string,
    query: QueryHistoryInput
  ) {
    await connectDB();

    const filter: Record<string, any> = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    };

    if (query.type && query.type !== "all") {
      filter.type = query.type;
    }
    if (query.status && query.status !== "all") {
      filter.status = query.status;
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      ExportJob.find(filter)
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ExportJob.countDocuments(filter),
    ]);

    return {
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 4. Manage Recurring Schedules
   */
  static async listSchedules(organizationId: string, propertyId: string) {
    await connectDB();

    return ExportSchedule.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    })
      .populate("createdByUserId", "name email")
      .sort({ createdAt: -1 })
      .lean();
  }

  static async createSchedule(
    organizationId: string,
    propertyId: string,
    userId: string | undefined,
    input: CreateScheduleInput
  ) {
    await connectDB();

    const nextRunAt = this.calculateNextRunDate(
      input.frequency,
      input.time,
      input.dayOfWeek,
      input.dayOfMonth
    );

    const schedule = await ExportSchedule.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
      createdByUserId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
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
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
      userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
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
    input: UpdateScheduleInput
  ) {
    await connectDB();

    const schedule = await ExportSchedule.findOne({
      _id: new mongoose.Types.ObjectId(scheduleId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    });

    if (!schedule) {
      throw new Error("Export schedule not found.");
    }

    if (input.name !== undefined) schedule.name = input.name;
    if (input.type !== undefined) schedule.type = input.type;
    if (input.frequency !== undefined) schedule.frequency = input.frequency;
    if (input.dayOfWeek !== undefined) schedule.dayOfWeek = input.dayOfWeek;
    if (input.dayOfMonth !== undefined) schedule.dayOfMonth = input.dayOfMonth;
    if (input.time !== undefined) schedule.time = input.time;
    if (input.recipients !== undefined) schedule.recipients = input.recipients;
    if (input.filters !== undefined) schedule.filters = input.filters;
    if (input.isActive !== undefined) schedule.isActive = input.isActive;

    schedule.nextRunAt = this.calculateNextRunDate(
      schedule.frequency,
      schedule.time,
      schedule.dayOfWeek,
      schedule.dayOfMonth
    );

    await schedule.save();
    return schedule;
  }

  static async deleteSchedule(
    organizationId: string,
    propertyId: string,
    scheduleId: string
  ) {
    await connectDB();

    const res = await ExportSchedule.deleteOne({
      _id: new mongoose.Types.ObjectId(scheduleId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    });

    if (res.deletedCount === 0) {
      throw new Error("Export schedule not found.");
    }

    return { success: true };
  }

  /**
   * 5. Run a Specific Schedule Now
   */
  static async runScheduleNow(
    scheduleId: string,
    organizationId?: string,
    propertyId?: string
  ) {
    await connectDB();

    const query: Record<string, any> = {
      _id: new mongoose.Types.ObjectId(scheduleId),
    };
    if (organizationId) {
      query.organizationId = new mongoose.Types.ObjectId(organizationId);
    }
    if (propertyId) {
      query.propertyId = new mongoose.Types.ObjectId(propertyId);
    }

    const schedule = await ExportSchedule.findOne(query);
    if (!schedule) {
      throw new Error("Export schedule not found.");
    }

    const property = await Property.findById(schedule.propertyId).lean();
    const propertyName = property?.name || "CampFlow RV Resort";

    const { start, end, text: dateRangeText } = this.resolveDateRange({
      frequency: schedule.frequency,
    });

    // Query data with schedule filters
    const reservationQuery: Record<string, any> = {
      propertyId: schedule.propertyId,
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { checkInDate: { $gte: start, $lte: end } },
      ],
    };
    if (schedule.filters?.status && schedule.filters.status !== "all") {
      reservationQuery.status = schedule.filters.status;
    }

    const paymentQuery: Record<string, any> = {
      propertyId: schedule.propertyId,
      createdAt: { $gte: start, $lte: end },
    };
    if (schedule.filters?.paymentMethod && schedule.filters.paymentMethod !== "all") {
      paymentQuery.method = schedule.filters.paymentMethod;
    }

    const [reservations, payments, guests] = await Promise.all([
      Reservation.find(reservationQuery)
        .populate("guestId", "firstName lastName email phone")
        .sort({ createdAt: -1 })
        .lean(),
      Payment.find(paymentQuery)
        .populate("guestId", "firstName lastName email")
        .populate("reservationId", "confirmationCode")
        .populate("processedByUserId", "name")
        .sort({ createdAt: -1 })
        .lean(),
      Guest.find({ propertyId: schedule.propertyId }).sort({ createdAt: -1 }).lean(),
    ]);

    let fileBuffer: Buffer;
    let recordsCount = 0;
    const dateStamp = new Date().toISOString().split("T")[0];
    const safePropName = propertyName.replace(/[^a-zA-Z0-9_-]/g, "_");
    let fileName = "";

    switch (schedule.type) {
      case "excel_bookings":
        recordsCount = reservations.length;
        fileName = `${safePropName}_Bookings_${dateStamp}.xlsx`;
        fileBuffer = await ExcelExportService.generateBookingsWorkbook({
          propertyName,
          dateRangeText,
          reservations,
        });
        break;

      case "excel_transactions":
        recordsCount = payments.length;
        fileName = `${safePropName}_Payment_Ledger_${dateStamp}.xlsx`;
        fileBuffer = await ExcelExportService.generateTransactionsWorkbook({
          propertyName,
          dateRangeText,
          payments,
        });
        break;

      case "excel_invoices":
        recordsCount = reservations.length;
        fileName = `${safePropName}_Invoices_Tax_Audit_${dateStamp}.xlsx`;
        fileBuffer = await ExcelExportService.generateInvoicesTaxWorkbook({
          propertyName,
          dateRangeText,
          reservations,
          propertySettings: property,
        });
        break;

      case "excel_customers":
        recordsCount = guests.length;
        fileName = `${safePropName}_Guest_CRM_${dateStamp}.xlsx`;
        fileBuffer = await ExcelExportService.generateCustomersWorkbook({
          propertyName,
          guests,
        });
        break;

      case "excel_master_accounting":
      default:
        recordsCount = reservations.length + payments.length + guests.length;
        fileName = `${safePropName}_Master_Accounting_${dateStamp}.xlsx`;
        fileBuffer = await ExcelExportService.generateMasterAccountingWorkbook({
          propertyName,
          dateRangeText,
          reservations,
          payments,
          guests,
          propertySettings: property,
        });
        break;
    }

    const fileSizeBytes = fileBuffer.length;

    // Create completed ExportJob
    const job = await ExportJob.create({
      organizationId: schedule.organizationId,
      propertyId: schedule.propertyId,
      type: schedule.type,
      status: "completed",
      fileName,
      fileBufferBase64: fileBuffer.toString("base64"),
      fileSizeBytes,
      recordsCount,
      isScheduled: true,
      scheduleId: schedule._id,
      completedAt: new Date(),
    });

    // Compute metrics for email
    const totalRevenue = payments
      .filter((p) => p.status === "completed")
      .reduce((sum, p) => sum + (p.type === "refund" ? -p.amount : p.amount), 0);

    // Send email with Excel attachment to recipients
    const mailResult = await MailService.sendScheduledExportReport({
      recipients: schedule.recipients,
      propertyName,
      scheduleName: schedule.name,
      reportTypeName: this.getReportTypeName(schedule.type),
      frequency: schedule.frequency.toUpperCase(),
      dateRangeText,
      recordsCount,
      fileSizeBytes,
      fileName,
      fileBuffer,
      summaryMetrics: {
        totalRevenue,
        totalTransactions: payments.length,
        totalBookings: reservations.length,
      },
    });

    // Update schedule lastRunAt and nextRunAt
    schedule.lastRunAt = new Date();
    schedule.lastStatus = mailResult.success ? "success" : "failed";
    schedule.nextRunAt = this.calculateNextRunDate(
      schedule.frequency,
      schedule.time,
      schedule.dayOfWeek,
      schedule.dayOfMonth
    );
    await schedule.save();

    return {
      success: true,
      jobId: job._id,
      fileName,
      recordsCount,
      fileSizeBytes,
      mailResult,
    };
  }

  /**
   * 6. Process all due recurring schedules (for Cron endpoint)
   */
  static async runDueSchedules() {
    await connectDB();

    const dueSchedules = await ExportSchedule.find({
      isActive: true,
      nextRunAt: { $lte: new Date() },
    });

    const results = [];
    for (const s of dueSchedules) {
      try {
        const res = await this.runScheduleNow(s._id.toString());
        results.push({ scheduleId: s._id, name: s.name, status: "success", res });
      } catch (err: any) {
        s.lastStatus = "failed";
        s.lastError = err.message || "Execution error";
        s.nextRunAt = this.calculateNextRunDate(s.frequency, s.time, s.dayOfWeek, s.dayOfMonth);
        await s.save();
        results.push({ scheduleId: s._id, name: s.name, status: "failed", error: err.message });
      }
    }

    return {
      processedCount: results.length,
      results,
    };
  }
}
