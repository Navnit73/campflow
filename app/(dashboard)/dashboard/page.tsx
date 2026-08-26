"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import apiClient from "@/lib/axios/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { StatCard } from "@/components/ui/StatCard";
import { ReservationBadge, PaymentStatusBadge } from "@/components/ui/Badge";
import { ReservationDetailModal } from "@/components/reservations/ReservationDetailModal";
import { PaymentModal } from "@/components/payments/PaymentModal";
import { formatCurrency, formatDate, formatRvType, formatDateTime } from "@/lib/utils/format";
import {
  CalendarDays,
  CheckCircle2,
  LogOut,
  MapPin,
  TrendingUp,
  Users,
  DollarSign,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  Truck,
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
        success("Guest checked in!");
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
        success("Guest checked out!");
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
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-base-content">
            Front Desk Overview
          </h1>
          <p className="text-xs text-base-content/60 mt-0.5">
            Real-time campground occupancy, arrivals, and operations desk
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/tape-chart" className="btn btn-outline btn-sm gap-1.5 font-semibold">
            <CalendarDays className="w-4 h-4 text-primary" />
            Visual Tape Chart
          </Link>
          <button
            onClick={loadDashboard}
            className="btn btn-ghost btn-sm btn-circle"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Primary KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Occupancy Rate"
          value={`${stats.occupancyRate}%`}
          subtitle={`${stats.currentlyOnsite} of ${stats.totalSites} active sites filled`}
          icon={<TrendingUp className="w-6 h-6 text-emerald-600" />}
          colorClass="bg-emerald-500/10"
        />
        <StatCard
          title="Available Sites"
          value={stats.availableToday}
          subtitle="Ready for walk-ins & bookings"
          icon={<MapPin className="w-6 h-6 text-sky-600" />}
          colorClass="bg-sky-500/10"
        />
        <StatCard
          title="Arriving Today"
          value={stats.todayArrivalsCount}
          subtitle="Pending check-in at desk"
          icon={<CheckCircle2 className="w-6 h-6 text-amber-600" />}
          colorClass="bg-amber-500/10"
        />
        <StatCard
          title="Departing Today"
          value={stats.todayDeparturesCount}
          subtitle="Scheduled checkout today"
          icon={<LogOut className="w-6 h-6 text-indigo-600" />}
          colorClass="bg-indigo-500/10"
        />
      </div>

      {/* Main Operations Desk: Arrivals & Departures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Arrivals */}
        <div className="card bg-base-100 shadow-sm border border-base-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-base-200">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                <h3 className="font-bold text-sm text-base-content">
                  Today&apos;s Arrivals ({data?.todayArrivals?.length || 0})
                </h3>
              </div>
              <Link href="/reservations" className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                All Bookings <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-base-200 mt-2">
              {loading ? (
                <div className="py-8 text-center text-xs text-base-content/60">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-primary" />
                  Loading arrivals...
                </div>
              ) : !data?.todayArrivals || data.todayArrivals.length === 0 ? (
                <div className="py-8 text-center text-xs text-base-content/50">
                  No upcoming arrivals scheduled for today.
                </div>
              ) : (
                data.todayArrivals.map((res: any) => (
                  <div key={res._id} className="py-3 flex items-center justify-between gap-3 hover:bg-base-50/50 rounded-lg px-1 transition-colors">
                    <div
                      className="cursor-pointer"
                      onClick={() => setSelectedResId(res._id)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-base-content">
                          {res.guestSnapshot?.fullName}
                        </span>
                        <span className="badge badge-sm badge-neutral font-mono text-[11px]">
                          Site {res.siteSnapshot?.siteNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-base-content/60 mt-0.5">
                        <span>{res.numNights} nights</span>
                        <span>•</span>
                        <span>{formatRvType(res.guestSnapshot?.rvType || "travel_trailer")}</span>
                        {res.pricing?.balanceDue > 0 && (
                          <span className="text-error font-semibold">
                            (Due: {formatCurrency(res.pricing.balanceDue)})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleQuickCheckIn(res._id)}
                        className="btn btn-success btn-xs text-white font-medium gap-1"
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
        <div className="card bg-base-100 shadow-sm border border-base-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-base-200">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                <h3 className="font-bold text-sm text-base-content">
                  Today&apos;s Departures ({data?.todayDepartures?.length || 0})
                </h3>
              </div>
              <Link href="/reservations?status=checked_in" className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                Onsite Guests <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-base-200 mt-2">
              {loading ? (
                <div className="py-8 text-center text-xs text-base-content/60">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-primary" />
                  Loading departures...
                </div>
              ) : !data?.todayDepartures || data.todayDepartures.length === 0 ? (
                <div className="py-8 text-center text-xs text-base-content/50">
                  No checkouts scheduled for today.
                </div>
              ) : (
                data.todayDepartures.map((res: any) => (
                  <div key={res._id} className="py-3 flex items-center justify-between gap-3 hover:bg-base-50/50 rounded-lg px-1 transition-colors">
                    <div
                      className="cursor-pointer"
                      onClick={() => setSelectedResId(res._id)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-base-content">
                          {res.guestSnapshot?.fullName}
                        </span>
                        <span className="badge badge-sm badge-neutral font-mono text-[11px]">
                          Site {res.siteSnapshot?.siteNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-base-content/60 mt-0.5">
                        <span>Balance: {formatCurrency(res.pricing?.balanceDue)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {res.pricing?.balanceDue > 0 ? (
                        <button
                          onClick={() => setPaymentRes(res)}
                          className="btn btn-warning btn-xs font-medium gap-1"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          Pay ({formatCurrency(res.pricing.balanceDue)})
                        </button>
                      ) : (
                        <button
                          onClick={() => handleQuickCheckOut(res)}
                          className="btn btn-info btn-xs text-white font-medium gap-1"
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming 7-Day Bookings */}
        <div className="lg:col-span-2 card bg-base-100 shadow-sm border border-base-200 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-base-200">
            <h3 className="font-bold text-sm text-base-content flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Upcoming Arrivals (Next 7 Days)
            </h3>
            <Link href="/tape-chart" className="text-xs text-primary font-semibold hover:underline">
              View on Tape Chart →
            </Link>
          </div>

          <div className="overflow-x-auto mt-2">
            <table className="table table-sm">
              <thead>
                <tr>
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
                    <td colSpan={6} className="text-center py-6 text-xs text-base-content/50">
                      No upcoming reservations in next 7 days.
                    </td>
                  </tr>
                ) : (
                  data.upcomingReservations.map((res: any) => (
                    <tr
                      key={res._id}
                      onClick={() => setSelectedResId(res._id)}
                      className="hover:bg-base-200/50 cursor-pointer"
                    >
                      <td className="font-mono font-bold text-xs text-primary">
                        {res.confirmationCode}
                      </td>
                      <td className="font-semibold">{res.guestSnapshot?.fullName}</td>
                      <td>
                        <span className="badge badge-sm badge-ghost font-mono">
                          {res.siteSnapshot?.siteNumber}
                        </span>
                      </td>
                      <td>{formatDate(res.checkInDate)}</td>
                      <td>{res.numNights} nt</td>
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
        <div className="card bg-base-100 shadow-sm border border-base-200 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-base-200">
            <h3 className="font-bold text-sm text-base-content flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Recent Payments
            </h3>
            <Link href="/payments" className="text-xs text-primary font-semibold hover:underline">
              All Ledger →
            </Link>
          </div>

          <div className="divide-y divide-base-200 mt-2">
            {!data?.recentPayments || data.recentPayments.length === 0 ? (
              <div className="py-6 text-center text-xs text-base-content/50">
                No recent payment transactions recorded.
              </div>
            ) : (
              data.recentPayments.map((p: any) => (
                <div key={p._id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-base-content">
                      {p.guestId ? `${p.guestId.firstName} ${p.guestId.lastName}` : "Guest"}
                    </div>
                    <div className="text-base-content/60 text-[11px] capitalize">
                      {p.method?.replace("_", " ")} • {formatDateTime(p.createdAt)}
                    </div>
                  </div>
                  <div className="font-bold text-emerald-600 text-sm">
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
