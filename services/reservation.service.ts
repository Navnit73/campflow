import mongoose, { ClientSession } from "mongoose";
import { runInTransaction } from "@/lib/db/transaction";
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
import { MailService } from "@/services/mail.service";
import { withSiteLock } from "@/lib/booking/site-lock";
import { BLOCKING_STATUSES, canTransition, isBlocking } from "@/lib/booking/status";
import { resolveDiscountCode, ResolvedDiscount } from "@/lib/booking/discount";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import { searchRegex } from "@/lib/utils/regex";
import { ReservationStatus } from "@/lib/constants";

const oid = (id: string | mongoose.Types.ObjectId) => new mongoose.Types.ObjectId(id);
const MAX_CODE_ATTEMPTS = 5;

type RepriceAddOn = {
  addOnId?: string | mongoose.Types.ObjectId;
  name: string;
  price: number;
  pricingType: "per_stay" | "per_night" | "per_unit" | "per_person";
  quantity?: number;
  taxable?: boolean;
};

function isDuplicateConfirmationCode(err: unknown) {
  const e = err as { code?: number; keyPattern?: object; keyValue?: object } | null;
  return e?.code === 11000 && JSON.stringify(e?.keyPattern || e?.keyValue || {}).includes("confirmationCode");
}

export interface CommitBookingParams {
  siteId: mongoose.Types.ObjectId;
  propertyId: string | mongoose.Types.ObjectId;
  checkInDate: Date;
  checkOutDate: Date;
  /** Skip the overlap check for non-blocking statuses (e.g. creating an already-cancelled record). */
  checkAvailability: boolean;
  conflictMessage: string;
  doc: Record<string, unknown>;
  payment?: Record<string, unknown> | null;
  guestId: mongoose.Types.ObjectId;
  guestInc: Record<string, number>;
  discountId?: mongoose.Types.ObjectId;
}

/**
 * Atomically books a site:
 *  - the per-site lease lock serializes the overlap check + insert (prevents double booking);
 *  - inside the lock, reservation + initial payment + guest/discount counters are written in one
 *    multi-document transaction when the deployment supports it (replica set / Atlas), so a failure
 *    leaves no partial state. On standalone MongoDB a compensating delete is used instead;
 *  - confirmation-code collisions retry the whole unit (a duplicate-key error aborts a transaction).
 */
export async function commitBooking(params: CommitBookingParams) {
  return withSiteLock(params.siteId, async () => {
    for (let attempt = 1; ; attempt++) {
      const confirmationCode = generateConfirmationCode();
      try {
        return await runInTransaction(async (session) => {
          if (params.checkAvailability) {
            const ok = await ReservationService.checkSiteAvailability(
              params.propertyId,
              params.siteId,
              params.checkInDate,
              params.checkOutDate,
              undefined,
              session
            );
            if (!ok) throw new ConflictError(params.conflictMessage);
          }

          const [reservation] = await Reservation.create([{ ...params.doc, confirmationCode }], { session });
          try {
            if (params.payment) {
              await Payment.create([{ ...params.payment, reservationId: reservation._id }], { session });
            }
            await Guest.updateOne({ _id: params.guestId }, { $inc: params.guestInc }, { session });
            if (params.discountId) {
              await Discount.updateOne({ _id: params.discountId }, { $inc: { usageCount: 1 } }, { session });
            }
          } catch (err) {
            if (!session) {
              // Standalone MongoDB: compensate so no half-written booking survives.
              await Promise.all([
                Payment.deleteMany({ propertyId: reservation.propertyId, reservationId: reservation._id }),
                Reservation.deleteOne({ _id: reservation._id }),
              ]).catch(() => {});
            }
            throw err;
          }
          return reservation;
        });
      } catch (err) {
        if (isDuplicateConfirmationCode(err) && attempt < MAX_CODE_ATTEMPTS) continue;
        throw err;
      }
    }
  });
}

/** Adjusts guest.totalStays by delta without letting it go below zero (single atomic update). */
export async function adjustGuestStays(guestId: mongoose.Types.ObjectId | undefined, delta: number) {
  if (!guestId || !delta) return;
  await Guest.updateOne({ _id: guestId }, [
    { $set: { totalStays: { $max: [0, { $add: [{ $ifNull: ["$totalStays", 0] }, delta] }] } } },
  ], { updatePipeline: true });
}

