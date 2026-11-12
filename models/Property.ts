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
  /** Set when the owner first saves Settings (confirms tax rate and check-in/out times). */
  settingsConfirmedAt?: Date;
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
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      zip: { type: String, default: "" },
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
      default: "UTC",
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
      default: "", // the park's own policy — never an invented one
    },
    settingsConfirmedAt: {
      type: Date,
    },
    quietHours: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

PropertySchema.index({ organizationId: 1, name: 1 });

export const Property: Model<IProperty> =
  mongoose.models.Property || mongoose.model<IProperty>("Property", PropertySchema);
