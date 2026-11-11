import mongoose from "mongoose";
import { Payment } from "@/models/Payment";
import { Reservation, IReservation } from "@/models/Reservation";

type LeanReservationTotals = Pick<IReservation, "_id" | "status" | "pricing" | "guestId">;
import { Guest } from "@/models/Guest";
import { CreatePaymentInput, QueryPaymentsInput } from "@/lib/validations/payment.schema";
import { connectDB } from "@/lib/db/connection";
import { Property } from "@/models/Property";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import { searchRegex } from "@/lib/utils/regex";

/** Update pipeline that shifts paidAmount by `delta` and recomputes balanceDue atomically. */
function applyPaidDelta(delta: number) {
  return [
    { $set: { "pricing.paidAmount": { $round: [{ $add: [{ $ifNull: ["$pricing.paidAmount", 0] }, delta] }, 2] } } },
    {
      $set: {
        "pricing.balanceDue": {
          $max: [0, { $round: [{ $subtract: ["$pricing.totalAmount", "$pricing.paidAmount"] }, 2] }],
        },
      },
    },
  ];
}

export class PaymentService {
  static async recordPayment(
    organizationId: string,
    propertyId: string,
    input: CreatePaymentInput,
    userId?: string
  ) {
    await connectDB();

    const orgId = new mongoose.Types.ObjectId(organizationId);
    const propId = new mongoose.Types.ObjectId(propertyId);
    const reservationFilter = { _id: new mongoose.Types.ObjectId(input.reservationId), organizationId: orgId, propertyId: propId };

    const [reservation, property] = await Promise.all([
      Reservation.findOne(reservationFilter).select("status guestId pricing").lean(),
      Property.findById(propId).select("currency").lean(),
    ]);
    if (!reservation) throw new NotFoundError("Reservation not found");

    const isRefund = input.type === "refund";
    if (!isRefund && reservation.status === "cancelled") {
      throw new ConflictError("Cannot record a payment on a cancelled reservation. Record a refund instead.");
    }

    // Idempotent retry: same key → return the original payment, never a second ledger entry.
    if (input.idempotencyKey) {
      const existing = await Payment.findOne({ organizationId: orgId, idempotencyKey: input.idempotencyKey }).lean();
      if (existing) {
        return { payment: existing, reservation: (await Reservation.findById(reservation._id).lean<LeanReservationTotals>())!, idempotentReplay: true };
      }
    }

    const amount = Number(input.amount);
    const affectsBalance = (input.status || "completed") === "completed";
    const delta = isRefund ? -amount : amount;
    let updatedReservation: LeanReservationTotals | null = reservation as LeanReservationTotals;

    // Atomically move paidAmount/balanceDue. Refunds are guarded so they can never exceed net paid,
    // even under concurrent refund requests.
    if (affectsBalance) {
      updatedReservation = await Reservation.findOneAndUpdate(
        isRefund ? { ...reservationFilter, "pricing.paidAmount": { $gte: amount - 0.005 } } : reservationFilter,
        applyPaidDelta(delta),
        { returnDocument: "after", updatePipeline: true }
      ).lean<LeanReservationTotals>();
      if (!updatedReservation) {
        throw new ValidationError("Refund amount exceeds the net amount paid on this reservation", {
          amount: `Maximum refundable is ${Number(reservation.pricing?.paidAmount || 0).toFixed(2)}`,
        });
      }
    }

    let payment;
    try {
      payment = await Payment.create({
        organizationId: orgId,
        propertyId: propId,
        reservationId: reservation._id,
        guestId: reservation.guestId,
        type: input.type || "payment",
        amount,
        currency: property?.currency || "USD",
        method: input.method,
        status: input.status || "completed",
        transactionReference: input.transactionReference || "",
        notes: input.notes || (isRefund ? "Manual refund processed" : ""),
        processedByUserId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
        idempotencyKey: input.idempotencyKey,
      });
    } catch (err: unknown) {
      // Roll back the balance movement so the ledger and reservation stay consistent.
      if (affectsBalance) await Reservation.updateOne({ _id: reservation._id }, applyPaidDelta(-delta), { updatePipeline: true }).catch(() => {});
      if ((err as { code?: number })?.code === 11000 && input.idempotencyKey) {
        const existing = await Payment.findOne({ organizationId: orgId, idempotencyKey: input.idempotencyKey }).lean();
        return { payment: existing, reservation: (await Reservation.findById(reservation._id).lean<LeanReservationTotals>())!, idempotentReplay: true };
      }
      throw err;
    }

    // Lifetime spend only reflects money that actually moved.
    if (affectsBalance && reservation.guestId) {
      await Guest.updateOne({ _id: reservation.guestId }, { $inc: { totalSpent: delta } });
    }

    return { payment: payment.toObject(), reservation: updatedReservation! };
  }

  static async listPayments(organizationId: string, propertyId: string, options: QueryPaymentsInput) {
    await connectDB();

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    };

    if (options.reservationId) {
      query.reservationId = new mongoose.Types.ObjectId(options.reservationId);
    }

    if (options.method && options.method !== "all") {
      query.method = String(options.method);
    }

    if (options.startDate || options.endDate) {
      query.createdAt = {};
      if (options.startDate) {
        query.createdAt.$gte = new Date(options.startDate + "T00:00:00Z");
      }
      if (options.endDate) {
        query.createdAt.$lte = new Date(options.endDate + "T23:59:59Z");
      }
    }

    if (options.search && options.search.trim()) {
      const rx = searchRegex(options.search);
      query.$or = [{ transactionReference: rx }, { notes: rx }];
    }

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate("reservationId", "confirmationCode checkInDate checkOutDate guestSnapshot siteSnapshot pricing")
        .populate("guestId", "firstName lastName email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments(query),
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
