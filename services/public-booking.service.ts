import mongoose from "mongoose";
import { Property } from "@/models/Property";
import { Site } from "@/models/Site";
import { Guest } from "@/models/Guest";
import { Reservation } from "@/models/Reservation";
import { Payment } from "@/models/Payment";
import { AddOn } from "@/models/AddOn";
import {
  PublicAvailabilityQuery,
  PublicCreateBookingInput,
} from "@/lib/validations/public-booking.schema";
import { calculatePricing, AddOnPricingInput } from "@/lib/utils/pricing";
import { connectDB } from "@/lib/db/connection";
import { cached, propertyScope } from "@/lib/cache";

/** Public catalog data (property profile, active add-ons). Availability is never cached. */
const PUBLIC_CATALOG_TTL_MS = 5 * 60_000;
import { addDays, diffDays, parseDateOnly } from "@/lib/utils/date";
import { MailService } from "@/services/mail.service";
import { commitBooking } from "@/services/reservation.service";
import { BLOCKING_STATUSES } from "@/lib/booking/status";
import { resolveDiscountCode } from "@/lib/booking/discount";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import {
  publicAddOn,
  publicGuest,
  publicPayment,
  publicProperty,
  publicReservation,
  publicSite,
} from "@/lib/booking/public-dto";

const MAX_ONLINE_STAY_NIGHTS = 365;
const MAX_ADDON_QUANTITY = 50;

function validateStayDates(dIn: Date, dOut: Date) {
  if (dOut <= dIn) throw new ValidationError("Check-out date must be after check-in date");
  // Allow "yesterday" (UTC) so guests in timezones behind UTC can still book "today".
  const earliest = addDays(new Date(), -1);
  if (dIn < earliest) throw new ValidationError("Check-in date cannot be in the past", { checkInDate: "Date is in the past" });
  if (diffDays(dIn, dOut) > MAX_ONLINE_STAY_NIGHTS) {
    throw new ValidationError(`Online stays are limited to ${MAX_ONLINE_STAY_NIGHTS} nights`);
  }
}

export class PublicBookingService {
  /** Resolves a property strictly by slug. (The old fallback to "the first property" leaked other tenants.) */
  static async getPropertyBySlug(slug: string) {
    await connectDB();
    const cleanSlug = (slug || "").toLowerCase().trim();
    if (!cleanSlug) throw new NotFoundError("Campground not found");
    // Read on every public request; changes rarely. Not-found results are never cached (loader throws).
    return cached("property-by-slug", `slug:${cleanSlug}`, "", PUBLIC_CATALOG_TTL_MS, async () => {
      const property = await Property.findOne({ slug: cleanSlug }).lean();
      if (!property) throw new NotFoundError("Campground not found");
      return property;
    });
  }

