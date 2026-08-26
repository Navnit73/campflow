import mongoose from "mongoose";
import { Reservation } from "@/models/Reservation";
import { Payment } from "@/models/Payment";
import { Site } from "@/models/Site";
import { connectDB } from "@/lib/db/connection";

export class ReportService {
  static async getFinancialReports(organizationId: string, propertyId: string, days = 30) {
    await connectDB();

    const propId = new mongoose.Types.ObjectId(propertyId);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [payments, completedReservations, siteCount] = await Promise.all([
      Payment.find({
        propertyId: propId,
        status: "completed",
        createdAt: { $gte: startDate },
      }).lean(),
      Reservation.find({
        propertyId: propId,
        status: { $in: ["confirmed", "checked_in", "checked_out"] },
        createdAt: { $gte: startDate },
      }).lean(),
      Site.countDocuments({ propertyId: propId, status: { $ne: "inactive" } }),
    ]);

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

    // Revenue by method
    const byMethod: Record<string, number> = {};
    for (const p of payments) {
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
    }

    // Revenue by Site Type Snapshot
    const bySiteType: Record<string, { count: number; revenue: number }> = {};
    for (const r of completedReservations) {
      const typeName = r.siteSnapshot?.siteTypeName || "Standard Site";
      if (!bySiteType[typeName]) {
        bySiteType[typeName] = { count: 0, revenue: 0 };
      }
      bySiteType[typeName].count += 1;
      bySiteType[typeName].revenue += r.pricing.totalAmount || 0;
    }

    // Total nights booked
    const totalNightsBooked = completedReservations.reduce((sum, r) => sum + (r.numNights || 1), 0);
    const totalPossibleSiteNights = Math.max(1, siteCount * days);
    const averageOccupancy = Number(((totalNightsBooked / totalPossibleSiteNights) * 100).toFixed(1));

    // Daily breakdown for charts
    const dailyMap: Record<string, number> = {};
    for (let i = 0; i < Math.min(days, 30); i++) {
      const d = new Date(Date.now() - (Math.min(days, 30) - 1 - i) * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split("T")[0];
      dailyMap[key] = 0;
    }

    for (const p of payments) {
      const key = new Date(p.createdAt).toISOString().split("T")[0];
      if (dailyMap[key] !== undefined) {
        dailyMap[key] += p.amount;
      }
    }

    const dailyRevenueTrend = Object.entries(dailyMap).map(([date, amount]) => ({
      date,
      amount: Number(amount.toFixed(2)),
    }));

    return {
      periodDays: days,
      summary: {
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalTransactions: payments.length,
        totalReservations: completedReservations.length,
        totalNightsBooked,
        averageOccupancy,
      },
      revenueByMethod: Object.entries(byMethod).map(([method, amount]) => ({
        method,
        amount: Number(amount.toFixed(2)),
      })),
      revenueBySiteType: Object.entries(bySiteType).map(([name, data]) => ({
        name,
        count: data.count,
        revenue: Number(data.revenue.toFixed(2)),
      })),
      dailyRevenueTrend,
    };
  }
}
