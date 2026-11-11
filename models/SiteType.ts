import mongoose, { Schema, Document, Model } from "mongoose";
import { ElectricHookup, ELECTRIC_HOOKUPS, SiteCategory, SITE_CATEGORIES } from "@/lib/constants";

export interface ISiteType extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  propertyId: mongoose.Types.ObjectId;
  name: string;
  category: SiteCategory;
  hookups: {
    electric: ElectricHookup;
    water: boolean;
    sewer: boolean;
  };
  maxRigLength: number;
  defaultBaseRate: number;
  maxOccupancy: number;
  description?: string;
  photos?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const SiteTypeSchema = new Schema<ISiteType>(
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
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: SITE_CATEGORIES,
      default: "rv_site",
      required: true,
    },
    hookups: {
      electric: {
        type: String,
        enum: ELECTRIC_HOOKUPS,
        default: "30A",
      },
      water: {
        type: Boolean,
        default: true,
      },
      sewer: {
        type: Boolean,
        default: true,
      },
    },
    maxRigLength: {
      type: Number,
      default: 40,
      min: 0,
    },
    defaultBaseRate: {
      type: Number,
      required: true,
      min: 0,
    },
    maxOccupancy: {
      type: Number,
      default: 6,
      min: 1,
    },
    description: {
      type: String,
      default: "",
    },
    photos: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

SiteTypeSchema.index({ propertyId: 1, category: 1 });
SiteTypeSchema.index({ organizationId: 1, propertyId: 1 });

export const SiteType: Model<ISiteType> =
  mongoose.models.SiteType || mongoose.model<ISiteType>("SiteType", SiteTypeSchema);
