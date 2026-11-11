import mongoose, { Schema, Document, Model } from "mongoose";
import {
  PaymentMethod,
  PAYMENT_METHODS,
  PaymentStatus,
  PAYMENT_STATUSES,
} from "@/lib/constants";

export interface IPayment extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  propertyId: mongoose.Types.ObjectId;
  reservationId: mongoose.Types.ObjectId;
  guestId?: mongoose.Types.ObjectId;
  type: "payment" | "refund";
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionReference?: string;
  notes?: string;
  processedByUserId?: mongoose.Types.ObjectId;
  /** Client-supplied key making retries of the same payment request idempotent. */
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
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
    reservationId: {
      type: Schema.Types.ObjectId,
      ref: "Reservation",
      required: true,
    },
    guestId: {
      type: Schema.Types.ObjectId,
      ref: "Guest",
    },
    type: {
      type: String,
      enum: ["payment", "refund"],
      default: "payment",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "USD",
    },
    method: {
      type: String,
      enum: PAYMENT_METHODS,
      default: "credit_card",
      required: true,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "completed",
      required: true,
    },
    transactionReference: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      default: "",
    },
    processedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    idempotencyKey: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

PaymentSchema.index({ propertyId: 1, reservationId: 1 });
PaymentSchema.index({ propertyId: 1, createdAt: -1 });
// Payment list: tenant filter + createdAt sort in-index, index-only count.
PaymentSchema.index({ organizationId: 1, propertyId: 1, createdAt: -1 });
// Idempotent payment recording (only enforced when a key is supplied)
PaymentSchema.index(
  { organizationId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);
