"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import apiClient from "@/lib/axios/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { StatCard } from "@/components/ui/StatCard";
import { ReservationBadge } from "@/components/ui/Badge";
import { ReservationDetailModal } from "@/components/reservations/ReservationDetailModal";
import { PaymentModal } from "@/components/payments/PaymentModal";
import { formatCurrency, formatDate, formatRvType, formatDateTime } from "@/lib/utils/format";
import {
  CalendarDays,
  CheckCircle2,
  LogOut,
  MapPin,
  TrendingUp,
  DollarSign,
  ArrowRight,
  RefreshCw,
  Inbox,
} from "lucide-react";

export default function DashboardPage() {
  const { property } = useAuth();
  const { success, error } = useToast();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedResId, setSelectedResId] = useState<string | null>(null);
  const [paymentRes, setPaymentRes] = useState<any | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/dashboard");
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err: any) {
      error(err?.message || "Failed to load dashboard summary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleQuickCheckIn = async (resId: string) => {
    try {
      const res = await apiClient.post(`/api/reservations/${resId}/check-in`);
      if (res.data?.success) {
        success("Guest checked in successfully!");
        loadDashboard();
      }
    } catch (err: any) {
      error(err?.message || "Check-in failed");
    }
  };

  const handleQuickCheckOut = async (res: any) => {
    if (res.pricing?.balanceDue > 0) {
      if (!confirm(`Guest has an outstanding balance of ${formatCurrency(res.pricing.balanceDue)}. Proceed with check-out?`)) {
        return;
      }
    }
    try {
      const resp = await apiClient.post(`/api/reservations/${res._id}/check-out`);
      if (resp.data?.success) {
        success("Guest checked out successfully!");
        loadDashboard();
      }
    } catch (err: any) {
      error(err?.message || "Check-out failed");
    }
  };

  const stats = data?.stats || {
    totalSites: 0,
    currentlyOnsite: 0,
    availableToday: 0,
    occupancyRate: 0,
    todayArrivalsCount: 0,
    todayDeparturesCount: 0,
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Front Desk Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time campground occupancy, arrivals, and operations desk
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/tape-chart"
            className="btn btn-outline btn-sm gap-1.5 font-bold text-xs rounded-md"
          >
            <CalendarDays className="w-4 h-4 text-emerald-600" />
            Visual Tape Chart
          </Link>
          <button
            onClick={loadDashboard}
            className="btn btn-ghost btn-sm btn-circle text-slate-600 hover:text-slate-900 rounded-md"
            title="Refresh Metrics"
            aria-label="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Primary KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
        <StatCard
          title="Occupancy Rate"
          value={`${stats.occupancyRate}%`}
          subtitle={`${stats.currentlyOnsite} of ${stats.totalSites} active sites filled`}
          icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
          colorClass="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          title="Available Sites"
          value={stats.availableToday}
          subtitle="Ready for walk-ins & bookings"
          icon={<MapPin className="w-4 h-4 text-sky-600" />}
          colorClass="bg-sky-50 text-sky-700"
        />
        <StatCard
          title="Arriving Today"
          value={stats.todayArrivalsCount}
          subtitle="Scheduled check-ins at desk"
          icon={<CheckCircle2 className="w-4 h-4 text-amber-600" />}
          colorClass="bg-amber-50 text-amber-700"
        />
        <StatCard
          title="Departing Today"
          value={stats.todayDeparturesCount}
          subtitle="Scheduled checkouts today"
          icon={<LogOut className="w-4 h-4 text-indigo-600" />}
          colorClass="bg-indigo-50 text-indigo-700"
        />
      </div>

      {/* Main Operations Desk: Arrivals & Departures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's Arrivals */}
        <div className="surface-card p-4 sm:p-5 rounded-lg flex flex-col justify-between space-y-3 border border-slate-200">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <h3 className="font-bold text-sm text-slate-900">
                  Today&apos;s Arrivals ({data?.todayArrivals?.length || 0})
                </h3>
              </div>
              <Link
                href="/reservations"
                className="text-xs text-emerald-700 font-bold hover:underline inline-flex items-center gap-1"
              >
                All Bookings <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 mt-1">
              {loading ? (
                <div className="py-8 text-center text-xs text-slate-500 space-y-2">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto text-emerald-600" />
                  <p>Loading arrivals...</p>
                </div>
              ) : !data?.todayArrivals || data.todayArrivals.length === 0 ? (
                <div className="py-8 text-center space-y-1.5">
                  <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Inbox className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-slate-500">No upcoming arrivals scheduled for today.</p>
                </div>
              ) : (
                data.todayArrivals.map((res: any) => (
                  <div
                    key={res._id}
                    className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 rounded-md px-1.5 transition-colors"
                  >
                    <div
                      className="cursor-pointer min-w-0 flex-1"
                      onClick={() => setSelectedResId(res._id)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 truncate">
                          {res.guestSnapshot?.fullName}
                        </span>
                        <span className="badge badge-xs font-mono font-bold bg-slate-100 text-slate-800 border-slate-200 shrink-0 rounded">
                          Site {res.siteSnapshot?.siteNumber}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                        <span>{res.numNights} nights</span>
                        <span>•</span>
                        <span>{formatRvType(res.guestSnapshot?.rvType || "travel_trailer")}</span>
                        {res.pricing?.balanceDue > 0 && (
                          <span className="text-rose-700 font-bold">
                            (Due: {formatCurrency(res.pricing.balanceDue)})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleQuickCheckIn(res._id)}
                        className="btn btn-success btn-xs text-white font-bold gap-1 rounded"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Check In
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Today's Departures */}
        <div className="surface-card p-4 sm:p-5 rounded-lg flex flex-col justify-between space-y-3 border border-slate-200">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <h3 className="font-bold text-sm text-slate-900">
                  Today&apos;s Departures ({data?.todayDepartures?.length || 0})
                </h3>
              </div>
              <Link
                href="/reservations?status=checked_in"
                className="text-xs text-emerald-700 font-bold hover:underline inline-flex items-center gap-1"
              >
                Onsite Guests <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 mt-1">
              {loading ? (
                <div className="py-8 text-center text-xs text-slate-500 space-y-2">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto text-emerald-600" />
                  <p>Loading departures...</p>
                </div>
              ) : !data?.todayDepartures || data.todayDepartures.length === 0 ? (
                <div className="py-8 text-center space-y-1.5">
                  <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-slate-500">No departures scheduled for today.</p>
                </div>
              ) : (
                data.todayDepartures.map((res: any) => (
                  <div
                    key={res._id}
                    className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 rounded-md px-1.5 transition-colors"
                  >
                    <div
                      className="cursor-pointer min-w-0 flex-1"
                      onClick={() => setSelectedResId(res._id)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 truncate">
                          {res.guestSnapshot?.fullName}
                        </span>
                        <span className="badge badge-xs font-mono font-bold bg-slate-100 text-slate-800 border-slate-200 shrink-0 rounded">
                          Site {res.siteSnapshot?.siteNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span>Balance: {formatCurrency(res.pricing?.balanceDue)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {res.pricing?.balanceDue > 0 ? (
                        <button
                          onClick={() => setPaymentRes(res)}
                          className="btn btn-warning btn-xs font-bold gap-1 text-slate-900 rounded"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          Pay ({formatCurrency(res.pricing.balanceDue)})
                        </button>
                      ) : (
                        <button
                          onClick={() => handleQuickCheckOut(res)}
                          className="btn btn-info btn-xs text-white font-bold gap-1 rounded"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Check Out
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Upcoming 7-Day Bookings & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Upcoming 7-Day Bookings */}
        <div className="lg:col-span-2 surface-card p-4 sm:p-5 rounded-lg space-y-3 border border-slate-200">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-emerald-600" />
              Upcoming Arrivals (Next 7 Days)
            </h3>
            <Link
              href="/tape-chart"
              className="text-xs text-emerald-700 font-bold hover:underline"
            >
              View Tape Chart →
            </Link>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="table table-sm min-w-[500px]">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th>Code</th>
                  <th>Guest</th>
                  <th>Site</th>
                  <th>Arrival</th>
                  <th>Nights</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {!data?.upcomingReservations || data.upcomingReservations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-xs text-slate-500">
                      No upcoming reservations in next 7 days.
                    </td>
                  </tr>
                ) : (
                  data.upcomingReservations.map((res: any) => (
                    <tr
                      key={res._id}
                      onClick={() => setSelectedResId(res._id)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100"
                    >
                      <td className="font-mono font-bold text-xs text-emerald-700">
                        {res.confirmationCode}
                      </td>
                      <td className="font-bold text-slate-900">{res.guestSnapshot?.fullName}</td>
                      <td>
                        <span className="badge badge-xs font-mono font-bold bg-slate-100 text-slate-700 border-slate-200 rounded">
                          {res.siteSnapshot?.siteNumber}
                        </span>
                      </td>
                      <td className="text-xs font-medium">{formatDate(res.checkInDate)}</td>
                      <td className="text-xs font-mono">{res.numNights} nt</td>
                      <td>
                        <ReservationBadge status={res.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Payment Ledger */}
        <div className="surface-card p-4 sm:p-5 rounded-lg space-y-3 border border-slate-200">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Recent Payments
            </h3>
            <Link
              href="/payments"
              className="text-xs text-emerald-700 font-bold hover:underline"
            >
              All Ledger →
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {!data?.recentPayments || data.recentPayments.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No recent payment transactions recorded.
              </div>
            ) : (
              data.recentPayments.map((p: any) => (
                <div key={p._id} className="py-2 flex items-center justify-between text-xs gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">
                      {p.guestId ? `${p.guestId.firstName} ${p.guestId.lastName}` : "Guest"}
                    </div>
                    <div className="text-slate-500 text-[11px] capitalize truncate">
                      {p.method?.replace("_", " ")} • {formatDateTime(p.createdAt)}
                    </div>
                  </div>
                  <div className="font-black text-emerald-700 text-xs font-mono shrink-0">
                    +{formatCurrency(p.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Global Modals on Dashboard */}
      <ReservationDetailModal
        reservationId={selectedResId}
        isOpen={!!selectedResId}
        onClose={() => setSelectedResId(null)}
        onUpdated={loadDashboard}
        onOpenPayment={(res) => {
          setSelectedResId(null);
          setPaymentRes(res);
        }}
      />

      <PaymentModal
        reservation={paymentRes}
        isOpen={!!paymentRes}
        onClose={() => setPaymentRes(null)}
        onSuccess={() => {
          setPaymentRes(null);
          loadDashboard();
        }}
      />
    </div>
  );
}
