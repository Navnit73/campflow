"use client";

import React from "react";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, formatDate, formatRvType } from "@/lib/utils/format";
import {
  Calendar,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Truck,
  Loader2,
  Clock,
} from "lucide-react";
import { DropResult } from "@/hooks/useTapeChartDrag";

interface MoveConfirmationModalProps {
  isOpen: boolean;
  dropData: DropResult | null;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function MoveConfirmationModal({
  isOpen,
  dropData,
  loading = false,
  onConfirm,
  onClose,
}: MoveConfirmationModalProps) {
  if (!isOpen || !dropData) return null;

  const {
    reservation,
    targetSite,
    previousSite,
    checkInDate,
    checkOutDate,
    previousCheckInDate,
    previousCheckOutDate,
    nights,
    rateDiff,
    rigWarning,
  } = dropData;

  const prevNights = reservation.numNights || 1;
  const prevRate = previousSite?.currentBaseRate || reservation.pricing?.nightlyRate || 50;
  const newRate = targetSite?.currentBaseRate || prevRate;

  const prevSubtotal = prevRate * prevNights;
  const newSubtotal = newRate * nights;
  const subtotalDiff = newSubtotal - prevSubtotal;

  const isSiteChanged = targetSite?._id !== previousSite?._id;
  const isDateChanged =
    checkInDate !== previousCheckInDate || checkOutDate !== previousCheckOutDate;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Booking Move"
      subtitle={`Review changes for ${reservation.guestSnapshot?.fullName || "Guest"} (${reservation.confirmationCode})`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {/* Guest Summary Card */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
              {reservation.guestSnapshot?.fullName?.[0] || "G"}
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">
                {reservation.guestSnapshot?.fullName}
              </div>
              <div className="text-slate-500 font-mono text-[11px]">
                {reservation.confirmationCode} • {reservation.guestSnapshot?.phone}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 font-medium">
            <Truck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{formatRvType(reservation.guestSnapshot?.rvType || "travel_trailer")}</span>
            {reservation.guestSnapshot?.rvLengthFt && (
              <span className="font-bold font-mono">({reservation.guestSnapshot.rvLengthFt}ft)</span>
            )}
          </div>
        </div>

        {/* Change Comparison Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Previous Assignment */}
          <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2 relative">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Current Assignment
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-bold text-sm text-slate-800">
                  Site {previousSite?.siteNumber || reservation.siteSnapshot?.siteNumber}
                </span>
                <span className="text-[11px] text-slate-500 truncate">
                  ({previousSite?.siteTypeSnapshot?.name || reservation.siteSnapshot?.siteTypeName})
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  {formatDate(previousCheckInDate)} → {formatDate(previousCheckOutDate)}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-mono">{prevNights} night{prevNights > 1 ? "s" : ""}</span>
                <span className="text-slate-400">•</span>
                <span className="font-mono">{formatCurrency(prevRate)}/nt</span>
              </div>
            </div>
          </div>

          {/* New Assignment */}
          <div className="p-3.5 rounded-lg border-2 border-emerald-500 bg-emerald-50/20 space-y-2 relative shadow-xs">
            <div className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center justify-between">
              <span>New Target Assignment</span>
              <span className="badge badge-success badge-xs text-[9px] font-black uppercase text-white">
                New
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold text-sm text-emerald-950">
                  Site {targetSite?.siteNumber}
                </span>
                <span className="text-[11px] text-emerald-800 truncate">
                  ({targetSite?.siteTypeSnapshot?.name})
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {formatDate(checkInDate)} → {formatDate(checkOutDate)}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-700">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-mono font-bold">{nights} night{nights > 1 ? "s" : ""}</span>
                <span className="text-slate-400">•</span>
                <span className="font-mono font-bold text-emerald-900">
                  {formatCurrency(newRate)}/nt
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Warning Badge if Rig Length Exceeds Site Limit */}
        {rigWarning && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Clearance Warning</div>
              <div className="text-amber-800 mt-0.5">{rigWarning}</div>
            </div>
          </div>
        )}

        {/* Rate Impact Summary */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-600">
            <span>Rate Difference:</span>
            <span
              className={`font-mono font-bold ${
                rateDiff > 0
                  ? "text-emerald-700"
                  : rateDiff < 0
                  ? "text-rose-700"
                  : "text-slate-700"
              }`}
            >
              {rateDiff > 0 ? `+${formatCurrency(rateDiff)}/nt` : rateDiff < 0 ? `-${formatCurrency(Math.abs(rateDiff))}/nt` : "Same Rate ($0/nt)"}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <span>Base Subtotal Adjustment:</span>
            <span
              className={`font-mono font-bold ${
                subtotalDiff > 0
                  ? "text-emerald-700"
                  : subtotalDiff < 0
                  ? "text-rose-700"
                  : "text-slate-700"
              }`}
            >
              {formatCurrency(prevSubtotal)} → {formatCurrency(newSubtotal)}{" "}
              ({subtotalDiff >= 0 ? `+${formatCurrency(subtotalDiff)}` : `-${formatCurrency(Math.abs(subtotalDiff))}`})
            </span>
          </div>

          <div className="pt-1.5 border-t border-slate-200 text-[11px] text-slate-500">
            Taxes and total balance due will be automatically recalculated upon confirmation.
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn btn-ghost btn-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="btn btn-primary btn-sm px-5 font-bold shadow-xs flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirm Move
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
