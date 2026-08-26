import React from "react";

interface BadgeProps {
  status: string;
  className?: string;
}

export function ReservationBadge({ status, className = "" }: BadgeProps) {
  switch (status) {
    case "confirmed":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
          Confirmed
        </span>
      );
    case "checked_in":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-sky-600"></span>
          Checked In
        </span>
      );
    case "checked_out":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
          Checked Out
        </span>
      );
    case "pending":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
          Pending
        </span>
      );
    case "cancelled":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
          Cancelled
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 capitalize ${className}`}
        >
          {status}
        </span>
      );
  }
}

export function SiteStatusBadge({ status, className = "" }: BadgeProps) {
  switch (status) {
    case "available":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
          Available
        </span>
      );
    case "maintenance":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
          Maintenance
        </span>
      );
    case "inactive":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          Inactive
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 capitalize ${className}`}
        >
          {status}
        </span>
      );
  }
}

export function PaymentStatusBadge({ status, className = "" }: BadgeProps) {
  switch (status) {
    case "completed":
      return (
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 ${className}`}
        >
          Paid
        </span>
      );
    case "pending":
      return (
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 ${className}`}
        >
          Pending
        </span>
      );
    case "failed":
    case "refunded":
      return (
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200 capitalize ${className}`}
        >
          {status}
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 capitalize ${className}`}
        >
          {status}
        </span>
      );
  }
}