export class ReservationService {
  static async checkSiteAvailability(
    propertyId: string | mongoose.Types.ObjectId,
    siteId: string | mongoose.Types.ObjectId,
    checkInDate: Date | string,
    checkOutDate: Date | string,
    excludeReservationId?: string | mongoose.Types.ObjectId,
    session?: ClientSession
  ): Promise<boolean> {
    await connectDB();

    const query: Record<string, unknown> = {
      propertyId: oid(propertyId),
      siteId: oid(siteId),
      status: { $in: BLOCKING_STATUSES },
      checkInDate: { $lt: parseDateOnly(checkOutDate) },
      checkOutDate: { $gt: parseDateOnly(checkInDate) },
    };
    if (excludeReservationId) query._id = { $ne: oid(excludeReservationId) };

    const conflicting = await Reservation.exists(query).session(session ?? null);
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
      Site.find({ organizationId: oid(organizationId), propertyId: oid(propertyId) })
        .sort({ sortOrder: 1, siteNumber: 1 })
        .lean(),
      // Window query: filter by propertyId only (globally unique, owned by this organization — the
      // site list above is org+property scoped) so the planner picks the
      // {propertyId, checkOutDate, checkInDate, status} window index instead of the list index.
      Reservation.find({
        propertyId: oid(propertyId),
        status: { $in: BLOCKING_STATUSES },
        checkInDate: { $lt: dOut },
        checkOutDate: { $gt: dIn },
        ...(excludeReservationId ? { _id: { $ne: oid(excludeReservationId) } } : {}),
      })
        .select("siteId confirmationCode guestSnapshot.fullName checkInDate checkOutDate status")
        .sort({ checkInDate: 1 })
        .lean(),
    ]);

    // Keep the earliest conflict per site (previously the last one silently won).
    const conflictMap = new Map<string, (typeof reservations)[number]>();
    for (const r of reservations) {
      const sId = r.siteId?.toString();
      if (sId && !conflictMap.has(sId)) conflictMap.set(sId, r);
    }

    return sites.map((site) => {
      const conflict = conflictMap.get(site._id.toString());
      const isOffline = site.status === "maintenance" || site.status === "inactive";
      return {
        ...site,
        isAvailable: !conflict && !isOffline,
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
    if (dOut <= dIn) throw new ValidationError("Check-out date must be after check-in date");

    const status = (input.status || "confirmed") as ReservationStatus;

    // Independent lookups in parallel.
    const [site, property, discount] = await Promise.all([
      Site.findOne({ _id: oid(input.siteId), organizationId: oid(organizationId), propertyId: oid(propertyId) }).lean(),
      Property.findById(propertyId).select("name phone email address slug currency taxRatePercent").lean(),
      input.discountCode ? resolveDiscountCode(propertyId, input.discountCode) : Promise.resolve(null),
    ]);

    if (!site) throw new NotFoundError("Selected Site was not found");
    if (site.status === "maintenance" || site.status === "inactive") {
      throw new ConflictError(`Site ${site.siteNumber} is currently under ${site.status} and unavailable.`);
    }

    const { guestId, guestSnapshot } = await this.resolveGuestForBooking(organizationId, propertyId, input);

    const taxRate = property?.taxRatePercent || 0;
    const pricing = calculatePricing({
      nightlyRate: site.currentBaseRate,
      checkInDate: dIn,
      checkOutDate: dOut,
      adults: input.adults || 2,
      taxRatePercent: taxRate,
      discountType: discount?.type,
      discountValue: discount?.value,
      paidAmount: input.initialPayment ? input.initialPayment.amount : 0,
      addOns: input.addOns,
    });

    if (input.initialPayment && input.initialPayment.amount > pricing.totalAmount + 0.005) {
      throw new ValidationError("Initial payment cannot exceed the reservation total", {
        "initialPayment.amount": `Maximum is ${pricing.totalAmount.toFixed(2)}`,
      });
    }

    const paidInitially = input.initialPayment && input.initialPayment.amount > 0 ? input.initialPayment : null;

    const reservation = await commitBooking({
      siteId: site._id,
      propertyId,
      checkInDate: dIn,
      checkOutDate: dOut,
      checkAvailability: isBlocking(status),
      conflictMessage: `Site ${site.siteNumber} is already booked for the selected dates.`,
      doc: {
        organizationId: oid(organizationId),
        propertyId: oid(propertyId),
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
        addOns: pricing.calculatedAddOns.map((a) => ({
          addOnId: a.addOnId && mongoose.isValidObjectId(a.addOnId) ? oid(a.addOnId) : undefined,
          name: a.name,
          price: a.price,
          pricingType: a.pricingType,
          quantity: a.quantity,
          subtotal: a.subtotal,
          taxable: a.taxable,
        })),
        status,
        pricing,
        taxRatePercent: taxRate,
        discountId: discount?._id,
        discountCode: discount?.code,
        discountSnapshot: discount ? { type: discount.type, value: discount.value } : undefined,
        source: input.source || "admin",
        specialRequests: input.specialRequests || "",
        notes: input.notes || "",
      },
      payment: paidInitially
        ? {
            organizationId: oid(organizationId),
            propertyId: oid(propertyId),
            guestId,
            amount: paidInitially.amount,
            currency: property?.currency || "USD",
            method: paidInitially.method,
            status: "completed",
            notes: paidInitially.notes || "Initial reservation payment",
            processedByUserId: userId ? oid(userId) : undefined,
          }
        : null,
      guestId,
      guestInc: { totalStays: isBlocking(status) ? 1 : 0, totalSpent: paidInitially?.amount || 0 },
      discountId: discount?._id,
    });

    if (guestSnapshot?.email) {
      MailService.sendBookingConfirmation({
        to: guestSnapshot.email,
        confirmationCode: reservation.confirmationCode,
        guestName: guestSnapshot.fullName,
        propertyName: property?.name || "CampFlow RV Resort",
        propertyPhone: property?.phone,
        propertyEmail: property?.email,
        propertyAddress: property?.address
          ? `${property.address.street}, ${property.address.city}, ${property.address.state} ${property.address.zip}`
          : undefined,
        siteNumber: site.siteNumber,
        siteTypeName: site.siteTypeSnapshot.name,
        checkInDate: dIn,
        checkOutDate: dOut,
        numNights: pricing.numNights,
        adults: input.adults || 2,
        children: input.children || 0,
        pets: input.pets || 0,
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
        slug: property?.slug,
      }).catch((err) => console.error("[Mail Error] Failed to send desk booking confirmation email:", err));
    }

    return reservation.toObject();
  }

  private static async resolveGuestForBooking(
    organizationId: string,
    propertyId: string,
    input: CreateReservationInput
  ) {
    if (input.guestId) {
      const existingGuest = await Guest.findOne({ _id: oid(input.guestId), organizationId: oid(organizationId) }).lean();
      if (!existingGuest) throw new NotFoundError("Guest profile not found");
      return {
        guestId: existingGuest._id,
        guestSnapshot: {
          fullName: `${existingGuest.firstName} ${existingGuest.lastName}`,
          email: existingGuest.email,
          phone: existingGuest.phone,
          rvType: existingGuest.rvDetails?.type || "travel_trailer",
          rvLengthFt: existingGuest.rvDetails?.lengthFt || 30,
        },
      };
    }

    if (!input.guest) throw new ValidationError("Guest information is required");

    // Staff-entered details are authoritative: upsert by (organizationId, email).
    const email = input.guest.email.toLowerCase().trim();
    const set: Record<string, unknown> = {
      firstName: input.guest.firstName.trim(),
      lastName: input.guest.lastName.trim(),
      phone: input.guest.phone.trim(),
    };
    if (input.guest.rvType) set["rvDetails.type"] = input.guest.rvType;
    if (input.guest.rvLengthFt) set["rvDetails.lengthFt"] = input.guest.rvLengthFt;
    if (input.guest.licensePlate) set["rvDetails.licensePlate"] = input.guest.licensePlate;

    const guest = await Guest.findOneAndUpdate(
      { organizationId: oid(organizationId), email },
      { $set: set, $setOnInsert: { organizationId: oid(organizationId), propertyId: oid(propertyId), email } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ).lean();

    return {
      guestId: guest!._id,
      guestSnapshot: {
        fullName: `${guest!.firstName} ${guest!.lastName}`,
        email: guest!.email,
        phone: guest!.phone,
        rvType: guest!.rvDetails?.type || "travel_trailer",
        rvLengthFt: guest!.rvDetails?.lengthFt || 30,
      },
    };
  }

  static async getReservationById(organizationId: string, propertyId: string, reservationId: string) {
    await connectDB();

    const reservation = await Reservation.findOne({
      _id: oid(reservationId),
      organizationId: oid(organizationId),
      propertyId: oid(propertyId),
    }).lean();

    if (!reservation) throw new NotFoundError("Reservation not found");

    const [payments, site, guest] = await Promise.all([
      Payment.find({ reservationId: reservation._id, propertyId: reservation.propertyId }).sort({ createdAt: -1 }).lean(),
      Site.findOne({ _id: reservation.siteId, propertyId: reservation.propertyId }).lean(),
      Guest.findOne({ _id: reservation.guestId, organizationId: reservation.organizationId }).lean(),
    ]);

    return { ...reservation, payments, site, guest };
  }

  /** Discount terms to use when re-pricing an existing reservation. */
  private static async discountForReprice(
    reservation: IReservation,
    propertyId: string,
    inputCode: string | undefined
  ): Promise<{ discount: Pick<ResolvedDiscount, "type" | "value"> | null; resolved?: ResolvedDiscount | null }> {
    if (inputCode !== undefined) {
      if (inputCode.trim() === "") return { discount: null, resolved: null }; // explicit removal
      if (inputCode.trim().toUpperCase() !== (reservation.discountCode || "").toUpperCase()) {
        const resolved = await resolveDiscountCode(propertyId, inputCode);
        return { discount: resolved, resolved };
      }
    }
    // Keep the discount the reservation was booked with, even if the code was later deactivated.
    if (reservation.discountSnapshot?.type) {
      return { discount: { type: reservation.discountSnapshot.type, value: reservation.discountSnapshot.value } };
    }
    if (reservation.discountId) {
      const legacy = await Discount.findById(reservation.discountId).select("type value").lean();
      if (legacy) return { discount: { type: legacy.type, value: legacy.value } };
    }
    return { discount: null };
  }

  static async updateReservation(
    organizationId: string,
    propertyId: string,
    reservationId: string,
    input: UpdateReservationInput
  ) {
    await connectDB();

    const filter = { _id: oid(reservationId), organizationId: oid(organizationId), propertyId: oid(propertyId) };
    const current = await Reservation.findOne(filter).select("siteId status").lean();
    if (!current) throw new NotFoundError("Reservation not found");

    const targetSiteId = input.siteId ? oid(input.siteId) : current.siteId;
    const nextStatus = (input.status ?? current.status) as ReservationStatus;

    if (!canTransition(current.status, nextStatus)) {
      throw new ConflictError(`Cannot change reservation status from ${current.status} to ${nextStatus}.`);
    }

    const changesOccupancy =
      Boolean(input.siteId || input.checkInDate || input.checkOutDate) ||
      (isBlocking(nextStatus) && !isBlocking(current.status));

    const apply = async () => {
      // Re-read inside the lock so we act on the latest state.
      const reservation = await Reservation.findOne(filter);
      if (!reservation) throw new NotFoundError("Reservation not found");
      if (!canTransition(reservation.status, nextStatus)) {
        throw new ConflictError(`Cannot change reservation status from ${reservation.status} to ${nextStatus}.`);
      }

      const newCheckIn = parseDateOnly(input.checkInDate ?? reservation.checkInDate);
      const newCheckOut = parseDateOnly(input.checkOutDate ?? reservation.checkOutDate);
      if (newCheckOut <= newCheckIn) throw new ValidationError("Check-out date must be after check-in date");

      if (changesOccupancy) {
        // Tenant-scoped: a siteId from another organization/property must never be accepted.
        const site = await Site.findOne({
          _id: targetSiteId,
          organizationId: oid(organizationId),
          propertyId: oid(propertyId),
        }).lean();
        if (!site) throw new NotFoundError("Selected site was not found.");
        if (site.status === "maintenance" || site.status === "inactive") {
          throw new ConflictError(`Site ${site.siteNumber} is currently under ${site.status} and unavailable.`);
        }

        if (isBlocking(nextStatus)) {
          const ok = await this.checkSiteAvailability(propertyId, site._id, newCheckIn, newCheckOut, reservation._id);
          if (!ok) throw new ConflictError("The selected site is not available for these dates.");
        }

        if (!site._id.equals(reservation.siteId)) {
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
      }

      if (input.adults !== undefined) reservation.adults = input.adults;
      if (input.children !== undefined) reservation.children = input.children;
      if (input.pets !== undefined) reservation.pets = input.pets;

      const needsReprice =
        input.siteId ||
        input.checkInDate ||
        input.checkOutDate ||
        input.adults !== undefined ||
        input.discountCode !== undefined ||
        input.addOns !== undefined;

      if (needsReprice) {
        const { discount, resolved } = await this.discountForReprice(reservation, propertyId, input.discountCode);
        let taxRate = reservation.taxRatePercent;
        if (taxRate === undefined || taxRate === null) {
          const property = await Property.findById(propertyId).select("taxRatePercent").lean();
          taxRate = property?.taxRatePercent || 0;
        }

        const effectiveAddOns = input.addOns !== undefined ? input.addOns : reservation.addOns || [];
        const pricing = calculatePricing({
          nightlyRate: reservation.siteSnapshot.baseRate,
          checkInDate: reservation.checkInDate,
          checkOutDate: reservation.checkOutDate,
          adults: reservation.adults,
          taxRatePercent: taxRate,
          discountType: discount?.type,
          discountValue: discount?.value,
          paidAmount: reservation.pricing.paidAmount,
          addOns: (effectiveAddOns as RepriceAddOn[]).map((a) => ({
            addOnId: a.addOnId ? String(a.addOnId) : undefined,
            name: a.name,
            price: a.price,
            pricingType: a.pricingType,
            quantity: a.quantity,
            taxable: a.taxable,
          })),
        });

        reservation.numNights = pricing.numNights;
        reservation.pricing = pricing;
        reservation.taxRatePercent = taxRate;
        reservation.addOns = pricing.calculatedAddOns.map((a) => ({
          addOnId: a.addOnId && mongoose.isValidObjectId(a.addOnId) ? oid(a.addOnId) : undefined,
          name: a.name,
          price: a.price,
          pricingType: a.pricingType,
          quantity: a.quantity,
          subtotal: a.subtotal,
          taxable: a.taxable,
        })) as IReservation["addOns"];

        if (resolved !== undefined) {
          reservation.discountId = resolved?._id;
          reservation.discountCode = resolved?.code;
          reservation.discountSnapshot = resolved ? { type: resolved.type, value: resolved.value } : undefined;
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

      const previousStatus = reservation.status;
      if (input.status !== undefined) reservation.status = input.status;
      if (input.specialRequests !== undefined) reservation.specialRequests = input.specialRequests;
      if (input.notes !== undefined) reservation.notes = input.notes;

      await reservation.save();

      // Keep guest stay counter consistent with blocking/non-blocking transitions.
      if (isBlocking(previousStatus) !== isBlocking(reservation.status) && reservation.status !== "checked_out" && previousStatus !== "checked_out") {
        await adjustGuestStays(reservation.guestId, isBlocking(reservation.status) ? 1 : -1);
      }

      return reservation.toObject();
    };

    return changesOccupancy ? withSiteLock(targetSiteId, apply) : apply();
  }

  /**
   * Atomically moves a reservation between statuses. Only succeeds if the current status is in
   * `from`; returns the existing doc unchanged when it is already in `to` (idempotent).
   */
  private static async transition(
    organizationId: string,
    propertyId: string,
    reservationId: string,
    to: ReservationStatus,
    from: ReservationStatus[],
    extraSet: Record<string, unknown> = {},
    verb: string = to
  ) {
    await connectDB();
    const filter = { _id: oid(reservationId), organizationId: oid(organizationId), propertyId: oid(propertyId) };

    const updated = await Reservation.findOneAndUpdate(
      { ...filter, status: { $in: from } },
      { $set: { status: to, ...extraSet } },
      { returnDocument: "after" }
    ).lean();
    if (updated) return updated;

    const existing = await Reservation.findOne(filter).lean();
    if (!existing) throw new NotFoundError("Reservation not found");
    if (existing.status === to) return existing; // idempotent retry
    throw new ConflictError(`Cannot ${verb} a reservation that is ${existing.status.replace("_", " ")}.`);
  }

  static async checkIn(organizationId: string, propertyId: string, reservationId: string) {
    return this.transition(organizationId, propertyId, reservationId, "checked_in", ["pending", "confirmed"], {
      checkInTimeActual: new Date(),
    }, "check in");
  }

  static async checkOut(organizationId: string, propertyId: string, reservationId: string) {
    return this.transition(organizationId, propertyId, reservationId, "checked_out", ["checked_in"], {
      checkOutTimeActual: new Date(),
    }, "check out");
  }

  static async cancelReservation(organizationId: string, propertyId: string, reservationId: string, notes?: string) {
    await connectDB();
    const filter = { _id: oid(reservationId), organizationId: oid(organizationId), propertyId: oid(propertyId) };
    const from: ReservationStatus[] = ["pending", "confirmed", "no_show"];

    const update: Record<string, unknown>[] = [{ $set: { status: "cancelled" } }];
    if (notes) {
      const line = `[Cancelled]: ${String(notes).slice(0, 1000)}`;
      update.push({
        $set: {
          notes: {
            $cond: [{ $gt: [{ $strLenCP: { $ifNull: ["$notes", ""] } }, 0] }, { $concat: ["$notes", "\n", line] }, line],
          },
        },
      });
    }

    const before = await Reservation.findOneAndUpdate({ ...filter, status: { $in: from } }, update, {
      returnDocument: "before",
      updatePipeline: true,
    }).lean();
    if (before) {
      if (isBlocking(before.status)) await adjustGuestStays(before.guestId, -1);
      return (await Reservation.findById(before._id).lean())!;
    }

    const existing = await Reservation.findOne(filter).lean();
    if (!existing) throw new NotFoundError("Reservation not found");
    if (existing.status === "cancelled") return existing;
    throw new ConflictError(`Cannot cancel a reservation that is ${existing.status.replace("_", " ")}.`);
  }

  static async listReservations(organizationId: string, propertyId: string, options: QueryReservationsInput) {
    await connectDB();

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      organizationId: oid(organizationId),
      propertyId: oid(propertyId),
    };

    if (options.status && options.status !== "all") query.status = String(options.status);
    if (options.siteId) query.siteId = oid(options.siteId);

    if (options.startDate || options.endDate) {
      const range: Record<string, Date> = {};
      if (options.startDate) range.$gte = parseDateOnly(options.startDate);
      if (options.endDate) range.$lt = addDays(options.endDate, 1);
      query.checkInDate = range;
    }

    if (options.search && options.search.trim()) {
      const rx = searchRegex(options.search);
      query.$or = [
        { confirmationCode: rx },
        { "guestSnapshot.fullName": rx },
        { "guestSnapshot.email": rx },
        { "guestSnapshot.phone": rx },
        { "siteSnapshot.siteNumber": rx },
      ];
    }

    const [reservations, total] = await Promise.all([
      Reservation.find(query).sort({ checkInDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Reservation.countDocuments(query),
    ]);

    return {
      reservations,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async getTapeChartData(organizationId: string, propertyId: string, startDateStr: string, days = 14) {
    await connectDB();

    const startDate = parseDateOnly(startDateStr);
    const endDate = addDays(startDate, days);

    const [sites, reservations] = await Promise.all([
      Site.find({
        organizationId: oid(organizationId),
        propertyId: oid(propertyId),
        status: { $ne: "inactive" },
      })
        .select("siteNumber name status siteTypeId siteTypeSnapshot currentBaseRate rigType sortOrder petFriendly amenities")
        .sort({ sortOrder: 1, siteNumber: 1 })
        .lean(),
      // propertyId-only window query (see checkAllSitesAvailability).
      Reservation.find({
        propertyId: oid(propertyId),
        status: { $in: ["confirmed", "checked_in", "pending", "checked_out"] },
        checkInDate: { $lt: endDate },
        checkOutDate: { $gt: startDate },
      })
        .select("confirmationCode siteId guestId guestSnapshot siteSnapshot checkInDate checkOutDate status pricing numNights adults children")
        .lean(),
    ]);

    return { startDate: formatDateKey(startDate), days, sites, reservations };
  }
}
