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
  Filter,
  CheckCircle2,
  LogOut,
  ChevronLeft,
  ChevronRight,
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
        success("Guest checked in!");
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
        success("Guest checked out!");
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
          <h1 className="text-2xl font-bold tracking-tight text-base-content">
            Reservations
          </h1>
          <p className="text-xs text-base-content/60 mt-0.5">
            Manage campground bookings, check-in guests, and inspect folios
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNewBookingOpen(true)}
            className="btn btn-primary btn-sm gap-1.5 font-medium shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            New Booking
          </button>
          <button
            onClick={() => fetchReservations(pagination.page)}
            className="btn btn-ghost btn-sm btn-circle"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="card bg-base-100 shadow-sm border border-base-200 p-4 space-y-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1 border-b border-base-200 pb-3">
          {statuses.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === s.value
                  ? "bg-primary text-primary-content shadow-xs"
                  : "text-base-content/70 hover:bg-base-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Search & Dates Row */}
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="w-4 h-4 text-base-content/50 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Guest Name, Confirmation Code, Phone, or Site..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-bordered input-sm w-full pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input input-bordered input-sm text-xs"
              title="Filter from Check-in Date"
            />
            <span className="text-xs text-base-content/50">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input input-bordered input-sm text-xs"
              title="Filter to Check-in Date"
            />
            <button type="submit" className="btn btn-outline btn-sm font-semibold">
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
                className="btn btn-ghost btn-sm text-xs"
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Reservations Compact Data Table */}
      <div className="card bg-base-100 shadow-sm border border-base-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead className="bg-base-200/50">
              <tr>
                <th>Code</th>
                <th>Guest & Rig</th>
                <th>Site</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Nights</th>
                <th>Status</th>
                <th>Total</th>
                <th>Balance</th>
                <th className="text-right">Desk Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-xs text-base-content/60">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading reservations...
                  </td>
                </tr>
              ) : reservations.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-sm text-base-content/50">
                    No reservations found matching your criteria.
                  </td>
                </tr>
              ) : (
                reservations.map((res) => (
                  <tr
                    key={res._id}
                    onClick={() => setSelectedResId(res._id)}
                    className="hover:bg-base-200/40 cursor-pointer transition-colors"
                  >
                    <td className="font-mono font-bold text-xs text-primary">
                      {res.confirmationCode}
                    </td>
                    <td>
                      <div className="font-bold text-sm text-base-content">
                        {res.guestSnapshot?.fullName}
                      </div>
                      <div className="text-[11px] text-base-content/60 flex items-center gap-1">
                        <span>{formatRvType(res.guestSnapshot?.rvType || "travel_trailer")}</span>
                        {res.guestSnapshot?.rvLengthFt ? (
                          <span className="font-mono">({res.guestSnapshot.rvLengthFt}ft)</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-sm badge-outline font-mono font-bold">
                        Site {res.siteSnapshot?.siteNumber}
                      </span>
                    </td>
                    <td className="text-xs">{formatDate(res.checkInDate)}</td>
                    <td className="text-xs">{formatDate(res.checkOutDate)}</td>
                    <td className="text-xs font-semibold">{res.numNights} nt</td>
                    <td>
                      <ReservationBadge status={res.status} />
                    </td>
                    <td className="font-semibold text-xs text-base-content">
                      {formatCurrency(res.pricing?.totalAmount)}
                    </td>
                    <td>
                      {res.pricing?.balanceDue > 0 ? (
                        <span className="font-bold text-xs text-error">
                          {formatCurrency(res.pricing?.balanceDue)}
                        </span>
                      ) : (
                        <span className="font-semibold text-xs text-emerald-600">Paid</span>
                      )}
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {res.status === "confirmed" && (
                          <button
                            onClick={(e) => handleQuickCheckIn(e, res._id)}
                            className="btn btn-success btn-xs text-white font-medium"
                            title="Check In"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Check In
                          </button>
                        )}
                        {res.status === "checked_in" && (
                          <button
                            onClick={(e) => handleQuickCheckOut(e, res)}
                            className="btn btn-info btn-xs text-white font-medium"
                            title="Check Out"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            Check Out
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedResId(res._id)}
                          className="btn btn-ghost btn-xs text-primary font-medium"
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
          <div className="p-4 border-t border-base-200 flex items-center justify-between text-xs text-base-content/70">
            <div>
              Showing {reservations.length} of {pagination.total} reservations
            </div>
            <div className="join">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchReservations(pagination.page - 1)}
                className="btn btn-outline btn-xs join-item"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button className="btn btn-outline btn-xs join-item font-mono font-bold">
                Page {pagination.page} / {pagination.totalPages}
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchReservations(pagination.page + 1)}
                className="btn btn-outline btn-xs join-item"
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
