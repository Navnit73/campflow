import mongoose from "mongoose";
import { Reservation } from "@/models/Reservation";
import { Payment } from "@/models/Payment";
import { Site } from "@/models/Site";
import { Property } from "@/models/Property";
import { connectDB } from "@/lib/db/connection";
import { cached, propertyScope } from "@/lib/cache";

export const REPORT_CACHE_TTL_MS = 5 * 60_000;
import { addDays, addDaysStr, parseDateOnly, zonedDateKey, zonedMidnight } from "@/lib/utils/date";

export const MAX_REPORT_DAYS = 366;

const signedAmount = { $cond: [{ $eq: ["$type", "refund"] }, { $multiply: ["$amount", -1] }, "$amount"] };

export class ReportService {
  static async getFinancialReports(organizationId: string, propertyId: string, days = 30) {
    await connectDB();
    const period = Math.min(MAX_REPORT_DAYS, Math.max(1, Math.floor(Number(days) || 30)));
    return cached("reports", propertyScope(propertyId), `${organizationId}|${period}`, REPORT_CACHE_TTL_MS, () =>
      this.computeFinancialReports(organizationId, propertyId, period)
    );
  }

  static async computeFinancialReports(organizationId: string, propertyId: string, period: number) {
    const propId = new mongoose.Types.ObjectId(propertyId);
    const property = await Property.findOne({ _id: propId, organizationId: new mongoose.Types.ObjectId(organizationId) })
      .select("timezone")
      .lean();
    const tz = property?.timezone;

    // Window = the last `period` local calendar days, including today.
    const todayKey = zonedDateKey(new Date(), tz);
    const firstDayKey = addDaysStr(todayKey, -(period - 1));
    const windowStart = zonedMidnight(firstDayKey, tz); // instants (createdAt)
    const windowEnd = zonedMidnight(addDaysStr(todayKey, 1), tz);
    const nightsStart = parseDateOnly(firstDayKey); // date-only (stay dates)
    const nightsEnd = addDays(parseDateOnly(todayKey), 1);

    const [paymentAgg, bookedBySiteType, nightsAgg, siteCount] = await Promise.all([
      Payment.aggregate<{
        byMethod: { _id: string; amount: number }[];
        byDay: { _id: string; amount: number }[];
        totals: { net: number; count: number }[];
      }>([
        { $match: { propertyId: propId, status: "completed", createdAt: { $gte: windowStart, $lt: windowEnd } } },
        {
          $facet: {
            // Refunds are subtracted (they were previously counted as revenue).
            totals: [{ $group: { _id: null, net: { $sum: signedAmount }, count: { $sum: 1 } } }],
            byMethod: [{ $group: { _id: "$method", amount: { $sum: signedAmount } } }],
            byDay: [
              {
                $group: {
                  _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: tz || "UTC" } },
                  amount: { $sum: signedAmount },
                },
              },
            ],
          },
        },
      ]),
      // Bookings made in the window, grouped by site type inside MongoDB.
      Reservation.aggregate<{ _id: string | null; count: number; revenue: number }>([
        {
          $match: {
            propertyId: propId,
            status: { $in: ["confirmed", "checked_in", "checked_out"] },
            createdAt: { $gte: windowStart, $lt: windowEnd },
          },
        },
        { $group: { _id: "$siteSnapshot.siteTypeName", count: { $sum: 1 }, revenue: { $sum: { $ifNull: ["$pricing.totalAmount", 0] } } } },
      ]),
      // Nights stayed inside the window, clipped to the window and summed in MongoDB
      // (previously every overlapping stay was shipped to Node to be summed in JS).
      Reservation.aggregate<{ nights: number }>([
        {
          $match: {
            propertyId: propId,
            status: { $in: ["confirmed", "checked_in", "checked_out"] },
            checkInDate: { $lt: nightsEnd },
            checkOutDate: { $gt: nightsStart },
          },
        },
        {
          $group: {
            _id: null,
            nights: {
              $sum: {
                $dateDiff: {
                  startDate: { $max: ["$checkInDate", nightsStart] },
                  endDate: { $min: ["$checkOutDate", nightsEnd] },
                  unit: "day",
                },
              },
            },
          },
        },
      ]),
      Site.countDocuments({ propertyId: propId, status: { $ne: "inactive" } }),
    ]);

    const facet = paymentAgg[0] || { totals: [], byMethod: [], byDay: [] };
    const totalRevenue = facet.totals[0]?.net || 0;

    const totalNightsBooked = Math.max(0, nightsAgg[0]?.nights || 0);
    const totalReservations = bookedBySiteType.reduce((n, g) => n + g.count, 0);
    const totalPossibleSiteNights = Math.max(1, siteCount * period);
    const averageOccupancy = Number(((totalNightsBooked / totalPossibleSiteNights) * 100).toFixed(1));

    // Daily chart: last min(period, 30) local days.
    const chartDays = Math.min(period, 30);
    const dayAmounts = new Map(facet.byDay.map((d) => [d._id, d.amount]));
    const dailyRevenueTrend = Array.from({ length: chartDays }, (_, i) => {
      const date = addDaysStr(todayKey, -(chartDays - 1 - i));
      return { date, amount: Number((dayAmounts.get(date) || 0).toFixed(2)) };
    });

    return {
      periodDays: period,
      summary: {
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalTransactions: facet.totals[0]?.count || 0,
        totalReservations,
        totalNightsBooked,
        averageOccupancy,
      },
      revenueByMethod: facet.byMethod.map((m) => ({ method: m._id, amount: Number(m.amount.toFixed(2)) })),
      revenueBySiteType: bookedBySiteType.map((g) => ({
        name: g._id || "Standard Site",
        count: g.count,
        revenue: Number(g.revenue.toFixed(2)),
      })),
      dailyRevenueTrend,
    };
  }
}
