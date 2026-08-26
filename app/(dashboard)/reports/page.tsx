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
  Inbox,
  CreditCard,
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Reports & Occupancy Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Financial revenue, occupancy rate trends, and site category performance
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="join">
            <button
              onClick={() => setDays(7)}
              className={`btn btn-xs sm:btn-sm join-item font-bold text-xs rounded-l-md ${
                days === 7 ? "bg-emerald-600 text-white border-emerald-600" : "btn-outline"
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setDays(30)}
              className={`btn btn-xs sm:btn-sm join-item font-bold text-xs ${
                days === 30 ? "bg-emerald-600 text-white border-emerald-600" : "btn-outline"
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setDays(90)}
              className={`btn btn-xs sm:btn-sm join-item font-bold text-xs rounded-r-md ${
                days === 90 ? "bg-emerald-600 text-white border-emerald-600" : "btn-outline"
              }`}
            >
              Last 90 Days
            </button>
          </div>

          <button
            onClick={() => fetchReports(days)}
            className="btn btn-ghost btn-sm btn-circle text-slate-600 hover:text-slate-900 rounded-md"
            title="Refresh Reports"
            aria-label="Refresh Reports"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(summary.totalRevenue)}
          subtitle={`${summary.totalTransactions} transactions recorded`}
          icon={<DollarSign className="w-4 h-4 text-emerald-600" />}
          colorClass="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          title="Average Occupancy"
          value={`${summary.averageOccupancy}%`}
          subtitle="Site capacity utilization"
          icon={<TrendingUp className="w-4 h-4 text-sky-600" />}
          colorClass="bg-sky-50 text-sky-700"
        />
        <StatCard
          title="Nights Booked"
          value={`${summary.totalNightsBooked} nts`}
          subtitle="Cumulative guest nights"
          icon={<CalendarCheck className="w-4 h-4 text-indigo-600" />}
          colorClass="bg-indigo-50 text-indigo-700"
        />
        <StatCard
          title="Completed Stays"
          value={summary.totalReservations}
          subtitle="Bookings in selected period"
          icon={<BarChart3 className="w-4 h-4 text-amber-600" />}
          colorClass="bg-amber-50 text-amber-700"
        />
      </div>

      {/* 2-Column Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by Site Type */}
        <div className="surface-card p-4 sm:p-5 rounded-lg space-y-3.5 border border-slate-200">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-600" />
              Revenue by Site Category
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              {data?.revenueBySiteType?.length || 0} Categories
            </span>
          </div>

          <div className="space-y-3">
            {!data?.revenueBySiteType || data.revenueBySiteType.length === 0 ? (
              <div className="py-10 text-center space-y-1.5">
                <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Inbox className="w-4 h-4" />
                </div>
                <p className="text-xs text-slate-500">No revenue recorded in this period.</p>
              </div>
            ) : (
              data.revenueBySiteType.map((st: any) => {
                const pct = summary.totalRevenue > 0 ? (st.revenue / summary.totalRevenue) * 100 : 0;
                return (
                  <div key={st.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{st.name}</span>
                      <span className="font-black font-mono text-emerald-700">
                        {formatCurrency(st.revenue)} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-1.5 rounded transition-all"
                        style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
                      ></div>
                    </div>
                    <div className="text-[10px] text-slate-400 text-right font-medium">
                      {st.count} reservations
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Revenue by Payment Method */}
        <div className="surface-card p-4 sm:p-5 rounded-lg space-y-3.5 border border-slate-200">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              Payment Method Breakdown
            </h3>
          </div>

          <div className="space-y-3">
            {!data?.revenueByMethod || data.revenueByMethod.length === 0 ? (
              <div className="py-10 text-center space-y-1.5">
                <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Inbox className="w-4 h-4" />
                </div>
                <p className="text-xs text-slate-500">No payments recorded in this period.</p>
              </div>
            ) : (
              data.revenueByMethod.map((pm: any) => {
                const pct = summary.totalRevenue > 0 ? (pm.amount / summary.totalRevenue) * 100 : 0;
                return (
                  <div key={pm.method} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 capitalize">
                        {pm.method.replace("_", " ")}
                      </span>
                      <span className="font-black font-mono text-slate-900">
                        {formatCurrency(pm.amount)} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded h-1.5 overflow-hidden">
                      <div
                        className="bg-sky-600 h-1.5 rounded transition-all"
                        style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
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
      <div className="surface-card p-4 sm:p-5 rounded-lg space-y-3 border border-slate-200">
        <h3 className="font-bold text-sm text-slate-900">
          Daily Revenue Activity (Last {Math.min(days, 30)} Days)
        </h3>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="table table-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th>Date</th>
                <th className="text-right">Daily Revenue Collected</th>
              </tr>
            </thead>
            <tbody>
              {data?.dailyRevenueTrend?.map((d: any) => (
                <tr key={d.date} className="hover:bg-slate-50 border-b border-slate-100 transition-colors">
                  <td className="font-mono text-xs text-slate-700 font-semibold">{d.date}</td>
                  <td
                    className={`text-right font-mono text-xs ${
                      d.amount > 0 ? "text-emerald-700 font-bold" : "text-slate-400"
                    }`}
                  >
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
