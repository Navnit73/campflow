import mongoose, { Schema, Document, Model } from "mongoose";
import {
  ElectricHookup,
  ELECTRIC_HOOKUPS,
  RigType,
  RIG_TYPES,
  SiteCategory,
  SITE_CATEGORIES,
  SurfaceType,
  SURFACE_TYPES,
} from "@/lib/constants";

export interface ISite extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  propertyId: mongoose.Types.ObjectId;
  siteTypeId: mongoose.Types.ObjectId;
  siteNumber: string;
  name?: string;
  status: "available" | "maintenance" | "inactive";
  siteTypeSnapshot: {
    name: string;
    category: SiteCategory;
    hookups: {
      electric: ElectricHookup;
      water: boolean;
      sewer: boolean;
    };
    maxRigLength: number;
  };
  currentBaseRate: number;
  surfaceType: SurfaceType;
  rigType: RigType;
  amenities: string[];
  notes?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const SiteSchema = new Schema<ISite>(
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
    siteTypeId: {
      type: Schema.Types.ObjectId,
      ref: "SiteType",
      required: true,
      index: true,
    },
    siteNumber: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["available", "maintenance", "inactive"],
      default: "available",
      required: true,
    },
    siteTypeSnapshot: {
      name: { type: String, required: true },
      category: { type: String, enum: SITE_CATEGORIES, default: "rv_site" },
      hookups: {
        electric: { type: String, enum: ELECTRIC_HOOKUPS, default: "30A" },
        water: { type: Boolean, default: true },
        sewer: { type: Boolean, default: true },
      },
      maxRigLength: { type: Number, default: 40 },
    },
    currentBaseRate: {
      type: Number,
      required: true,
      min: 0,
    },
    surfaceType: {
      type: String,
      enum: SURFACE_TYPES,
      default: "gravel",
    },
    rigType: {
      type: String,
      enum: RIG_TYPES,
      default: "back_in",
    },
    amenities: [{ type: String }],
    notes: {
      type: String,
      default: "",
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

SiteSchema.index({ propertyId: 1, siteNumber: 1 }, { unique: true });
SiteSchema.index({ propertyId: 1, status: 1 });
SiteSchema.index({ propertyId: 1, siteTypeId: 1 });
SiteSchema.index({ organizationId: 1, propertyId: 1 });

export const Site: Model<ISite> =
  mongoose.models.Site || mongoose.model<ISite>("Site", SiteSchema);
