import mongoose from "mongoose";
import { Reservation, IReservation } from "@/models/Reservation";
import { Site } from "@/models/Site";
import { Guest } from "@/models/Guest";
import { Property } from "@/models/Property";
import { Discount } from "@/models/Discount";
import { Payment } from "@/models/Payment";
import {
  CreateReservationInput,
  UpdateReservationInput,
  QueryReservationsInput,
} from "@/lib/validations/reservation.schema";
import { calculatePricing } from "@/lib/utils/pricing";
import { generateConfirmationCode } from "@/lib/utils/code-generator";
import { connectDB } from "@/lib/db/connection";
import { parseDateOnly, formatDateKey, addDays } from "@/lib/utils/date";

export class ReservationService {
  static async checkSiteAvailability(
    propertyId: string | mongoose.Types.ObjectId,
    siteId: string | mongoose.Types.ObjectId,
    checkInDate: Date | string,
    checkOutDate: Date | string,
    excludeReservationId?: string | mongoose.Types.ObjectId
  ): Promise<boolean> {
    await connectDB();

    const dIn = parseDateOnly(checkInDate);
    const dOut = parseDateOnly(checkOutDate);

    const query: Record<string, any> = {
      propertyId: new mongoose.Types.ObjectId(propertyId),
      siteId: new mongoose.Types.ObjectId(siteId),
      status: { $in: ["confirmed", "checked_in", "pending"] },
      checkInDate: { $lt: dOut },
      checkOutDate: { $gt: dIn },
    };

    if (excludeReservationId) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeReservationId) };
    }

    const conflicting = await Reservation.findOne(query).lean();
    return !conflicting;
  }

  static async checkAllSitesAvailability(
    organizationId: string,
    propertyId: string,
    checkInDate: Date | string,
    checkOutDate: Date | string,
    excludeReservationId?: string | mongoose.Types.ObjectId
  ) {
    await connectDB();

    const dIn = parseDateOnly(checkInDate);
    const dOut = parseDateOnly(checkOutDate);

    const [sites, reservations] = await Promise.all([
      Site.find({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        propertyId: new mongoose.Types.ObjectId(propertyId),
      })
        .sort({ sortOrder: 1, siteNumber: 1 })
        .lean(),
      Reservation.find({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        propertyId: new mongoose.Types.ObjectId(propertyId),
        status: { $in: ["confirmed", "checked_in", "pending"] },
        checkInDate: { $lt: dOut },
        checkOutDate: { $gt: dIn },
        ...(excludeReservationId ? { _id: { $ne: new mongoose.Types.ObjectId(excludeReservationId) } } : {}),
      })
        .select("siteId confirmationCode guestSnapshot checkInDate checkOutDate status")
        .lean(),
    ]);

    const conflictMap = new Map<string, any>();
    reservations.forEach((r) => {
      const sId = r.siteId?.toString();
      if (sId) conflictMap.set(sId, r);
    });

    return sites.map((site) => {
      const conflict = conflictMap.get(site._id.toString());
      const isOffline = site.status === "maintenance" || site.status === "inactive";
      const isAvailable = !conflict && !isOffline;

      return {
        ...site,
        isAvailable,
        isOffline,
        conflictReason: conflict
          ? `Booked by ${conflict.guestSnapshot?.fullName || "Guest"} (${conflict.confirmationCode})`
          : isOffline
          ? `Site is currently ${site.status}`
          : null,
        conflictingReservation: conflict || null,
      };
    });
  }

  static async createReservation(
    organizationId: string,
    propertyId: string,
    input: CreateReservationInput,
    userId?: string
  ) {
    await connectDB();

    const dIn = parseDateOnly(input.checkInDate);
    const dOut = parseDateOnly(input.checkOutDate);

    if (dOut <= dIn) {
      const err = new Error("Check-out date must be after check-in date");
      err.name = "ValidationError";
      throw err;
    }

    // 1. Check Site
    const site = await Site.findOne({
      _id: new mongoose.Types.ObjectId(input.siteId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    }).lean();

    if (!site) {
      const err = new Error("Selected Site was not found");
      err.name = "NotFoundError";
      throw err;
    }

    if (site.status === "maintenance" || site.status === "inactive") {
      const err = new Error(`Site ${site.siteNumber} is currently under ${site.status} and unavailable.`);
      err.name = "ConflictError";
      throw err;
    }

    // Check Availability
    const isAvailable = await this.checkSiteAvailability(propertyId, site._id, dIn, dOut);
    if (!isAvailable) {
      const err = new Error(`Site ${site.siteNumber} is already booked for the selected dates.`);
      err.name = "ConflictError";
      throw err;
    }

    // 2. Lookup or Create Guest
    let guestId: mongoose.Types.ObjectId;
    let guestSnapshot: any;

    if (input.guestId) {
      const existingGuest = await Guest.findOne({
        _id: new mongoose.Types.ObjectId(input.guestId),
        organizationId: new mongoose.Types.ObjectId(organizationId),
      }).lean();

      if (!existingGuest) {
        const err = new Error("Guest profile not found");
        err.name = "NotFoundError";
        throw err;
      }

      guestId = existingGuest._id;
      guestSnapshot = {
        fullName: `${existingGuest.firstName} ${existingGuest.lastName}`,
        email: existingGuest.email,
        phone: existingGuest.phone,
        rvType: existingGuest.rvDetails?.type || "travel_trailer",
        rvLengthFt: existingGuest.rvDetails?.lengthFt || 30,
      };
    } else if (input.guest) {
      // Find by email or create new
      let guest = await Guest.findOne({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        email: input.guest.email.toLowerCase().trim(),
      });

      if (!guest) {
        guest = await Guest.create({
          organizationId: new mongoose.Types.ObjectId(organizationId),
          propertyId: new mongoose.Types.ObjectId(propertyId),
          firstName: input.guest.firstName.trim(),
          lastName: input.guest.lastName.trim(),
          email: input.guest.email.toLowerCase().trim(),
          phone: input.guest.phone.trim(),
          rvDetails: {
            type: input.guest.rvType || "travel_trailer",
            lengthFt: input.guest.rvLengthFt || 30,
            licensePlate: input.guest.licensePlate || "",
          },
        });
      } else {
        // Update contact or vehicle if provided
        guest.firstName = input.guest.firstName.trim();
        guest.lastName = input.guest.lastName.trim();
        guest.phone = input.guest.phone.trim();
        if (input.guest.rvType) guest.rvDetails.type = input.guest.rvType;
        if (input.guest.rvLengthFt) guest.rvDetails.lengthFt = input.guest.rvLengthFt;
        if (input.guest.licensePlate) guest.rvDetails.licensePlate = input.guest.licensePlate;
        await guest.save();
      }

      guestId = guest._id;
      guestSnapshot = {
        fullName: `${guest.firstName} ${guest.lastName}`,
        email: guest.email,
        phone: guest.phone,
        rvType: guest.rvDetails?.type || "travel_trailer",
        rvLengthFt: guest.rvDetails?.lengthFt || 30,
      };
    } else {
      const err = new Error("Guest information is required");
      err.name = "ValidationError";
      throw err;
    }

    // 3. Property & Pricing
    const property = await Property.findById(propertyId).lean();
    const taxRate = property?.taxRatePercent || 0;

    let discountDoc: any = null;
    if (input.discountCode) {
      discountDoc = await Discount.findOne({
        propertyId: new mongoose.Types.ObjectId(propertyId),
        code: input.discountCode.toUpperCase().trim(),
        isActive: true,
      }).lean();
    }

    const pricing = calculatePricing({
      nightlyRate: site.currentBaseRate,
      checkInDate: dIn,
      checkOutDate: dOut,
      taxRatePercent: taxRate,
      discountType: discountDoc?.type,
      discountValue: discountDoc?.value,
      paidAmount: input.initialPayment ? input.initialPayment.amount : 0,
    });

    // 4. Generate unique confirmation code
    let confirmationCode = generateConfirmationCode();
    while (
      await Reservation.findOne({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        confirmationCode,
      })
    ) {
      confirmationCode = generateConfirmationCode();
    }

    const reservation = await Reservation.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
      confirmationCode,
      siteId: site._id,
      guestId,
      siteSnapshot: {
        siteNumber: site.siteNumber,
        siteTypeName: site.siteTypeSnapshot.name,
        hookups: site.siteTypeSnapshot.hookups,
        rigType: site.rigType,
        baseRate: site.currentBaseRate,
      },
      guestSnapshot,
      checkInDate: dIn,
      checkOutDate: dOut,
      numNights: pricing.numNights,
      adults: input.adults || 2,
      children: input.children || 0,
      pets: input.pets || 0,
      status: input.status || "confirmed",
      pricing,
      discountId: discountDoc?._id,
      discountCode: discountDoc?.code,
      source: input.source || "admin",
      specialRequests: input.specialRequests || "",
      notes: input.notes || "",
    });

    // 5. If initial payment provided, record Payment
    if (input.initialPayment && input.initialPayment.amount > 0) {
      await Payment.create({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        propertyId: new mongoose.Types.ObjectId(propertyId),
        reservationId: reservation._id,
        guestId,
        amount: input.initialPayment.amount,
        currency: property?.currency || "USD",
        method: input.initialPayment.method,
        status: "completed",
        notes: input.initialPayment.notes || "Initial reservation payment",
        processedByUserId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      });

      // Increment guest total spent & stays
      await Guest.findByIdAndUpdate(guestId, {
        $inc: { totalStays: 1, totalSpent: input.initialPayment.amount },
      });
    } else {
      await Guest.findByIdAndUpdate(guestId, {
        $inc: { totalStays: 1 },
      });
    }

    if (discountDoc) {
      await Discount.findByIdAndUpdate(discountDoc._id, { $inc: { usageCount: 1 } });
    }

    return reservation.toObject();
  }

  static async getReservationById(organizationId: string, propertyId: string, reservationId: string) {
    await connectDB();

    const reservation = await Reservation.findOne({
      _id: new mongoose.Types.ObjectId(reservationId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    }).lean();

    if (!reservation) {
      const err = new Error("Reservation not found");
      err.name = "NotFoundError";
      throw err;
    }

    const [payments, site, guest] = await Promise.all([
      Payment.find({ reservationId: reservation._id }).sort({ createdAt: -1 }).lean(),
      Site.findById(reservation.siteId).lean(),
      Guest.findById(reservation.guestId).lean(),
    ]);

    return {
      ...reservation,
      payments,
      site,
      guest,
    };
  }

  static async updateReservation(
    organizationId: string,
    propertyId: string,
    reservationId: string,
    input: UpdateReservationInput
  ) {
    await connectDB();

    const reservation = await Reservation.findOne({
      _id: new mongoose.Types.ObjectId(reservationId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    });

    if (!reservation) {
      const err = new Error("Reservation not found");
      err.name = "NotFoundError";
      throw err;
    }

    const newCheckIn = input.checkInDate ? parseDateOnly(input.checkInDate) : parseDateOnly(reservation.checkInDate);
    const newCheckOut = input.checkOutDate ? parseDateOnly(input.checkOutDate) : parseDateOnly(reservation.checkOutDate);
    const newSiteId = input.siteId ? new mongoose.Types.ObjectId(input.siteId) : reservation.siteId;

    if (newCheckOut <= newCheckIn) {
      const err = new Error("Check-out date must be after check-in date");
      err.name = "ValidationError";
      throw err;
    }

    // If dates or site changed, verify availability
    if (
      input.siteId ||
      input.checkInDate ||
      input.checkOutDate
    ) {
      const site = await Site.findById(newSiteId).lean();
      if (!site) {
        const err = new Error("Selected site was not found.");
        err.name = "NotFoundError";
        throw err;
      }

      if (site.status === "maintenance" || site.status === "inactive") {
        const err = new Error(`Site ${site.siteNumber} is currently under ${site.status} and unavailable.`);
        err.name = "ConflictError";
        throw err;
      }

      const isAvail = await this.checkSiteAvailability(
        propertyId,
        newSiteId,
        newCheckIn,
        newCheckOut,
        reservation._id
      );

      if (!isAvail) {
        const err = new Error("The selected site is not available for these dates.");
        err.name = "ConflictError";
        throw err;
      }

      // If site changed, update site snapshot
      if (input.siteId && input.siteId !== reservation.siteId.toString()) {
        reservation.siteId = site._id;
        reservation.siteSnapshot = {
          siteNumber: site.siteNumber,
          siteTypeName: site.siteTypeSnapshot.name,
          hookups: site.siteTypeSnapshot.hookups,
          rigType: site.rigType,
          baseRate: site.currentBaseRate,
        };
      }

      reservation.checkInDate = newCheckIn;
      reservation.checkOutDate = newCheckOut;

      // Recalculate pricing
      const property = await Property.findById(propertyId).lean();
      let discountDoc: any = null;
      if (input.discountCode || reservation.discountCode) {
        discountDoc = await Discount.findOne({
          propertyId: new mongoose.Types.ObjectId(propertyId),
          code: (input.discountCode || reservation.discountCode || "").toUpperCase().trim(),
          isActive: true,
        }).lean();
      }

      const pricing = calculatePricing({
        nightlyRate: reservation.siteSnapshot.baseRate,
        checkInDate: newCheckIn,
        checkOutDate: newCheckOut,
        taxRatePercent: property?.taxRatePercent || 0,
        discountType: discountDoc?.type,
        discountValue: discountDoc?.value,
        paidAmount: reservation.pricing.paidAmount,
      });

      reservation.numNights = pricing.numNights;
      reservation.pricing = pricing;
      if (discountDoc) {
        reservation.discountId = discountDoc._id;
        reservation.discountCode = discountDoc.code;
      }
    }

    if (input.guestSnapshot) {
      reservation.guestSnapshot = {
        fullName: input.guestSnapshot.fullName || reservation.guestSnapshot.fullName,
        email: input.guestSnapshot.email || reservation.guestSnapshot.email,
        phone: input.guestSnapshot.phone || reservation.guestSnapshot.phone,
        rvType: input.guestSnapshot.rvType || reservation.guestSnapshot.rvType,
        rvLengthFt: input.guestSnapshot.rvLengthFt ?? reservation.guestSnapshot.rvLengthFt,
      };
    }

    if (input.adults !== undefined) reservation.adults = input.adults;
    if (input.children !== undefined) reservation.children = input.children;
    if (input.pets !== undefined) reservation.pets = input.pets;
    if (input.status !== undefined) reservation.status = input.status;
    if (input.specialRequests !== undefined) reservation.specialRequests = input.specialRequests;
    if (input.notes !== undefined) reservation.notes = input.notes;

    await reservation.save();
    return reservation.toObject();
  }

  static async checkIn(organizationId: string, propertyId: string, reservationId: string) {
    await connectDB();

    const reservation = await Reservation.findOne({
      _id: new mongoose.Types.ObjectId(reservationId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    });

    if (!reservation) {
      const err = new Error("Reservation not found");
      err.name = "NotFoundError";
      throw err;
    }

    if (reservation.status === "checked_in") {
      return reservation.toObject();
    }

    reservation.status = "checked_in";
    reservation.checkInTimeActual = new Date();
    await reservation.save();

    return reservation.toObject();
  }

  static async checkOut(organizationId: string, propertyId: string, reservationId: string) {
    await connectDB();

    const reservation = await Reservation.findOne({
      _id: new mongoose.Types.ObjectId(reservationId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    });

    if (!reservation) {
      const err = new Error("Reservation not found");
      err.name = "NotFoundError";
      throw err;
    }

    reservation.status = "checked_out";
    reservation.checkOutTimeActual = new Date();
    await reservation.save();

    return reservation.toObject();
  }

  static async cancelReservation(organizationId: string, propertyId: string, reservationId: string, notes?: string) {
    await connectDB();

    const reservation = await Reservation.findOne({
      _id: new mongoose.Types.ObjectId(reservationId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    });

    if (!reservation) {
      const err = new Error("Reservation not found");
      err.name = "NotFoundError";
      throw err;
    }

    reservation.status = "cancelled";
    if (notes) reservation.notes = (reservation.notes ? reservation.notes + "\n" : "") + `[Cancelled]: ${notes}`;
    await reservation.save();

    return reservation.toObject();
  }

  static async listReservations(organizationId: string, propertyId: string, options: QueryReservationsInput) {
    await connectDB();

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    };

    if (options.status && options.status !== "all") {
      query.status = options.status;
    }

    if (options.siteId) {
      query.siteId = new mongoose.Types.ObjectId(options.siteId);
    }

    if (options.startDate || options.endDate) {
      query.checkInDate = {};
      if (options.startDate) {
        query.checkInDate.$gte = new Date(options.startDate + "T00:00:00Z");
      }
      if (options.endDate) {
        query.checkInDate.$lte = new Date(options.endDate + "T23:59:59Z");
      }
    }

    if (options.search && options.search.trim()) {
      const search = options.search.trim();
      query.$or = [
        { confirmationCode: { $regex: search, $options: "i" } },
        { "guestSnapshot.fullName": { $regex: search, $options: "i" } },
        { "guestSnapshot.email": { $regex: search, $options: "i" } },
        { "guestSnapshot.phone": { $regex: search, $options: "i" } },
        { "siteSnapshot.siteNumber": { $regex: search, $options: "i" } },
      ];
    }

    const [reservations, total] = await Promise.all([
      Reservation.find(query)
        .sort({ checkInDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Reservation.countDocuments(query),
    ]);

    return {
      reservations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getTapeChartData(organizationId: string, propertyId: string, startDateStr: string, days = 14) {
    await connectDB();

    const startDate = parseDateOnly(startDateStr);
    const endDate = addDays(startDate, days);

    const [sites, reservations] = await Promise.all([
      Site.find({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        propertyId: new mongoose.Types.ObjectId(propertyId),
        status: { $ne: "inactive" },
      })
        .sort({ sortOrder: 1, siteNumber: 1 })
        .lean(),
      Reservation.find({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        propertyId: new mongoose.Types.ObjectId(propertyId),
        status: { $in: ["confirmed", "checked_in", "pending", "checked_out"] },
        checkInDate: { $lt: endDate },
        checkOutDate: { $gt: startDate },
      })
        .select("confirmationCode siteId guestId guestSnapshot siteSnapshot checkInDate checkOutDate status pricing numNights adults children")
        .lean(),
    ]);

    return {
      startDate: formatDateKey(startDate),
      days,
      sites,
      reservations,
    };
  }
}
