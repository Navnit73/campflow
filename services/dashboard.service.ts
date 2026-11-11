import mongoose from "mongoose";
import { Reservation } from "@/models/Reservation";
import { Site } from "@/models/Site";
import { Payment } from "@/models/Payment";
import { Guest } from "@/models/Guest";
import { Property } from "@/models/Property";
import { connectDB } from "@/lib/db/connection";
import { addDays, addDaysStr, parseDateOnly, zonedDateKey, zonedMidnight } from "@/lib/utils/date";

const LIST_FIELDS =
  "confirmationCode siteId guestId guestSnapshot siteSnapshot checkInDate checkOutDate status pricing numNights adults children pets source createdAt";

export class DashboardService {
  static async getDashboardSummary(organizationId: string, propertyId: string) {
    await connectDB();

    const propId = new mongoose.Types.ObjectId(propertyId);
    const property = await Property.findOne({ _id: propId, organizationId: new mongoose.Types.ObjectId(organizationId) })
      .select("timezone")
      .lean();

    // "Today" is the park's local calendar day (previously UTC, which flipped US parks'
    // arrivals/departures to "tomorrow" every evening).
    const todayKey = zonedDateKey(new Date(), property?.timezone);
    const today = parseDateOnly(todayKey); // reservation dates are stored as UTC-midnight date-only values
    const tomorrow = addDays(today, 1);
    const nextWeek = addDays(today, 7);
    const dayStart = zonedMidnight(todayKey, property?.timezone); // real instants for createdAt ranges
    const dayEnd = zonedMidnight(addDaysStr(todayKey, 1), property?.timezone);

    const [
      totalSites,
      maintenanceSites,
      currentlyOnsiteReservations,
      todayArrivals,
      todayDepartures,
      upcomingReservations,
      recentPayments,
      todayRevenueAgg,
      outstandingAgg,
      recentReservations,
      totalGuests,
    ] = await Promise.all([
      Site.countDocuments({ propertyId: propId, status: { $ne: "inactive" } }),
      Site.countDocuments({ propertyId: propId, status: "maintenance" }),
      Reservation.find({ propertyId: propId, status: "checked_in" }).select(LIST_FIELDS).sort({ checkOutDate: 1 }).lean(),
      Reservation.find({
        propertyId: propId,
        status: { $in: ["confirmed", "pending"] },
        checkInDate: { $gte: today, $lt: tomorrow },
      })
        .select(LIST_FIELDS)
        .sort({ checkInDate: 1 })
        .lean(),
      Reservation.find({
        propertyId: propId,
        status: "checked_in",
        checkOutDate: { $gte: today, $lt: tomorrow },
      })
        .select(LIST_FIELDS)
        .sort({ checkOutDate: 1 })
        .lean(),
      Reservation.find({
        propertyId: propId,
        status: { $in: ["confirmed", "pending"] },
        checkInDate: { $gte: tomorrow, $lte: nextWeek },
      })
        .select(LIST_FIELDS)
        .sort({ checkInDate: 1 })
        .limit(8)
        .lean(),
      Payment.find({ propertyId: propId })
        .sort({ createdAt: -1 })
        .limit(6)
        .populate("reservationId", "confirmationCode")
        .populate("guestId", "firstName lastName")
        .lean(),
      // Sums computed in MongoDB instead of loading every document into Node.
      Payment.aggregate<{ total: number }>([
        { $match: { propertyId: propId, status: "completed", createdAt: { $gte: dayStart, $lt: dayEnd } } },
        { $group: { _id: null, total: { $sum: { $cond: [{ $eq: ["$type", "refund"] }, { $multiply: ["$amount", -1] }, "$amount"] } } } },
      ]),
      Reservation.aggregate<{ total: number }>([
        { $match: { propertyId: propId, status: { $in: ["confirmed", "checked_in", "pending"] } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$pricing.balanceDue", 0] } } } },
      ]),
      Reservation.find({ propertyId: propId }).select(LIST_FIELDS).sort({ createdAt: -1 }).limit(6).lean(),
      Guest.countDocuments({ propertyId: propId }),
    ]);

    const activeSites = Math.max(1, totalSites);
    const currentlyOnsiteCount = currentlyOnsiteReservations.length;
    const occupancyRate = Number(((currentlyOnsiteCount / activeSites) * 100).toFixed(1));
    const availableToday = Math.max(0, totalSites - maintenanceSites - currentlyOnsiteCount);

    return {
      stats: {
        totalSites,
        maintenanceSites,
        currentlyOnsite: currentlyOnsiteCount,
        availableToday,
        occupancyRate,
        todayArrivalsCount: todayArrivals.length,
        todayDeparturesCount: todayDepartures.length,
        todayRevenue: Number((todayRevenueAgg[0]?.total || 0).toFixed(2)),
        outstandingBalance: Number((outstandingAgg[0]?.total || 0).toFixed(2)),
        totalGuests,
      },
      todayArrivals,
      todayDepartures,
      currentlyOnsiteReservations,
      upcomingReservations,
      recentReservations,
      recentPayments,
    };
  }
}
