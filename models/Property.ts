import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProperty extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  coordinates?: {
    lat: number;
    lng: number;
  };
  phone: string;
  email: string;
  timezone: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  rules?: string[];
  amenities?: string[];
  taxRatePercent: number;
  bookingPolicy?: string;
  quietHours?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PropertySchema = new Schema<IProperty>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zip: { type: String, required: true },
      country: { type: String, default: "USA" },
    },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    timezone: {
      type: String,
      default: "America/New_York",
    },
    currency: {
      type: String,
      default: "USD",
    },
    checkInTime: {
      type: String,
      default: "13:00",
    },
    checkOutTime: {
      type: String,
      default: "11:00",
    },
    rules: [{ type: String }],
    amenities: [{ type: String }],
    taxRatePercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    bookingPolicy: {
      type: String,
      default: "Standard 48-hour cancellation policy applies.",
    },
    quietHours: {
      type: String,
      default: "10:00 PM - 7:00 AM",
    },
  },
  {
    timestamps: true,
  }
);

PropertySchema.index({ organizationId: 1, name: 1 });

export const Property: Model<IProperty> =
  mongoose.models.Property || mongoose.model<IProperty>("Property", PropertySchema);
