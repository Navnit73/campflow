"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { StatCard } from "@/components/ui/StatCard";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils/format";
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  CalendarCheck,
  RefreshCw,
  PieChart,
} from "lucide-react";

export default function ReportsPage() {
  const { error } = useToast();
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async (periodDays = days) => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/reports", {
        params: { days: periodDays },
      });
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err: any) {
      error(err?.message || "Failed to load financial reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(days);
  }, [days]);

  const summary = data?.summary || {
    totalRevenue: 0,
    totalTransactions: 0,
    totalReservations: 0,
    totalNightsBooked: 0,
    averageOccupancy: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-base-content">
            Reports & Occupancy Analytics
          </h1>
          <p className="text-xs text-base-content/60 mt-0.5">
            Financial revenue, occupancy rate trends, and site category performance
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="join">
            <button
              onClick={() => setDays(7)}
              className={`btn btn-xs sm:btn-sm join-item ${days === 7 ? "btn-primary" : "btn-outline"}`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setDays(30)}
              className={`btn btn-xs sm:btn-sm join-item ${days === 30 ? "btn-primary" : "btn-outline"}`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setDays(90)}
              className={`btn btn-xs sm:btn-sm join-item ${days === 90 ? "btn-primary" : "btn-outline"}`}
            >
              Last 90 Days
            </button>
          </div>

          <button
            onClick={() => fetchReports(days)}
            className="btn btn-ghost btn-sm btn-circle"
            title="Refresh Reports"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(summary.totalRevenue)}
          subtitle={`${summary.totalTransactions} transactions recorded`}
          icon={<DollarSign className="w-6 h-6 text-emerald-600" />}
          colorClass="bg-emerald-500/10"
        />
        <StatCard
          title="Average Occupancy"
          value={`${summary.averageOccupancy}%`}
          subtitle="Site capacity utilization"
          icon={<TrendingUp className="w-6 h-6 text-sky-600" />}
          colorClass="bg-sky-500/10"
        />
        <StatCard
          title="Nights Booked"
          value={`${summary.totalNightsBooked} nts`}
          subtitle="Cumulative guest nights"
          icon={<CalendarCheck className="w-6 h-6 text-indigo-600" />}
          colorClass="bg-indigo-500/10"
        />
        <StatCard
          title="Completed Stays"
          value={summary.totalReservations}
          subtitle="Bookings in selected period"
          icon={<BarChart3 className="w-6 h-6 text-amber-600" />}
          colorClass="bg-amber-500/10"
        />
      </div>

      {/* 2-Column Breakdown: Revenue by Site Type & Payment Method */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Site Type */}
        <div className="card bg-base-100 shadow-sm border border-base-200 p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-base-200">
            <h3 className="font-bold text-sm text-base-content flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" />
              Revenue by Site Category
            </h3>
            <span className="text-xs text-base-content/60 font-medium">
              {data?.revenueBySiteType?.length || 0} Categories
            </span>
          </div>

          <div className="space-y-3">
            {!data?.revenueBySiteType || data.revenueBySiteType.length === 0 ? (
              <div className="py-8 text-center text-xs text-base-content/50">
                No revenue recorded in this period.
              </div>
            ) : (
              data.revenueBySiteType.map((st: any) => {
                const pct = summary.totalRevenue > 0 ? (st.revenue / summary.totalRevenue) * 100 : 0;
                return (
                  <div key={st.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-base-content">{st.name}</span>
                      <span className="font-bold font-mono text-emerald-600">
                        {formatCurrency(st.revenue)} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-base-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                      ></div>
                    </div>
                    <div className="text-[11px] text-base-content/50 text-right">
                      {st.count} reservations
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Revenue by Payment Method */}
        <div className="card bg-base-100 shadow-sm border border-base-200 p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-base-200">
            <h3 className="font-bold text-sm text-base-content flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Payment Method Breakdown
            </h3>
          </div>

          <div className="space-y-3">
            {!data?.revenueByMethod || data.revenueByMethod.length === 0 ? (
              <div className="py-8 text-center text-xs text-base-content/50">
                No payments recorded.
              </div>
            ) : (
              data.revenueByMethod.map((pm: any) => {
                const pct = summary.totalRevenue > 0 ? (pm.amount / summary.totalRevenue) * 100 : 0;
                return (
                  <div key={pm.method} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-base-content capitalize">
                        {pm.method.replace("_", " ")}
                      </span>
                      <span className="font-bold font-mono text-base-content">
                        {formatCurrency(pm.amount)} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-base-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Daily Trend Table */}
      <div className="card bg-base-100 shadow-sm border border-base-200 p-5 space-y-3">
        <h3 className="font-bold text-sm text-base-content">
          Daily Revenue Activity (Last {Math.min(days, 30)} Days)
        </h3>
        <div className="overflow-x-auto">
          <table className="table table-xs">
            <thead className="bg-base-200/50">
              <tr>
                <th>Date</th>
                <th className="text-right">Daily Revenue Collected</th>
              </tr>
            </thead>
            <tbody>
              {data?.dailyRevenueTrend?.map((d: any) => (
                <tr key={d.date} className="hover:bg-base-200/30">
                  <td className="font-mono text-xs">{d.date}</td>
                  <td className={`text-right font-mono font-semibold ${d.amount > 0 ? "text-emerald-600 font-bold" : "text-base-content/40"}`}>
                    {formatCurrency(d.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
