import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOrganization extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  plan: "starter" | "growth" | "pro";
  ownerUserId?: mongoose.Types.ObjectId;
  status: "active" | "suspended" | "trial";
  settings?: {
    dateFormat?: string;
    timeFormat?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
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
      index: true,
    },
    plan: {
      type: String,
      enum: ["starter", "growth", "pro"],
      default: "starter",
    },
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["active", "suspended", "trial"],
      default: "active",
    },
    settings: {
      dateFormat: { type: String, default: "YYYY-MM-DD" },
      timeFormat: { type: String, default: "12h" },
    },
  },
  {
    timestamps: true,
  }
);

export const Organization: Model<IOrganization> =
  mongoose.models.Organization || mongoose.model<IOrganization>("Organization", OrganizationSchema);
