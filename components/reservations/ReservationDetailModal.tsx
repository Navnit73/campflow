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
  Clock,
  RefreshCw,
} from "lucide-react";

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
      maxWidth="max-w-4xl"
    >
      {loading || !data ? (
        <div className="p-12 text-center text-base-content/60">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
          Loading reservation details...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Status & Fast Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-base-200/50 border border-base-200">
            <div className="flex items-center gap-3">
              <ReservationBadge status={data.status} />
              <span className="text-sm font-semibold text-base-content">
                Site {data.siteSnapshot?.siteNumber} ({data.siteSnapshot?.siteTypeName})
              </span>
            </div>

            {/* Desk Operations CTAs */}
            <div className="flex flex-wrap items-center gap-2">
              {data.status === "confirmed" && (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading}
                  className="btn btn-success btn-sm text-white gap-1.5 font-medium shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Check In Guest
                </button>
              )}

              {data.status === "checked_in" && (
                <button
                  onClick={handleCheckOut}
                  disabled={actionLoading}
                  className="btn btn-info btn-sm text-white gap-1.5 font-medium shadow-xs"
                >
                  <LogOut className="w-4 h-4" />
                  Check Out Guest
                </button>
              )}

              {data.pricing?.balanceDue > 0 && (
                <button
                  onClick={() => onOpenPayment(data)}
                  className="btn btn-primary btn-sm gap-1.5 font-medium shadow-xs"
                >
                  <DollarSign className="w-4 h-4" />
                  Collect Payment ({formatCurrency(data.pricing.balanceDue)})
                </button>
              )}

              {data.status !== "cancelled" && data.status !== "checked_out" && (
                <button
                  onClick={handleCancel}
                  disabled={actionLoading}
                  className="btn btn-ghost btn-sm text-error gap-1 hover:bg-error/10"
                >
                  <Ban className="w-4 h-4" />
                  Cancel
                </button>
              )}

              <button
                onClick={handlePrint}
                className="btn btn-outline btn-sm gap-1.5"
                title="Print Confirmation / Folio"
              >
                <Printer className="w-4 h-4" />
                Print Folio
              </button>
            </div>
          </div>

          {/* 3-Column Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Stay Dates */}
            <div className="p-4 rounded-xl border border-base-200 bg-base-100 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-base-content/60 uppercase">
                <Calendar className="w-4 h-4 text-primary" />
                Stay Duration ({data.numNights} Nights)
              </div>
              <div className="pt-1">
                <div className="text-xs text-base-content/60">Check-In:</div>
                <div className="text-sm font-bold text-base-content">{formatDate(data.checkInDate)}</div>
              </div>
              <div>
                <div className="text-xs text-base-content/60">Check-Out:</div>
                <div className="text-sm font-bold text-base-content">{formatDate(data.checkOutDate)}</div>
              </div>
              <div className="text-xs text-base-content/70 pt-1 border-t border-base-200">
                {data.adults} Adults • {data.children} Children • {data.pets} Pets
              </div>
            </div>

            {/* Guest & Rig */}
            <div className="p-4 rounded-xl border border-base-200 bg-base-100 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-base-content/60 uppercase">
                <User className="w-4 h-4 text-primary" />
                Guest Profile
              </div>
              <div className="pt-1">
                <div className="text-sm font-bold text-base-content">{data.guestSnapshot?.fullName}</div>
                <div className="text-xs text-base-content/70">{data.guestSnapshot?.email}</div>
                <div className="text-xs font-mono text-base-content/70">{data.guestSnapshot?.phone}</div>
              </div>
              <div className="pt-1 border-t border-base-200 flex items-center gap-1.5 text-xs text-base-content/80">
                <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  {formatRvType(data.guestSnapshot?.rvType || "travel_trailer")}{" "}
                  {data.guestSnapshot?.rvLengthFt ? `(${data.guestSnapshot.rvLengthFt}ft)` : ""}
                </span>
              </div>
            </div>

            {/* Site Specs */}
            <div className="p-4 rounded-xl border border-base-200 bg-base-100 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-base-content/60 uppercase">
                <MapPin className="w-4 h-4 text-primary" />
                Site Details
              </div>
              <div className="pt-1">
                <div className="text-sm font-bold text-base-content">
                  Site {data.siteSnapshot?.siteNumber}
                </div>
                <div className="text-xs text-base-content/70">{data.siteSnapshot?.siteTypeName}</div>
              </div>
              <div className="pt-2">
                <HookupIcons
                  hookups={data.siteSnapshot?.hookups}
                  rigType={data.siteSnapshot?.rigType}
                  compact
                />
              </div>
            </div>
          </div>

          {/* Pricing & Financial Breakdown */}
          <div className="p-4 rounded-xl border border-base-200 bg-base-100">
            <div className="flex items-center justify-between pb-3 border-b border-base-200">
              <h4 className="text-sm font-bold text-base-content flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                Billing Summary
              </h4>
              <span className="text-xs text-base-content/60">
                Nightly Rate: {formatCurrency(data.pricing?.nightlyRate)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-sm">
              <div>
                <div className="text-xs text-base-content/60">Subtotal</div>
                <div className="font-semibold text-base-content">
                  {formatCurrency(data.pricing?.baseSubtotal)}
                </div>
              </div>
              <div>
                <div className="text-xs text-base-content/60">Discount</div>
                <div className="font-semibold text-emerald-600">
                  -{formatCurrency(data.pricing?.discountAmount)}
                </div>
              </div>
              <div>
                <div className="text-xs text-base-content/60">Tax (7.5%)</div>
                <div className="font-semibold text-base-content">
                  +{formatCurrency(data.pricing?.taxAmount)}
                </div>
              </div>
              <div>
                <div className="text-xs text-base-content/60">Total Bill</div>
                <div className="font-bold text-base-content text-base">
                  {formatCurrency(data.pricing?.totalAmount)}
                </div>
              </div>
            </div>

            <div className="mt-3 p-3 rounded-lg bg-base-200/60 flex items-center justify-between">
              <div>
                <span className="text-xs text-base-content/60 font-medium">Paid Amount: </span>
                <span className="text-sm font-bold text-emerald-600">
                  {formatCurrency(data.pricing?.paidAmount)}
                </span>
              </div>
              <div>
                <span className="text-xs text-base-content/60 font-medium">Balance Due: </span>
                <span
                  className={`text-sm font-bold ${
                    data.pricing?.balanceDue > 0 ? "text-error" : "text-emerald-600"
                  }`}
                >
                  {formatCurrency(data.pricing?.balanceDue)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Transactions Table */}
          {data.payments && data.payments.length > 0 && (
            <div className="p-4 rounded-xl border border-base-200 bg-base-100 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/60">
                Payment History
              </h4>
              <div className="overflow-x-auto">
                <table className="table table-xs">
                  <thead>
                    <tr>
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
                        <td>{formatDateTime(p.createdAt)}</td>
                        <td className="capitalize">{p.method?.replace("_", " ")}</td>
                        <td className="font-mono text-[11px] text-base-content/60">
                          {p.transactionReference || "—"}
                        </td>
                        <td>
                          <PaymentStatusBadge status={p.status} />
                        </td>
                        <td className="text-right font-bold text-emerald-600">
                          {formatCurrency(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes & Special Requests */}
          {(data.specialRequests || data.notes) && (
            <div className="p-4 rounded-xl border border-base-200 bg-base-200/30 text-xs space-y-1">
              {data.specialRequests && (
                <div>
                  <span className="font-bold text-base-content">Guest Special Requests: </span>
                  <span className="text-base-content/80">{data.specialRequests}</span>
                </div>
              )}
              {data.notes && (
                <div>
                  <span className="font-bold text-base-content">Internal Staff Notes: </span>
                  <span className="text-base-content/80">{data.notes}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
