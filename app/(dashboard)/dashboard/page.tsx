"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import apiClient from "@/lib/axios/client";
import { useToast } from "@/components/ui/Toast";
import { StatCard } from "@/components/ui/StatCard";
import { ReservationBadge } from "@/components/ui/Badge";
import { ReservationDetailModal } from "@/components/reservations/ReservationDetailModal";
import { NewReservationModal } from "@/components/reservations/NewReservationModal";
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
  PlusCircle,
  Users,
  AlertCircle,
  CreditCard,
  Layers,
} from "lucide-react";

export default function DashboardPage() {
  const { success, error } = useToast();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals & State
  const [selectedResId, setSelectedResId] = useState<string | null>(null);
  const [paymentRes, setPaymentRes] = useState<any | null>(null);
  const [isNewReservationOpen, setIsNewReservationOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"arrivals" | "departures" | "inhouse">("arrivals");

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
    todayRevenue: 0,
    outstandingBalance: 0,
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Front Desk Operations
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time campground occupancy, fast check-ins, site statuses, and daily billing
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsNewReservationOpen(true)}
            className="btn btn-primary btn-sm gap-1.5 font-bold rounded-md shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            New Reservation
          </button>
          <Link
            href="/tape-chart"
            className="btn btn-outline btn-sm gap-1.5 font-bold text-xs rounded-md bg-white"
          >
            <CalendarDays className="w-4 h-4 text-emerald-600" />
            Tape Chart
          </Link>
          <Link
            href="/sites"
            className="btn btn-outline btn-sm gap-1.5 font-bold text-xs rounded-md bg-white"
          >
            <MapPin className="w-4 h-4 text-sky-600" />
            Visual Map
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

      {/* 8 Primary KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-3.5">
        <StatCard
          title="Occupancy Rate"
          value={`${stats.occupancyRate}%`}
          subtitle={`${stats.currentlyOnsite} of ${stats.totalSites} active sites`}
          icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
          colorClass="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          title="Available Sites"
          value={stats.availableToday}
          subtitle="Vacant & ready for campers"
          icon={<MapPin className="w-4 h-4 text-teal-600" />}
          colorClass="bg-teal-50 text-teal-700"
        />
        <StatCard
          title="Arriving Today"
          value={stats.todayArrivalsCount}
          subtitle="Scheduled desk check-ins"
          icon={<CheckCircle2 className="w-4 h-4 text-amber-600" />}
          colorClass="bg-amber-50 text-amber-700"
        />
        <StatCard
          title="Departing Today"
          value={stats.todayDeparturesCount}
          subtitle="Scheduled departures"
          icon={<LogOut className="w-4 h-4 text-indigo-600" />}
          colorClass="bg-indigo-50 text-indigo-700"
        />
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(stats.todayRevenue || 0)}
          subtitle="Collected offline today"
          icon={<DollarSign className="w-4 h-4 text-emerald-600" />}
          colorClass="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          title="Outstanding Balances"
          value={formatCurrency(stats.outstandingBalance || 0)}
          subtitle="Uncollected across bookings"
          icon={<AlertCircle className="w-4 h-4 text-rose-600" />}
          colorClass="bg-rose-50 text-rose-700"
        />
        <StatCard
          title="Current In-House"
          value={stats.currentlyOnsite}
          subtitle="Checked-in onsite guests"
          icon={<Users className="w-4 h-4 text-sky-600" />}
          colorClass="bg-sky-50 text-sky-700"
        />
        <StatCard
          title="Occupied Sites"
          value={stats.currentlyOnsite}
          subtitle={`Out of ${stats.totalSites} total sites`}
          icon={<Layers className="w-4 h-4 text-violet-600" />}
          colorClass="bg-violet-50 text-violet-700"
        />
      </div>

      {/* Main Operations Desk: Tabbed Arrivals, Departures & In-House */}
      <div className="surface-card rounded-lg border border-slate-200 overflow-hidden">
        {/* Tab Controls */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="join bg-white border border-slate-200 rounded-md p-0.5">
            <button
              onClick={() => setActiveTab("arrivals")}
              className={`btn btn-xs join-item font-bold gap-1.5 ${
                activeTab === "arrivals" ? "bg-emerald-600 text-white" : "btn-ghost text-slate-700"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Today&apos;s Arrivals ({data?.todayArrivals?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("departures")}
              className={`btn btn-xs join-item font-bold gap-1.5 ${
                activeTab === "departures" ? "bg-indigo-600 text-white" : "btn-ghost text-slate-700"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
              Today&apos;s Departures ({data?.todayDepartures?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("inhouse")}
              className={`btn btn-xs join-item font-bold gap-1.5 ${
                activeTab === "inhouse" ? "bg-sky-600 text-white" : "btn-ghost text-slate-700"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-sky-400"></span>
              Currently Onsite ({data?.stats?.currentlyOnsite ?? data?.currentlyOnsiteReservations?.length ?? 0})
            </button>
          </div>

          <Link
            href="/reservations"
            className="text-xs text-emerald-700 font-bold hover:underline inline-flex items-center gap-1"
          >
            All Reservations <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Tab Content 1: Arrivals */}
        {activeTab === "arrivals" && (
          <div className="p-4 divide-y divide-slate-100">
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
                <p className="text-xs text-slate-500">No scheduled arrivals remaining for today.</p>
              </div>
            ) : (
              data.todayArrivals.map((res: any) => (
                <div
                  key={res._id}
                  className="py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 rounded-md px-2 transition-colors"
                >
                  <div
                    className="cursor-pointer min-w-0 flex-1"
                    onClick={() => setSelectedResId(res._id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 truncate">
                        {res.guestSnapshot?.fullName}
                      </span>
                      <span className="badge badge-xs font-mono font-bold bg-emerald-100 text-emerald-800 border-emerald-200 shrink-0 rounded">
                        Site {res.siteSnapshot?.siteNumber}
                      </span>
                      <ReservationBadge status={res.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-1">
                      <span>Stay: {res.numNights} nights ({formatDate(res.checkInDate)} – {formatDate(res.checkOutDate)})</span>
                      <span>•</span>
                      <span>{formatRvType(res.guestSnapshot?.rvType || "travel_trailer")} ({res.guestSnapshot?.rvLengthFt || 30}ft)</span>
                      {res.pricing?.balanceDue > 0 ? (
                        <span className="text-rose-700 font-bold font-mono">
                          • Balance Due: {formatCurrency(res.pricing.balanceDue)}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold">• Paid in Full</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {res.pricing?.balanceDue > 0 && (
                      <button
                        onClick={() => setPaymentRes(res)}
                        className="btn btn-primary btn-xs font-bold gap-1 rounded"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Collect
                      </button>
                    )}
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
        )}

        {/* Tab Content 2: Departures */}
        {activeTab === "departures" && (
          <div className="p-4 divide-y divide-slate-100">
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
                  className="py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 rounded-md px-2 transition-colors"
                >
                  <div
                    className="cursor-pointer min-w-0 flex-1"
                    onClick={() => setSelectedResId(res._id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 truncate">
                        {res.guestSnapshot?.fullName}
                      </span>
                      <span className="badge badge-xs font-mono font-bold bg-indigo-100 text-indigo-800 border-indigo-200 shrink-0 rounded">
                        Site {res.siteSnapshot?.siteNumber}
                      </span>
                      <ReservationBadge status={res.status} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span>Total: {formatCurrency(res.pricing?.totalAmount)}</span>
                      {res.pricing?.balanceDue > 0 ? (
                        <span className="text-rose-700 font-bold font-mono">
                          • Balance Due: {formatCurrency(res.pricing.balanceDue)}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold">• Zero Balance</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {res.pricing?.balanceDue > 0 ? (
                      <button
                        onClick={() => setPaymentRes(res)}
                        className="btn btn-warning btn-xs font-bold gap-1 text-slate-900 rounded"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        Settle ({formatCurrency(res.pricing.balanceDue)})
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
        )}

        {/* Tab Content 3: Currently In-House */}
        {activeTab === "inhouse" && (
          <div className="p-4 divide-y divide-slate-100">
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-500 space-y-2">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto text-emerald-600" />
                <p>Loading onsite campers...</p>
              </div>
            ) : !data?.currentlyOnsiteReservations || data.currentlyOnsiteReservations.length === 0 ? (
              <div className="py-8 text-center space-y-1.5">
                <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Users className="w-4 h-4" />
                </div>
                <p className="text-xs text-slate-500">No guests currently checked-in onsite.</p>
              </div>
            ) : (
              data.currentlyOnsiteReservations.map((res: any) => (
                <div
                  key={res._id}
                  className="py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 rounded-md px-2 transition-colors"
                >
                  <div
                    className="cursor-pointer min-w-0 flex-1"
                    onClick={() => setSelectedResId(res._id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 truncate">
                        {res.guestSnapshot?.fullName}
                      </span>
                      <span className="badge badge-xs font-mono font-bold bg-sky-100 text-sky-800 border-sky-200 shrink-0 rounded">
                        Site {res.siteSnapshot?.siteNumber}
                      </span>
                      <ReservationBadge status={res.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-1">
                      <span>Departing: {formatDate(res.checkOutDate)}</span>
                      <span>•</span>
                      <span>Phone: {res.guestSnapshot?.phone}</span>
                      <span>•</span>
                      <span>{formatRvType(res.guestSnapshot?.rvType || "travel_trailer")}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setSelectedResId(res._id)}
                      className="btn btn-outline btn-xs font-bold rounded"
                    >
                      View Folio
                    </button>
                    <button
                      onClick={() => handleQuickCheckOut(res)}
                      className="btn btn-info btn-xs text-white font-bold gap-1 rounded"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Check Out
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
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
                          Site {res.siteSnapshot?.siteNumber}
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
              Recent Offline Payments
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
                  <div className={`font-black text-xs font-mono shrink-0 ${
                    p.type === "refund" ? "text-rose-700" : "text-emerald-700"
                  }`}>
                    {p.type === "refund" ? `-${formatCurrency(p.amount)}` : `+${formatCurrency(p.amount)}`}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Global Modals on Dashboard */}
      <NewReservationModal
        isOpen={isNewReservationOpen}
        onClose={() => setIsNewReservationOpen(false)}
        onSuccess={() => {
          setIsNewReservationOpen(false);
          loadDashboard();
        }}
      />

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

