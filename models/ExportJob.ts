import mongoose, { Schema, Document, Model } from "mongoose";

export type ExportReportType =
  | "excel_master_accounting"
  | "excel_bookings"
  | "excel_transactions"
  | "excel_invoices"
  | "excel_customers";

export type ExportJobStatus = "pending" | "processing" | "completed" | "failed";

export interface IExportJob extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  propertyId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  type: ExportReportType;
  status: ExportJobStatus;
  fileName: string;
  fileBufferBase64?: string;
  fileSizeBytes?: number;
  recordsCount: number;
  filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    paymentMethod?: string;
    category?: string;
    preset?: string;
  };
  isScheduled: boolean;
  scheduleId?: mongoose.Types.ObjectId;
  errorMessage?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ExportJobSchema = new Schema<IExportJob>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    type: {
      type: String,
      enum: [
        "excel_master_accounting",
        "excel_bookings",
        "excel_transactions",
        "excel_invoices",
        "excel_customers",
      ],
      default: "excel_master_accounting",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      required: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileBufferBase64: {
      type: String,
      select: false, // Omit by default from list queries to keep payload lightweight
    },
    fileSizeBytes: {
      type: Number,
      default: 0,
    },
    recordsCount: {
      type: Number,
      default: 0,
    },
    filters: {
      startDate: { type: String },
      endDate: { type: String },
      status: { type: String },
      paymentMethod: { type: String },
      category: { type: String },
      preset: { type: String },
    },
    isScheduled: {
      type: Boolean,
      default: false,
    },
    scheduleId: {
      type: Schema.Types.ObjectId,
      ref: "ExportSchedule",
    },
    errorMessage: {
      type: String,
      default: "",
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

ExportJobSchema.index({ propertyId: 1, createdAt: -1 });
ExportJobSchema.index({ organizationId: 1, createdAt: -1 });

export const ExportJob: Model<IExportJob> =
  mongoose.models.ExportJob || mongoose.model<IExportJob>("ExportJob", ExportJobSchema);
