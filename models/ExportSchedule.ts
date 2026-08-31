import mongoose, { Schema, Document, Model } from "mongoose";
import { ExportReportType } from "./ExportJob";

export type ScheduleFrequency = "daily" | "weekly" | "monthly";

export interface IExportSchedule extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  propertyId: mongoose.Types.ObjectId;
  createdByUserId?: mongoose.Types.ObjectId;
  name: string;
  type: ExportReportType;
  frequency: ScheduleFrequency;
  dayOfWeek?: number; // 0 = Sunday, 1 = Monday, etc.
  dayOfMonth?: number; // 1-31
  time: string; // "08:00" (HH:mm in 24-hr format)
  recipients: string[];
  filters?: {
    status?: string;
    paymentMethod?: string;
    category?: string;
  };
  isActive: boolean;
  lastRunAt?: Date;
  lastStatus?: "success" | "failed";
  lastError?: string;
  nextRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ExportScheduleSchema = new Schema<IExportSchedule>(
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
    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    name: {
      type: String,
      required: true,
      trim: true,
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
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      default: "weekly",
      required: true,
    },
    dayOfWeek: {
      type: Number,
      default: 1, // Monday
      min: 0,
      max: 6,
    },
    dayOfMonth: {
      type: Number,
      default: 1,
      min: 1,
      max: 31,
    },
    time: {
      type: String,
      default: "08:00",
    },
    recipients: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    filters: {
      status: { type: String },
      paymentMethod: { type: String },
      category: { type: String },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastRunAt: {
      type: Date,
    },
    lastStatus: {
      type: String,
      enum: ["success", "failed"],
    },
    lastError: {
      type: String,
      default: "",
    },
    nextRunAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

ExportScheduleSchema.index({ propertyId: 1, isActive: 1 });
ExportScheduleSchema.index({ isActive: 1, nextRunAt: 1 });

export const ExportSchedule: Model<IExportSchedule> =
  mongoose.models.ExportSchedule ||
  mongoose.model<IExportSchedule>("ExportSchedule", ExportScheduleSchema);
