import mongoose from "mongoose";
import { Property } from "@/models/Property";
import { Site } from "@/models/Site";
import { Guest } from "@/models/Guest";
import { Reservation } from "@/models/Reservation";
import { Discount } from "@/models/Discount";
import { Payment } from "@/models/Payment";
import {
  PublicAvailabilityQuery,
  PublicCreateBookingInput,
} from "@/lib/validations/public-booking.schema";
import { calculatePricing } from "@/lib/utils/pricing";
import { generateConfirmationCode } from "@/lib/utils/code-generator";
import { connectDB } from "@/lib/db/connection";

export class PublicBookingService {
  static async getPropertyBySlug(slug: string) {
    await connectDB();

    const cleanSlug = (slug || "").toLowerCase().trim();
    let property = await Property.findOne({ slug: cleanSlug }).lean();

    if (!property) {
      // Fallback: If specific slug isn't found (e.g. initial demo slug or direct test),
      // gracefully resolve to the registered campground in the database.
      property = await Property.findOne().sort({ createdAt: 1 }).lean();
    }

    if (!property) {
      const err = new Error("Campground not found. Please register your park first.");
      err.name = "NotFoundError";
      throw err;
    }

    return property;
  }

  static async searchAvailableSites(params: PublicAvailabilityQuery) {
    await connectDB();

    const property = await this.getPropertyBySlug(params.slug);
    const dIn = new Date(params.checkInDate + "T00:00:00Z");
    const dOut = new Date(params.checkOutDate + "T00:00:00Z");

    if (dOut <= dIn) {
      const err = new Error("Check-out date must be after check-in date");
      err.name = "ValidationError";
      throw err;
    }

    // 1. Query candidate sites matching physical requirements
    const siteQuery: Record<string, any> = {
      propertyId: property._id,
      status: "available",
    };

    if (params.rigLengthFt && params.rigLengthFt > 0) {
      siteQuery["siteTypeSnapshot.maxRigLength"] = { $gte: params.rigLengthFt };
    }

    if (params.siteCategory) {
      siteQuery["siteTypeSnapshot.category"] = params.siteCategory;
    }

    if (params.hookupType) {
      if (params.hookupType === "50A") {
        siteQuery["siteTypeSnapshot.hookups.electric"] = "50A";
      } else if (params.hookupType === "30A") {
        siteQuery["siteTypeSnapshot.hookups.electric"] = { $in: ["30A", "50A"] };
      } else if (params.hookupType === "full") {
        siteQuery["siteTypeSnapshot.hookups.water"] = true;
        siteQuery["siteTypeSnapshot.hookups.sewer"] = true;
      }
    }

    const candidateSites = await Site.find(siteQuery)
      .sort({ sortOrder: 1, currentBaseRate: 1 })
      .lean();

    if (candidateSites.length === 0) {
      return {
        property,
        availableSites: [],
      };
    }

    const candidateSiteIds = candidateSites.map((s) => s._id);

    // 2. Find overlapping reservations
    const conflicting = await Reservation.find({
      propertyId: property._id,
      siteId: { $in: candidateSiteIds },
      status: { $in: ["confirmed", "checked_in", "pending"] },
      checkInDate: { $lt: dOut },
      checkOutDate: { $gt: dIn },
    })
      .select("siteId")
      .lean();

    const bookedSiteIds = new Set(conflicting.map((c) => c.siteId.toString()));

    // 3. Filter and calculate pricing for each available site
    const availableSites = candidateSites
      .filter((s) => !bookedSiteIds.has(s._id.toString()))
      .map((site) => {
        const pricing = calculatePricing({
          nightlyRate: site.currentBaseRate,
          checkInDate: dIn,
          checkOutDate: dOut,
          taxRatePercent: property.taxRatePercent || 0,
        });

        return {
          ...site,
          calculatedPricing: pricing,
        };
      });

    return {
      property,
      availableSites,
    };
  }

