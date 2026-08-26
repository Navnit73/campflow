"use client";

import React, { useState } from "react";
import { formatCurrency, formatDate, formatRvType } from "@/lib/utils/format";
import { Layers, ChevronDown, ChevronUp, Truck, Calendar } from "lucide-react";

interface HoldingShelfProps {
  unassignedReservations: any[];
  onSelectReservation: (id: string) => void;
  onQuickAssign?: (reservationId: string) => void;
}

export function HoldingShelf({
  unassignedReservations,
  onSelectReservation,
  onQuickAssign,
}: HoldingShelfProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!unassignedReservations || unassignedReservations.length === 0) {
    return null;
  }

  return (
    <div className="surface-card rounded-lg border border-amber-200 bg-amber-50/40 overflow-hidden transition-all shadow-xs">
      {/* Header Bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3.5 py-2 flex items-center justify-between hover:bg-amber-100/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-700" />
          <span className="text-xs font-bold text-amber-950">
            Holding & Staged Bookings
          </span>
          <span className="badge badge-warning badge-xs font-mono font-bold text-[10px] px-1.5 py-0.5">
            {unassignedReservations.length} Pending
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs text-amber-800 font-semibold">
          <span>{isExpanded ? "Collapse" : "View Staged"}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="p-3 border-t border-amber-200/80 bg-white space-y-2">
          <p className="text-[11px] text-slate-500">
            These bookings require site assignment or were staged during maintenance. Tap on any booking to inspect or assign to an open slot.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
            {unassignedReservations.map((res) => (
              <div
                key={res._id}
                onClick={() => onSelectReservation(res._id)}
                className="p-2.5 rounded-md border border-slate-200 hover:border-amber-400 bg-white hover:bg-amber-50/30 transition-all cursor-pointer space-y-1.5 text-xs group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 truncate">
                    {res.guestSnapshot?.fullName || "Guest"}
                  </span>
                  <span className="font-mono text-[10px] text-emerald-700 font-bold">
                    {res.confirmationCode}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>
                    {formatDate(res.checkInDate)} → {formatDate(res.checkOutDate)} ({res.numNights || 1} nt)
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1">
                    <Truck className="w-3 h-3 text-slate-400" />
                    <span>{formatRvType(res.guestSnapshot?.rvType || "travel_trailer")}</span>
                    {res.guestSnapshot?.rvLengthFt ? (
                      <span className="font-mono">({res.guestSnapshot.rvLengthFt}ft)</span>
                    ) : null}
                  </div>
                  <span className="font-bold text-slate-800 font-mono">
                    {formatCurrency(res.pricing?.totalAmount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
