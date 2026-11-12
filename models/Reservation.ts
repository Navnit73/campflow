import mongoose, { Schema, Document, Model } from "mongoose";
import {
  ReservationSource,
  RESERVATION_SOURCES,
  ReservationStatus,
  RESERVATION_STATUSES,
} from "@/lib/constants";
import { reservationTokens } from "@/lib/search/tokens";

export interface IReservation extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  propertyId: mongoose.Types.ObjectId;
  confirmationCode: string;
  siteId: mongoose.Types.ObjectId;
  guestId: mongoose.Types.ObjectId;
  siteSnapshot: {
    siteNumber: string;
    siteTypeName: string;
    hookups: {
      electric: string;
      water: boolean;
      sewer: boolean;
    };
    rigType: string;
    baseRate: number;
    /** Weekend (Fri/Sat) nightly rate frozen at booking time, if the site had one. */
    weekendRate?: number;
  };
  guestSnapshot: {
    fullName: string;
    email: string;
    phone: string;
    rvType?: string;
    rvLengthFt?: number;
  };
  checkInDate: Date;
  checkOutDate: Date;
  numNights: number;
  adults: number;
  children: number;
  pets: number;
  status: ReservationStatus;
  addOns?: Array<{
    addOnId?: mongoose.Types.ObjectId;
    name: string;
    price: number;
    pricingType: "per_stay" | "per_night" | "per_unit" | "per_person";
    quantity: number;
    subtotal: number;
    taxable: boolean;
  }>;
  pricing: {
    nightlyRate: number;
    baseSubtotal: number;
    addOnsSubtotal?: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    paidAmount: number;
    balanceDue: number;
  };
  discountId?: mongoose.Types.ObjectId;
  discountCode?: string;
  /** Discount terms frozen at booking time so later edits don't silently re-price. */
  discountSnapshot?: { type: "percentage" | "fixed_amount"; value: number };
  /** Property tax rate frozen at booking time. */
  taxRatePercent?: number;
  /** Normalized word tokens for indexed prefix search (see lib/search/tokens.ts). */
  searchTokens?: string[];
  source: ReservationSource;
  specialRequests?: string;
  checkInTimeActual?: Date;
  checkOutTimeActual?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema = new Schema<IReservation>(
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
    confirmationCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    siteId: {
      type: Schema.Types.ObjectId,
      ref: "Site",
      required: true,
    },
    guestId: {
      type: Schema.Types.ObjectId,
      ref: "Guest",
      required: true,
    },
    siteSnapshot: {
      siteNumber: { type: String, required: true },
      siteTypeName: { type: String, required: true },
      hookups: {
        electric: { type: String, default: "30A" },
        water: { type: Boolean, default: true },
        sewer: { type: Boolean, default: true },
      },
      rigType: { type: String, default: "back_in" },
      baseRate: { type: Number, required: true },
      weekendRate: { type: Number },
    },
    guestSnapshot: {
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      rvType: { type: String, default: "travel_trailer" },
      rvLengthFt: { type: Number, default: 30 },
    },
    checkInDate: {
      type: Date,
      required: true,
    },
    checkOutDate: {
      type: Date,
      required: true,
    },
    numNights: {
      type: Number,
      required: true,
      min: 1,
    },
    adults: {
      type: Number,
      default: 2,
      min: 1,
    },
    children: {
      type: Number,
      default: 0,
      min: 0,
    },
    pets: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: RESERVATION_STATUSES,
      default: "confirmed",
      required: true,
    },
    addOns: [
      {
        addOnId: { type: Schema.Types.ObjectId, ref: "AddOn" },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        pricingType: {
          type: String,
          enum: ["per_stay", "per_night", "per_unit", "per_person"],
          default: "per_stay",
        },
        quantity: { type: Number, default: 1 },
        subtotal: { type: Number, required: true },
        taxable: { type: Boolean, default: true },
      },
    ],
    pricing: {
      nightlyRate: { type: Number, required: true },
      baseSubtotal: { type: Number, required: true },
      addOnsSubtotal: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
      taxAmount: { type: Number, default: 0 },
      totalAmount: { type: Number, required: true },
      paidAmount: { type: Number, default: 0 },
      balanceDue: { type: Number, required: true },
    },
    discountId: {
      type: Schema.Types.ObjectId,
      ref: "Discount",
    },
    discountCode: {
      type: String,
      trim: true,
    },
    discountSnapshot: {
      type: { type: String, enum: ["percentage", "fixed_amount"] },
      value: { type: Number, min: 0 },
    },
    taxRatePercent: {
      type: Number,
      min: 0,
      max: 100,
    },
    searchTokens: {
      type: [String],
      default: undefined,
      select: false,
    },
    source: {
      type: String,
      enum: RESERVATION_SOURCES,
      default: "admin",
      required: true,
    },
    specialRequests: {
      type: String,
      default: "",
    },
    checkInTimeActual: {
      type: Date,
    },
    checkOutTimeActual: {
      type: Date,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Performance & Multi-tenant Compound Indexes
// Unique per organization; confirmationCode first so public lookups by code (with or without
// the organization) are an index seek instead of a scan of the whole property.
ReservationSchema.index({ confirmationCode: 1, organizationId: 1 }, { unique: true });
ReservationSchema.index({ propertyId: 1, checkInDate: 1, checkOutDate: 1 });
// Per-site overlap check on the booking critical path (checkOut > start AND checkIn < end):
// leading with checkOutDate bounds the scan to stays not yet ended; checkIn/status filter in-index.
ReservationSchema.index({ siteId: 1, checkOutDate: 1, checkInDate: 1, status: 1 });
ReservationSchema.index({ propertyId: 1, guestId: 1 });
// Dashboard arrivals / upcoming (status + checkInDate range) and departures (status + checkOutDate range)
ReservationSchema.index({ propertyId: 1, status: 1, checkInDate: 1 });
// Equality → Sort/Range → filter: status equality, then checkOutDate range/sort, with checkInDate
// filtered inside the index (no wasted fetches). Serves the date-window overlap queries (tape chart,
// availability grid, occupancy report), the on-site list sorted by departure and the departures board.
ReservationSchema.index({ propertyId: 1, status: 1, checkOutDate: 1, checkInDate: 1 });
// Recent reservations, reports and exports filtered/sorted by creation time
ReservationSchema.index({ propertyId: 1, createdAt: -1 });
// Reservation list: tenant filter + sort fully in-index; list count answered from the index alone.
ReservationSchema.index({ organizationId: 1, propertyId: 1, checkInDate: -1, createdAt: -1 });


// Indexed word-prefix search within a property (multikey).
ReservationSchema.index({ propertyId: 1, searchTokens: 1 });

// Keep search tokens in sync on create and on document saves that touch searchable fields.
ReservationSchema.pre("save", function () {
  if (this.isNew || this.isModified("guestSnapshot") || this.isModified("siteSnapshot") || this.isModified("confirmationCode")) {
    this.searchTokens = reservationTokens(this);
  }
});

export const Reservation: Model<IReservation> =
  mongoose.models.Reservation || mongoose.model<IReservation>("Reservation", ReservationSchema);
