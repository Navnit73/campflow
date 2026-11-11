import mongoose, { Schema, Document, Model } from "mongoose";

export type BroadcastPriority = "general" | "event" | "urgent" | "weather_alert";
export type BroadcastRecipientFilter = "all_guests" | "in_house_campers" | "upcoming_arrivals";
export type BroadcastStatus = "queued" | "sending" | "sent" | "failed" | "partial";

export interface IBroadcast extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  propertyId: mongoose.Types.ObjectId;
  subject: string;
  message: string;
  priority: BroadcastPriority;
  recipientFilter: BroadcastRecipientFilter;
  recipientCount: number;
  recipientEmails: string[];
  deliveryStats: {
    total: number;
    successful: number;
    failed: number;
  };
  sentByUserId?: mongoose.Types.ObjectId;
  sentByUserName?: string;
  status: BroadcastStatus;
  /** Client-supplied key: retrying the same request never creates/sends a second broadcast. */
  idempotencyKey?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BroadcastSchema = new Schema<IBroadcast>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    subject: {
      type: String,
      required: [true, "Announcement subject is required"],
      trim: true,
    },
    message: {
      type: String,
      required: [true, "Announcement message is required"],
      trim: true,
    },
    priority: {
      type: String,
      enum: ["general", "event", "urgent", "weather_alert"],
      default: "general",
      required: true,
    },
    recipientFilter: {
      type: String,
      enum: ["all_guests", "in_house_campers", "upcoming_arrivals"],
      default: "in_house_campers",
      required: true,
    },
    recipientCount: {
      type: Number,
      default: 0,
    },
    recipientEmails: [
      {
        type: String,
        trim: true,
      },
    ],
    deliveryStats: {
      total: { type: Number, default: 0 },
      successful: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    sentByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    sentByUserName: {
      type: String,
      default: "Staff",
    },
    status: {
      type: String,
      enum: ["queued", "sending", "sent", "failed", "partial"],
      default: "queued",
    },
    idempotencyKey: { type: String, trim: true },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

BroadcastSchema.index({ propertyId: 1, createdAt: -1 });
BroadcastSchema.index(
  { organizationId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export const Broadcast: Model<IBroadcast> =
  mongoose.models.Broadcast || mongoose.model<IBroadcast>("Broadcast", BroadcastSchema);
