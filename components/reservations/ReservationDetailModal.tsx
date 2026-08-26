"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { Modal } from "@/components/ui/Modal";
import { ReservationBadge, PaymentStatusBadge } from "@/components/ui/Badge";
import { HookupIcons } from "@/components/ui/HookupIcons";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate, formatRvType, formatDateTime } from "@/lib/utils/format";
import {
  CheckCircle2,
  LogOut,
  Ban,
  CreditCard,
  User,
  Calendar,
  MapPin,
  Truck,
  Printer,
  DollarSign,
  RefreshCw,
  Edit2,
} from "lucide-react";
import { EditReservationModal } from "@/components/reservations/EditReservationModal";

interface ReservationDetailModalProps {
  reservationId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onOpenPayment: (res: any) => void;
}

export function ReservationDetailModal({
  reservationId,
  isOpen,
  onClose,
  onUpdated,
  onOpenPayment,
}: ReservationDetailModalProps) {
  const { success, error } = useToast();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const fetchDetails = async () => {
    if (!reservationId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/api/reservations/${reservationId}`);
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err: any) {
      error(err?.message || "Failed to load reservation details");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && reservationId) {
      fetchDetails();
    } else {
      setData(null);
    }
  }, [isOpen, reservationId]);

  const handleCheckIn = async () => {
    if (!reservationId) return;
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/api/reservations/${reservationId}/check-in`);
      if (res.data?.success) {
        success("Guest successfully checked in!");
        fetchDetails();
        onUpdated();
      }
    } catch (err: any) {
      error(err?.message || "Failed to check in");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!reservationId) return;
    if (data?.pricing?.balanceDue > 0) {
      if (!confirm(`Warning: Guest still has an unpaid balance of ${formatCurrency(data.pricing.balanceDue)}. Proceed with check-out?`)) {
        return;
      }
    }
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/api/reservations/${reservationId}/check-out`);
      if (res.data?.success) {
        success("Guest successfully checked out!");
        fetchDetails();
        onUpdated();
      }
    } catch (err: any) {
      error(err?.message || "Failed to check out");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!reservationId) return;
    const reason = prompt("Enter cancellation reason (optional):");
    if (reason === null) return;

    setActionLoading(true);
    try {
      const res = await apiClient.post(`/api/reservations/${reservationId}/cancel`, { notes: reason });
      if (res.data?.success) {
        success("Reservation cancelled.");
        fetchDetails();
        onUpdated();
      }
    } catch (err: any) {
      error(err?.message || "Failed to cancel reservation");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={data ? `Reservation ${data.confirmationCode}` : "Loading Details..."}
      subtitle={data ? `Booked via ${data.source?.replace("_", " ")}` : undefined}
      maxWidth="max-w-3xl"
    >
      {loading || !data ? (
        <div className="p-10 text-center text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-emerald-600" />
          Loading reservation details...
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top Status & Fast Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2.5">
              <ReservationBadge status={data.status} />
              <span className="text-sm font-bold text-slate-800">
                Site {data.siteSnapshot?.siteNumber}{" "}
                <span className="font-normal text-slate-500">({data.siteSnapshot?.siteTypeName})</span>
              </span>
            </div>

            {/* Desk Operations CTAs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {data.status === "confirmed" && (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading}
                  className="btn btn-success btn-xs sm:btn-sm text-white gap-1 font-bold rounded-md"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Check In
                </button>
              )}

              {data.status === "checked_in" && (
                <button
                  onClick={handleCheckOut}
                  disabled={actionLoading}
                  className="btn btn-info btn-xs sm:btn-sm text-white gap-1 font-bold rounded-md"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Check Out
                </button>
              )}

              {data.pricing?.balanceDue > 0 && (
                <button
                  onClick={() => onOpenPayment(data)}
                  className="btn btn-primary btn-xs sm:btn-sm gap-1 font-bold rounded-md"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Collect Payment ({formatCurrency(data.pricing.balanceDue)})
                </button>
              )}

              <button
                onClick={() => setIsEditOpen(true)}
                className="btn btn-outline btn-xs sm:btn-sm gap-1 font-bold text-slate-700 rounded-md hover:bg-slate-100"
                title="Edit Dates, Site or Guest"
              >
                <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
                Edit
              </button>

              {data.status !== "cancelled" && data.status !== "checked_out" && (
                <button
                  onClick={handleCancel}
                  disabled={actionLoading}
                  className="btn btn-ghost btn-xs sm:btn-sm text-rose-700 font-semibold gap-1 hover:bg-rose-50 rounded-md"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Cancel
                </button>
              )}

              <button
                onClick={handlePrint}
                className="btn btn-outline btn-xs sm:btn-sm gap-1 font-semibold text-slate-700 rounded-md"
                title="Print Confirmation / Folio"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </div>
          </div>

          {/* 3-Column Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Stay Dates */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                Stay ({data.numNights} Nights)
              </div>
              <div className="pt-0.5">
                <div className="text-[11px] text-slate-500 font-semibold">Check-In:</div>
                <div className="text-sm font-bold text-slate-800">{formatDate(data.checkInDate)}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 font-semibold">Check-Out:</div>
                <div className="text-sm font-bold text-slate-800">{formatDate(data.checkOutDate)}</div>
              </div>
              <div className="text-xs text-slate-600 pt-1.5 border-t border-slate-100 font-medium">
                {data.adults} Adults • {data.children} Children • {data.pets} Pets
              </div>
            </div>

            {/* Guest & Rig */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <User className="w-3.5 h-3.5 text-emerald-600" />
                Guest Profile
              </div>
              <div className="pt-0.5">
                <div className="text-sm font-bold text-slate-800">{data.guestSnapshot?.fullName}</div>
                <div className="text-xs text-slate-600 truncate">{data.guestSnapshot?.email}</div>
                <div className="text-xs font-mono text-slate-600">{data.guestSnapshot?.phone}</div>
              </div>
              <div className="pt-1.5 border-t border-slate-100 flex items-center gap-1 text-xs text-slate-700 font-medium">
                <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">
                  {formatRvType(data.guestSnapshot?.rvType || "travel_trailer")}{" "}
                  {data.guestSnapshot?.rvLengthFt ? `(${data.guestSnapshot.rvLengthFt}ft)` : ""}
                </span>
              </div>
            </div>

            {/* Site Specs */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                Site Details
              </div>
              <div className="pt-0.5">
                <div className="text-sm font-bold text-slate-800 font-mono">
                  Site {data.siteSnapshot?.siteNumber}
                </div>
                <div className="text-xs text-slate-600">{data.siteSnapshot?.siteTypeName}</div>
              </div>
              <div className="pt-1.5">
                <HookupIcons
                  hookups={data.siteSnapshot?.hookups}
                  rigType={data.siteSnapshot?.rigType}
                  compact
                />
              </div>
            </div>
          </div>

          {/* Pricing & Financial Breakdown */}
          <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Billing Summary
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                Nightly Rate: {formatCurrency(data.pricing?.nightlyRate)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-xs text-slate-500 font-semibold">Subtotal</div>
                <div className="font-bold text-slate-800 font-mono text-xs sm:text-sm">
                  {formatCurrency(data.pricing?.baseSubtotal)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold">Discount</div>
                <div className="font-bold text-emerald-700 font-mono text-xs sm:text-sm">
                  -{formatCurrency(data.pricing?.discountAmount)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold">Tax (7.5%)</div>
                <div className="font-bold text-slate-800 font-mono text-xs sm:text-sm">
                  +{formatCurrency(data.pricing?.taxAmount)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold">Total Bill</div>
                <div className="font-black text-slate-900 font-mono text-sm sm:text-base">
                  {formatCurrency(data.pricing?.totalAmount)}
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-600 font-medium">Paid: </span>
                <span className="text-sm font-black text-emerald-700 font-mono">
                  {formatCurrency(data.pricing?.paidAmount)}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-600 font-medium">Balance Due: </span>
                <span
                  className={`text-sm font-black font-mono ${
                    data.pricing?.balanceDue > 0 ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  {formatCurrency(data.pricing?.balanceDue)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Transactions Table */}
          {data.payments && data.payments.length > 0 && (
            <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Payment History ({data.payments.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="table table-xs">
                  <thead>
                    <tr className="text-slate-500">
                      <th>Date</th>
                      <th>Method</th>
                      <th>Reference</th>
                      <th>Status</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((p: any) => (
                      <tr key={p._id}>
                        <td className="text-xs">{formatDateTime(p.createdAt)}</td>
                        <td className="capitalize font-medium">{p.method?.replace("_", " ")}</td>
                        <td className="font-mono text-[11px] text-slate-500">
                          {p.transactionReference || "—"}
                        </td>
                        <td>
                          <PaymentStatusBadge status={p.status} />
                        </td>
                        <td className="text-right font-bold text-emerald-700 font-mono">
                          {formatCurrency(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          {(data.specialRequests || data.notes) && (
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1">
              {data.specialRequests && (
                <div>
                  <span className="font-bold text-slate-800">Guest Requests: </span>
                  <span className="text-slate-700">{data.specialRequests}</span>
                </div>
              )}
              {data.notes && (
                <div>
                  <span className="font-bold text-slate-800">Staff Notes: </span>
                  <span className="text-slate-700">{data.notes}</span>
                </div>
              )}
            </div>
          )}
          {/* Edit Reservation Modal */}
          <EditReservationModal
            isOpen={isEditOpen}
            reservation={data}
            onClose={() => setIsEditOpen(false)}
            onSuccess={() => {
              setIsEditOpen(false);
              fetchDetails();
              onUpdated();
            }}
          />
        </div>
      )}
    </Modal>
  );
}
