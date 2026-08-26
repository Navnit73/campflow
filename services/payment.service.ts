import mongoose from "mongoose";
import { Payment, IPayment } from "@/models/Payment";
import { Reservation } from "@/models/Reservation";
import { Guest } from "@/models/Guest";
import { CreatePaymentInput, QueryPaymentsInput } from "@/lib/validations/payment.schema";
import { connectDB } from "@/lib/db/connection";

export class PaymentService {
  static async recordPayment(
    organizationId: string,
    propertyId: string,
    input: CreatePaymentInput,
    userId?: string
  ) {
    await connectDB();

    const reservation = await Reservation.findOne({
      _id: new mongoose.Types.ObjectId(input.reservationId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    });

    if (!reservation) {
      const err = new Error("Reservation not found");
      err.name = "NotFoundError";
      throw err;
    }

    const isRefund = input.type === "refund";
    const payment = await Payment.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
      reservationId: reservation._id,
      guestId: reservation.guestId,
      type: input.type || "payment",
      amount: input.amount,
      currency: "USD",
      method: input.method,
      status: input.status || "completed",
      transactionReference: input.transactionReference || "",
      notes: input.notes || (isRefund ? "Manual refund processed" : ""),
      processedByUserId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
    });

    // Recalculate reservation paidAmount and balanceDue
    const allTransactions = await Payment.find({
      reservationId: reservation._id,
      status: "completed",
    }).lean();

    const netPaid = allTransactions.reduce((sum, p) => {
      const amt = Number(p.amount) || 0;
      return p.type === "refund" ? sum - amt : sum + amt;
    }, 0);

    reservation.pricing.paidAmount = Math.max(0, netPaid);
    reservation.pricing.balanceDue = Math.max(0, Number((reservation.pricing.totalAmount - netPaid).toFixed(2)));
    await reservation.save();

    // Update guest total spent
    if (reservation.guestId) {
      const delta = isRefund ? -input.amount : input.amount;
      await Guest.findByIdAndUpdate(reservation.guestId, {
        $inc: { totalSpent: delta },
      });
    }

    return {
      payment: payment.toObject(),
      reservation: reservation.toObject(),
    };
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
      query.method = options.method;
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
      const search = options.search.trim();
      query.$or = [
        { transactionReference: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
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
