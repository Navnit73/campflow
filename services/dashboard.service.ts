import mongoose from "mongoose";
import { Reservation } from "@/models/Reservation";
import { Site } from "@/models/Site";
import { Payment } from "@/models/Payment";
import { Guest } from "@/models/Guest";
import { connectDB } from "@/lib/db/connection";

export class DashboardService {
  static async getDashboardSummary(organizationId: string, propertyId: string) {
    await connectDB();

    const orgId = new mongoose.Types.ObjectId(organizationId);
    const propId = new mongoose.Types.ObjectId(propertyId);

    const now = new Date();
    // Today midnight UTC
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));
    const nextWeek = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalSites,
      maintenanceSites,
      currentlyOnsiteCount,
      todayArrivals,
      todayDepartures,
      upcomingReservations,
      recentPayments,
      totalGuests,
    ] = await Promise.all([
      Site.countDocuments({ propertyId: propId, status: "available" }),
      Site.countDocuments({ propertyId: propId, status: "maintenance" }),
      Reservation.countDocuments({ propertyId: propId, status: "checked_in" }),
      Reservation.find({
        propertyId: propId,
        status: { $in: ["confirmed", "pending"] },
        checkInDate: { $gte: todayStart, $lte: todayEnd },
      })
        .sort({ checkInDate: 1 })
        .lean(),
      Reservation.find({
        propertyId: propId,
        status: "checked_in",
        checkOutDate: { $gte: todayStart, $lte: todayEnd },
      })
        .sort({ checkOutDate: 1 })
        .lean(),
      Reservation.find({
        propertyId: propId,
        status: { $in: ["confirmed", "pending"] },
        checkInDate: { $gt: todayEnd, $lte: nextWeek },
      })
        .sort({ checkInDate: 1 })
        .limit(8)
        .lean(),
      Payment.find({ propertyId: propId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("reservationId", "confirmationCode")
        .populate("guestId", "firstName lastName")
        .lean(),
      Guest.countDocuments({ propertyId: propId }),
    ]);

    const activeSites = Math.max(1, totalSites);
    const occupancyRate = Number(((currentlyOnsiteCount / activeSites) * 100).toFixed(1));
    const availableToday = Math.max(0, totalSites - currentlyOnsiteCount);

    return {
      stats: {
        totalSites,
        maintenanceSites,
        currentlyOnsite: currentlyOnsiteCount,
        availableToday,
        occupancyRate,
        todayArrivalsCount: todayArrivals.length,
        todayDeparturesCount: todayDepartures.length,
        totalGuests,
      },
      todayArrivals,
      todayDepartures,
      upcomingReservations,
      recentPayments,
    };
  }
}
