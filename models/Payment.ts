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
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
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
    reservationId: {
      type: Schema.Types.ObjectId,
      ref: "Reservation",
      required: true,
      index: true,
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
  },
  {
    timestamps: true,
  }
);

PaymentSchema.index({ propertyId: 1, reservationId: 1 });
PaymentSchema.index({ propertyId: 1, createdAt: -1 });

export const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);
