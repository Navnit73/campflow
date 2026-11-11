import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDiscount extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  propertyId: mongoose.Types.ObjectId;
  code: string;
  name: string;
  type: "percentage" | "fixed_amount";
  value: number;
  validFrom?: Date;
  validUntil?: Date;
  isActive: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const DiscountSchema = new Schema<IDiscount>(
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
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["percentage", "fixed_amount"],
      default: "percentage",
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    validFrom: { type: Date },
    validUntil: { type: Date },
    isActive: {
      type: Boolean,
      default: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

DiscountSchema.index({ propertyId: 1, code: 1 }, { unique: true });

export const Discount: Model<IDiscount> =
  mongoose.models.Discount || mongoose.model<IDiscount>("Discount", DiscountSchema);
