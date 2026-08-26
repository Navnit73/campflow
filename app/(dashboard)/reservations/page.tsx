"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { ReservationBadge } from "@/components/ui/Badge";
import { ReservationDetailModal } from "@/components/reservations/ReservationDetailModal";
import { NewReservationModal } from "@/components/reservations/NewReservationModal";
import { PaymentModal } from "@/components/payments/PaymentModal";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate, formatRvType } from "@/lib/utils/format";
import {
  Search,
  PlusCircle,
  RefreshCw,
  Calendar,
  CheckCircle2,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Filter,
} from "lucide-react";

export default function ReservationsPage() {
  const { success, error } = useToast();
  const [reservations, setReservations] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modals
  const [selectedResId, setSelectedResId] = useState<string | null>(null);
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);
  const [paymentRes, setPaymentRes] = useState<any | null>(null);

  const fetchReservations = async (page = 1) => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/reservations", {
        params: {
          page,
          limit: 20,
          status: statusFilter !== "all" ? statusFilter : undefined,
          search: searchTerm || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      });

      if (res.data?.success) {
        setReservations(res.data.data.reservations);
        setPagination(res.data.data.pagination);
      }
    } catch (err: any) {
      error(err?.message || "Failed to load reservations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations(1);
  }, [statusFilter, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReservations(1);
  };

  const handleQuickCheckIn = async (e: React.MouseEvent, resId: string) => {
    e.stopPropagation();
    try {
      const res = await apiClient.post(`/api/reservations/${resId}/check-in`);
      if (res.data?.success) {
        success("Guest checked in successfully!");
        fetchReservations(pagination.page);
      }
    } catch (err: any) {
      error(err?.message || "Check-in failed");
    }
  };

  const handleQuickCheckOut = async (e: React.MouseEvent, res: any) => {
    e.stopPropagation();
    if (res.pricing?.balanceDue > 0) {
      if (!confirm(`Guest has an unpaid balance of ${formatCurrency(res.pricing.balanceDue)}. Proceed with check-out?`)) {
        return;
      }
    }
    try {
      const resp = await apiClient.post(`/api/reservations/${res._id}/check-out`);
      if (resp.data?.success) {
        success("Guest checked out successfully!");
        fetchReservations(pagination.page);
      }
    } catch (err: any) {
      error(err?.message || "Check-out failed");
    }
  };

  const statuses = [
    { label: "All Bookings", value: "all" },
    { label: "Confirmed", value: "confirmed" },
    { label: "Checked In", value: "checked_in" },
    { label: "Checked Out", value: "checked_out" },
    { label: "Pending", value: "pending" },
    { label: "Cancelled", value: "cancelled" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Reservations
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage campground bookings, check-in guests, and inspect folios
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNewBookingOpen(true)}
            className="btn btn-primary btn-sm gap-1.5 font-bold rounded-md"
          >
            <PlusCircle className="w-4 h-4" />
            New Booking
          </button>
          <button
            onClick={() => fetchReservations(pagination.page)}
            className="btn btn-ghost btn-sm btn-circle text-slate-600 hover:text-slate-900 rounded-md"
            title="Refresh List"
            aria-label="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="surface-card p-3.5 sm:p-4 rounded-lg space-y-3.5 border border-slate-200">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-2.5">
          {statuses.map((s) => {
            const isSelected = statusFilter === s.value;
            return (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-emerald-600 text-white"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Search & Dates Row */}
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Guest Name, Confirmation Code, Phone, or Site..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-bordered input-sm w-full pl-9 text-xs sm:text-sm bg-white rounded-md"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input input-bordered input-sm text-xs bg-white rounded-md"
                title="Filter from Check-in Date"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input input-bordered input-sm text-xs bg-white rounded-md"
                title="Filter to Check-in Date"
              />
            </div>
            <button type="submit" className="btn btn-outline btn-sm font-bold text-xs rounded-md">
              <Filter className="w-3.5 h-3.5" />
              Filter
            </button>
            {(searchTerm || startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setStartDate("");
                  setEndDate("");
                }}
                className="btn btn-ghost btn-sm text-xs font-semibold rounded-md"
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Reservations Data Table */}
      <div className="surface-card rounded-lg overflow-hidden border border-slate-200">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="table table-sm min-w-[860px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="min-w-[110px]">Code</th>
                <th className="min-w-[180px]">Guest & Rig</th>
                <th className="min-w-[100px]">Site</th>
                <th className="min-w-[110px]">Check-In</th>
                <th className="min-w-[110px]">Check-Out</th>
                <th className="min-w-[70px]">Nights</th>
                <th className="min-w-[120px]">Status</th>
                <th className="min-w-[90px]">Total</th>
                <th className="min-w-[90px]">Balance</th>
                <th className="text-right min-w-[130px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-14 text-xs text-slate-500 space-y-2">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-1" />
                    <p>Loading reservations...</p>
                  </td>
                </tr>
              ) : reservations.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-14 space-y-2">
                    <div className="w-10 h-10 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Inbox className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No reservations found</p>
                    <p className="text-xs text-slate-500">Try adjusting your filters or search terms.</p>
                  </td>
                </tr>
              ) : (
                reservations.map((res) => (
                  <tr
                    key={res._id}
                    onClick={() => setSelectedResId(res._id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100"
                  >
                    <td className="font-mono font-bold text-xs text-emerald-700">
                      {res.confirmationCode}
                    </td>
                    <td>
                      <div className="font-bold text-sm text-slate-900 truncate">
                        {res.guestSnapshot?.fullName}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <span>{formatRvType(res.guestSnapshot?.rvType || "travel_trailer")}</span>
                        {res.guestSnapshot?.rvLengthFt ? (
                          <span className="font-mono">({res.guestSnapshot.rvLengthFt}ft)</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-xs font-mono font-bold bg-slate-100 text-slate-700 border-slate-200 rounded">
                        Site {res.siteSnapshot?.siteNumber}
                      </span>
                    </td>
                    <td className="text-xs font-medium">{formatDate(res.checkInDate)}</td>
                    <td className="text-xs font-medium">{formatDate(res.checkOutDate)}</td>
                    <td className="text-xs font-mono font-semibold">{res.numNights} nt</td>
                    <td>
                      <ReservationBadge status={res.status} />
                    </td>
                    <td className="font-bold text-xs text-slate-800 font-mono">
                      {formatCurrency(res.pricing?.totalAmount)}
                    </td>
                    <td>
                      {res.pricing?.balanceDue > 0 ? (
                        <span className="font-bold text-xs text-rose-700 font-mono">
                          {formatCurrency(res.pricing?.balanceDue)}
                        </span>
                      ) : (
                        <span className="font-bold text-xs text-emerald-700 font-mono">Paid</span>
                      )}
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {res.status === "confirmed" && (
                          <button
                            onClick={(e) => handleQuickCheckIn(e, res._id)}
                            className="btn btn-success btn-xs text-white font-bold rounded"
                            title="Check In"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Check In
                          </button>
                        )}
                        {res.status === "checked_in" && (
                          <button
                            onClick={(e) => handleQuickCheckOut(e, res)}
                            className="btn btn-info btn-xs text-white font-bold rounded"
                            title="Check Out"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            Check Out
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedResId(res._id)}
                          className="btn btn-ghost btn-xs text-emerald-700 font-bold hover:bg-emerald-50 rounded"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50">
            <div>
              Showing <span className="font-bold">{reservations.length}</span> of{" "}
              <span className="font-bold">{pagination.total}</span> reservations
            </div>
            <div className="join">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchReservations(pagination.page - 1)}
                className="btn btn-outline btn-xs join-item rounded-l-md"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button className="btn btn-outline btn-xs join-item font-mono font-bold">
                Page {pagination.page} / {pagination.totalPages}
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchReservations(pagination.page + 1)}
                className="btn btn-outline btn-xs join-item rounded-r-md"
                aria-label="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ReservationDetailModal
        reservationId={selectedResId}
        isOpen={!!selectedResId}
        onClose={() => setSelectedResId(null)}
        onUpdated={() => fetchReservations(pagination.page)}
        onOpenPayment={(res) => {
          setSelectedResId(null);
          setPaymentRes(res);
        }}
      />

      <NewReservationModal
        isOpen={isNewBookingOpen}
        onClose={() => setIsNewBookingOpen(false)}
        onSuccess={() => {
          setIsNewBookingOpen(false);
          fetchReservations(1);
        }}
      />

      <PaymentModal
        reservation={paymentRes}
        isOpen={!!paymentRes}
        onClose={() => setPaymentRes(null)}
        onSuccess={() => {
          setPaymentRes(null);
          fetchReservations(pagination.page);
        }}
      />
    </div>
  );
}