  static async searchAvailableSites(params: PublicAvailabilityQuery) {
    await connectDB();

    const property = await this.getPropertyBySlug(params.slug);
    const dIn = parseDateOnly(params.checkInDate);
    const dOut = parseDateOnly(params.checkOutDate);
    if (dOut <= dIn) throw new ValidationError("Check-out date must be after check-in date");

    const siteQuery: Record<string, unknown> = { propertyId: property._id, status: "available" };
    if (params.rigLengthFt && params.rigLengthFt > 0) {
      siteQuery["siteTypeSnapshot.maxRigLength"] = { $gte: params.rigLengthFt };
    }
    if (params.siteCategory) siteQuery["siteTypeSnapshot.category"] = String(params.siteCategory);
    if (params.hookupType === "50A") {
      siteQuery["siteTypeSnapshot.hookups.electric"] = "50A";
    } else if (params.hookupType === "30A") {
      siteQuery["siteTypeSnapshot.hookups.electric"] = { $in: ["30A", "50A"] };
    } else if (params.hookupType === "full") {
      siteQuery["siteTypeSnapshot.hookups.water"] = true;
      siteQuery["siteTypeSnapshot.hookups.sewer"] = true;
    }
    if (params.pets && params.pets > 0) siteQuery.petFriendly = true;

    // Sites, add-ons and conflicting reservations are independent → one round trip.
    const [candidateSites, availableAddOns, conflicting] = await Promise.all([
      Site.find(siteQuery).sort({ sortOrder: 1, currentBaseRate: 1 }).lean(),
      cached("public-addons", propertyScope(property._id), "", PUBLIC_CATALOG_TTL_MS, () =>
        AddOn.find({ propertyId: property._id, isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean()
      ),
      Reservation.find({
        propertyId: property._id,
        status: { $in: BLOCKING_STATUSES },
        checkInDate: { $lt: dOut },
        checkOutDate: { $gt: dIn },
      })
        .select("siteId")
        .lean(),
    ]);

    const bookedSiteIds = new Set(conflicting.map((c) => c.siteId.toString()));
    const availableSites = candidateSites
      .filter((s) => !bookedSiteIds.has(s._id.toString()))
      .map((site) =>
        publicSite({
          ...site,
          calculatedPricing: calculatePricing({
            nightlyRate: site.currentBaseRate,
            checkInDate: dIn,
            checkOutDate: dOut,
            taxRatePercent: property.taxRatePercent || 0,
          }),
        })
      );

    return {
      property: publicProperty(property),
      availableSites,
      availableAddOns: availableAddOns.map(publicAddOn),
    };
  }

  /**
   * Prices add-ons from the database. Client-supplied price/pricingType/taxable/name are ignored:
   * only {addOnId, quantity} are trusted.
   */
  private static async priceAddOnsFromCatalog(
    propertyId: mongoose.Types.ObjectId,
    requested: PublicCreateBookingInput["addOns"]
  ): Promise<AddOnPricingInput[]> {
    if (!requested?.length) return [];

    if (requested.some((a) => !a.addOnId || !mongoose.isValidObjectId(a.addOnId))) {
      throw new ValidationError("Each add-on must reference a valid service", { addOns: "Unknown add-on" });
    }
    const ids = requested.map((a) => new mongoose.Types.ObjectId(a.addOnId as string));

    const catalog = await AddOn.find({ _id: { $in: ids }, propertyId, isActive: true })
      .select("name price pricingType taxable")
      .lean();
    const byId = new Map(catalog.map((a) => [a._id.toString(), a]));

    return requested.map((req) => {
      const item = byId.get(String(req.addOnId));
      if (!item) throw new ValidationError("One or more selected services are no longer available", { addOns: "Unavailable add-on" });
      return {
        addOnId: item._id.toString(),
        name: item.name,
        price: item.price,
        pricingType: item.pricingType,
        taxable: item.taxable,
        quantity: Math.min(MAX_ADDON_QUANTITY, Math.max(1, Math.floor(Number(req.quantity) || 1))),
      };
    });
  }

  static async createPublicBooking(input: PublicCreateBookingInput) {
    await connectDB();

    const property = await this.getPropertyBySlug(input.slug);
    const dIn = parseDateOnly(input.checkInDate);
    const dOut = parseDateOnly(input.checkOutDate);
    validateStayDates(dIn, dOut);

    if (!mongoose.isValidObjectId(input.siteId)) throw new NotFoundError("The selected site is no longer available.");
    const email = input.guest.email.toLowerCase().trim();

    const [site, existingGuest, addOns, discount] = await Promise.all([
      Site.findOne({ _id: new mongoose.Types.ObjectId(input.siteId), propertyId: property._id, status: "available" }).lean(),
      Guest.findOne({ organizationId: property.organizationId, email }).select("_id isBlacklisted").lean(),
      this.priceAddOnsFromCatalog(property._id, input.addOns),
      input.discountCode ? resolveDiscountCode(property._id, input.discountCode) : Promise.resolve(null),
    ]);

    if (!site) throw new NotFoundError("The selected site is no longer available or under maintenance.");

    const rigLength = Number(input.guest.rvLengthFt) || 0;
    const maxRig = site.siteTypeSnapshot?.maxRigLength || 0;
    if (maxRig > 0 && rigLength > maxRig) {
      throw new ValidationError(`Your rig (${rigLength} ft) exceeds this site's maximum length of ${maxRig} ft.`, {
        "guest.rvLengthFt": `Max ${maxRig} ft`,
      });
    }
    if ((input.pets || 0) > 0 && site.petFriendly === false) {
      throw new ValidationError("This site does not allow pets. Please choose a pet-friendly site.", { pets: "Not allowed" });
    }
    if (existingGuest?.isBlacklisted) {
      throw new ForbiddenError("We're unable to complete this booking online. Please contact the park directly.");
    }

    // The anonymous flow never overwrites an existing guest profile (anyone can type any email).
    // Submitted details are stored on the reservation snapshot instead.
    let guestId = existingGuest?._id;
    if (!guestId) {
      try {
        const created = await Guest.create({
          organizationId: property.organizationId,
          propertyId: property._id,
          firstName: input.guest.firstName.trim(),
          lastName: input.guest.lastName.trim(),
          email,
          phone: input.guest.phone.trim(),
          rvDetails: {
            type: input.guest.rvType,
            lengthFt: input.guest.rvLengthFt,
            licensePlate: input.guest.licensePlate || "",
          },
        });
        guestId = created._id;
      } catch (err: unknown) {
        if ((err as { code?: number })?.code !== 11000) throw err;
        const raced = await Guest.findOne({ organizationId: property.organizationId, email }).select("_id").lean();
        guestId = raced!._id;
      }
    }

    const guestSnapshot = {
      fullName: `${input.guest.firstName.trim()} ${input.guest.lastName.trim()}`,
      email,
      phone: input.guest.phone.trim(),
      rvType: input.guest.rvType,
      rvLengthFt: input.guest.rvLengthFt,
    };

    const taxRate = property.taxRatePercent || 0;
    const pricing = calculatePricing({
      nightlyRate: site.currentBaseRate,
      checkInDate: dIn,
      checkOutDate: dOut,
      adults: input.adults || 2,
      taxRatePercent: taxRate,
      discountType: discount?.type,
      discountValue: discount?.value,
      // No payment is captured online yet (no gateway integration), so the full amount is due.
      // Previously a fake "completed" payment with a made-up TXN reference was recorded.
      paidAmount: 0,
      addOns,
    });

    const reservation = await commitBooking({
      siteId: site._id,
      propertyId: property._id,
      checkInDate: dIn,
      checkOutDate: dOut,
      checkAvailability: true,
      conflictMessage: "Site was just booked by another camper. Please select another site.",
      doc: {
        organizationId: property.organizationId,
        propertyId: property._id,
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
        adults: input.adults,
        children: input.children,
        pets: input.pets,
        addOns: pricing.calculatedAddOns.map((a) => ({
          addOnId: a.addOnId ? new mongoose.Types.ObjectId(a.addOnId) : undefined,
          name: a.name,
          price: a.price,
          pricingType: a.pricingType,
          quantity: a.quantity,
          subtotal: a.subtotal,
          taxable: a.taxable,
        })),
        status: "confirmed",
        pricing,
        taxRatePercent: taxRate,
        discountId: discount?._id,
        discountCode: discount?.code,
        discountSnapshot: discount ? { type: discount.type, value: discount.value } : undefined,
        source: "online_booking",
        specialRequests: (input.specialRequests || "").slice(0, 2000),
      },
      guestId: guestId!,
      guestInc: { totalStays: 1 },
      discountId: discount?._id,
    });

    MailService.sendBookingConfirmation({
      to: email,
      confirmationCode: reservation.confirmationCode,
      guestName: guestSnapshot.fullName,
      propertyName: property.name,
      propertyPhone: property.phone,
      propertyEmail: property.email,
      propertyAddress: property.address
        ? `${property.address.street}, ${property.address.city}, ${property.address.state} ${property.address.zip}`
        : undefined,
      siteNumber: site.siteNumber,
      siteTypeName: site.siteTypeSnapshot?.name || "RV Campsite",
      checkInDate: dIn,
      checkOutDate: dOut,
      numNights: pricing.numNights,
      adults: input.adults,
      children: input.children,
      pets: input.pets,
      pricing: {
        nightlyRate: site.currentBaseRate,
        baseSubtotal: pricing.baseSubtotal,
        addOnsSubtotal: pricing.addOnsSubtotal,
        taxAmount: pricing.taxAmount,
        totalAmount: pricing.totalAmount,
        paidAmount: pricing.paidAmount,
        balanceDue: pricing.balanceDue,
      },
      addOns: pricing.calculatedAddOns,
      slug: property.slug,
    }).catch((err) => console.error("[Mail Error] Failed to send booking confirmation email:", err));

    return {
      confirmationCode: reservation.confirmationCode,
      reservation: publicReservation(reservation.toObject()),
      property: publicProperty(property),
      guest: publicGuest({ _id: guestId, firstName: input.guest.firstName, lastName: input.guest.lastName, email }),
    };
  }

  /**
   * Public confirmation lookup. When a slug is supplied the lookup is scoped to that property
   * (confirmation codes are only unique per organization). Responses are field-allowlisted.
   */
  static async getBookingConfirmation(confirmationCode: string, slug?: string) {
    await connectDB();

    const code = String(confirmationCode || "").toUpperCase().trim();
    if (!/^[A-Z0-9-]{4,20}$/.test(code)) throw new NotFoundError("Reservation confirmation not found");

    const filter: Record<string, unknown> = { confirmationCode: code };
    if (slug) {
      const property = await Property.findOne({ slug: slug.toLowerCase().trim() }).select("_id").lean();
      if (!property) throw new NotFoundError("Reservation confirmation not found");
      filter.propertyId = property._id;
    }

    const reservation = await Reservation.findOne(filter).lean();
    if (!reservation) throw new NotFoundError("Reservation confirmation not found");

    const [property, site, payments] = await Promise.all([
      Property.findById(reservation.propertyId).lean(),
      Site.findOne({ _id: reservation.siteId, propertyId: reservation.propertyId }).lean(),
      Payment.find({ reservationId: reservation._id, propertyId: reservation.propertyId })
        .select("type amount currency method status createdAt")
        .lean(),
    ]);

    return {
      reservation: publicReservation(reservation),
      property: publicProperty(property),
      site: publicSite(site),
      guest: publicGuest({ firstName: reservation.guestSnapshot?.fullName }),
      payments: payments.map(publicPayment),
    };
  }
}
