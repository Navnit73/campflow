import mongoose, { Schema, Document, Model } from "mongoose";
import { RvType, RV_TYPES } from "@/lib/constants";
import { guestTokens } from "@/lib/search/tokens";

export interface IGuest extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  propertyId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  rvDetails: {
    type: RvType;
    lengthFt: number;
    licensePlate?: string;
    state?: string;
    makeModel?: string;
  };
  notes?: string;
  isVip: boolean;
  isBlacklisted: boolean;
  totalStays: number;
  totalSpent: number;
  /** Normalized word tokens for indexed prefix search (see lib/search/tokens.ts). */
  searchTokens?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const GuestSchema = new Schema<IGuest>(
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
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      zip: { type: String, default: "" },
      country: { type: String, default: "USA" },
    },
    rvDetails: {
      type: {
        type: String,
        enum: RV_TYPES,
        default: "travel_trailer",
      },
      lengthFt: {
        type: Number,
        default: 30,
        min: 0,
      },
      licensePlate: { type: String, default: "" },
      state: { type: String, default: "" },
      makeModel: { type: String, default: "" },
    },
    notes: {
      type: String,
      default: "",
    },
    isVip: {
      type: Boolean,
      default: false,
    },
    isBlacklisted: {
      type: Boolean,
      default: false,
    },
    totalStays: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    searchTokens: {
      type: [String],
      default: undefined,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// Unique per organization. Existing deployments: run scripts/migrate-dedupe-guests.ts first
// (it merges historical duplicates, then replaces the old non-unique index with this one).
GuestSchema.index({ organizationId: 1, email: 1 }, { unique: true });
// Guest list (sorted by last update) with an index-only count.
GuestSchema.index({ organizationId: 1, propertyId: 1, updatedAt: -1 });
// Property-scoped counts/distinct and exports sorted by creation.
GuestSchema.index({ propertyId: 1, createdAt: -1 });

// Indexed word-prefix search within a property (multikey).
GuestSchema.index({ organizationId: 1, propertyId: 1, searchTokens: 1 });

GuestSchema.pre("save", function () {
  this.searchTokens = guestTokens(this);
});

// findOneAndUpdate paths (profile edits, staff booking upsert) bypass save(): recompute from the
// stored document afterwards so tokens never drift from the profile.
GuestSchema.post("findOneAndUpdate", async function (doc: (Partial<IGuest> & { _id?: unknown }) | null) {
  if (!doc?._id) return;
  const model = this.model as Model<IGuest>;
  const opts = this.getOptions() as { returnDocument?: string; new?: boolean; projection?: unknown };
  // If the update returned the full post-update document, use it; otherwise re-read (one extra query).
  const isAfter = opts.returnDocument === "after" || opts.new === true;
  const complete = isAfter && !opts.projection && doc.firstName !== undefined && doc.email !== undefined;
  const source = complete ? doc : await model.findById(doc._id).select("firstName lastName email phone rvDetails").lean();
  if (source) await model.updateOne({ _id: doc._id }, { $set: { searchTokens: guestTokens(source) } });
});

export const Guest: Model<IGuest> =
  mongoose.models.Guest || mongoose.model<IGuest>("Guest", GuestSchema);
