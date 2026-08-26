import mongoose, { Schema, Document, Model } from "mongoose";

export type AddOnCategory =
  | "equipment"
  | "merchandise"
  | "utility"
  | "convenience"
  | "activities"
  | "fees";

export type AddOnPricingType =
  | "per_stay" // Flat fee per reservation
  | "per_night" // Charged per night of stay
  | "per_unit" // Charged per item / quantity
  | "per_person"; // Charged per guest / adult count

export interface IAddOn extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  propertyId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  category: AddOnCategory;
  pricingType: AddOnPricingType;
  price: number;
  taxable: boolean;
  isActive: boolean;
  icon?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const AddOnSchema = new Schema<IAddOn>(
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
    name: {
      type: String,
      required: [true, "Service name is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      enum: ["equipment", "merchandise", "utility", "convenience", "activities", "fees"],
      default: "convenience",
      required: true,
      index: true,
    },
    pricingType: {
      type: String,
      enum: ["per_stay", "per_night", "per_unit", "per_person"],
      default: "per_stay",
      required: true,
    },
    price: {
      type: Number,
      required: [true, "Service rate/price is required"],
      min: [0, "Rate cannot be negative"],
    },
    taxable: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    icon: {
      type: String,
      default: "sparkles",
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

AddOnSchema.index({ propertyId: 1, isActive: 1, sortOrder: 1 });

export const AddOn: Model<IAddOn> =
  mongoose.models.AddOn || mongoose.model<IAddOn>("AddOn", AddOnSchema);