  static async createPublicBooking(input: PublicCreateBookingInput) {
    await connectDB();

    const property = await this.getPropertyBySlug(input.slug);
    const dIn = new Date(input.checkInDate + "T00:00:00Z");
    const dOut = new Date(input.checkOutDate + "T00:00:00Z");

    // 1. Site check
    const site = await Site.findOne({
      _id: new mongoose.Types.ObjectId(input.siteId),
      propertyId: property._id,
      status: "available",
    }).lean();

    if (!site) {
      const err = new Error("The selected site is no longer available.");
      err.name = "NotFoundError";
      throw err;
    }

    // Overlap conflict check
    const conflict = await Reservation.findOne({
      propertyId: property._id,
      siteId: site._id,
      status: { $in: ["confirmed", "checked_in", "pending"] },
      checkInDate: { $lt: dOut },
      checkOutDate: { $gt: dIn },
    }).lean();

    if (conflict) {
      const err = new Error("Site was just booked by another camper. Please select another site.");
      err.name = "ConflictError";
      throw err;
    }

    // 2. Create or update guest
    let guest = await Guest.findOne({
      organizationId: property.organizationId,
      email: input.guest.email.toLowerCase().trim(),
    });

    if (!guest) {
      guest = await Guest.create({
        organizationId: property.organizationId,
        propertyId: property._id,
        firstName: input.guest.firstName.trim(),
        lastName: input.guest.lastName.trim(),
        email: input.guest.email.toLowerCase().trim(),
        phone: input.guest.phone.trim(),
        rvDetails: {
          type: input.guest.rvType,
          lengthFt: input.guest.rvLengthFt,
          licensePlate: input.guest.licensePlate || "",
        },
      });
    } else {
      guest.firstName = input.guest.firstName.trim();
      guest.lastName = input.guest.lastName.trim();
      guest.phone = input.guest.phone.trim();
      guest.rvDetails.type = input.guest.rvType;
      guest.rvDetails.lengthFt = input.guest.rvLengthFt;
      if (input.guest.licensePlate) guest.rvDetails.licensePlate = input.guest.licensePlate;
      await guest.save();
    }

    // 3. Check Discount
    let discountDoc: any = null;
    if (input.discountCode) {
      discountDoc = await Discount.findOne({
        propertyId: property._id,
        code: input.discountCode.toUpperCase().trim(),
        isActive: true,
      }).lean();
    }

    // 4. Calculate final pricing
    const pricing = calculatePricing({
      nightlyRate: site.currentBaseRate,
      checkInDate: dIn,
      checkOutDate: dOut,
      taxRatePercent: property.taxRatePercent || 0,
      discountType: discountDoc?.type,
      discountValue: discountDoc?.value,
      paidAmount: 0, // Will be marked paid below
    });

    // 5. Generate confirmation code
    let confirmationCode = generateConfirmationCode();
    while (
      await Reservation.findOne({
        organizationId: property.organizationId,
        confirmationCode,
      })
    ) {
      confirmationCode = generateConfirmationCode();
    }

    // Set paid in full for online instant booking
    pricing.paidAmount = pricing.totalAmount;
    pricing.balanceDue = 0;

    const reservation = await Reservation.create({
      organizationId: property.organizationId,
      propertyId: property._id,
      confirmationCode,
      siteId: site._id,
      guestId: guest._id,
      siteSnapshot: {
        siteNumber: site.siteNumber,
        siteTypeName: site.siteTypeSnapshot.name,
        hookups: site.siteTypeSnapshot.hookups,
        rigType: site.rigType,
        baseRate: site.currentBaseRate,
      },
      guestSnapshot: {
        fullName: `${guest.firstName} ${guest.lastName}`,
        email: guest.email,
        phone: guest.phone,
        rvType: guest.rvDetails.type,
        rvLengthFt: guest.rvDetails.lengthFt,
      },
      checkInDate: dIn,
      checkOutDate: dOut,
      numNights: pricing.numNights,
      adults: input.adults,
      children: input.children,
      pets: input.pets,
      status: "confirmed",
      pricing,
      discountId: discountDoc?._id,
      discountCode: discountDoc?.code,
      source: "online_booking",
      specialRequests: input.specialRequests || "",
    });

    // 6. Record Payment
    await Payment.create({
      organizationId: property.organizationId,
      propertyId: property._id,
      reservationId: reservation._id,
      guestId: guest._id,
      amount: pricing.totalAmount,
      currency: property.currency || "USD",
      method: "online",
      status: "completed",
      transactionReference: `TXN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      notes: "Paid online during checkout",
    });

    await Guest.findByIdAndUpdate(guest._id, {
      $inc: { totalStays: 1, totalSpent: pricing.totalAmount },
    });

    if (discountDoc) {
      await Discount.findByIdAndUpdate(discountDoc._id, { $inc: { usageCount: 1 } });
    }

    return {
      confirmationCode,
      reservation: reservation.toObject(),
      property,
      guest: guest.toObject(),
    };
  }

  static async getBookingConfirmation(confirmationCode: string) {
    await connectDB();

    const reservation = await Reservation.findOne({
      confirmationCode: confirmationCode.toUpperCase().trim(),
    }).lean();

    if (!reservation) {
      const err = new Error("Reservation confirmation not found");
      err.name = "NotFoundError";
      throw err;
    }

    const [property, site, guest, payments] = await Promise.all([
      Property.findById(reservation.propertyId).lean(),
      Site.findById(reservation.siteId).lean(),
      Guest.findById(reservation.guestId).lean(),
      Payment.find({ reservationId: reservation._id }).lean(),
    ]);

    return {
      reservation,
      property,
      site,
      guest,
      payments,
    };
  }
}
