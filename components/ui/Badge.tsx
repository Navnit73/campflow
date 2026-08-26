import React from "react";
import { ReservationStatus } from "@/lib/constants";

export function ReservationBadge({ status }: { status: ReservationStatus | string }) {
  switch (status) {
    case "confirmed":
      return <span className="badge badge-success badge-sm font-medium gap-1 text-white">Confirmed</span>;
    case "checked_in":
      return <span className="badge badge-info badge-sm font-medium gap-1 text-white">Checked In</span>;
    case "checked_out":
      return <span className="badge badge-neutral badge-sm font-medium gap-1 text-gray-300">Checked Out</span>;
    case "pending":
      return <span className="badge badge-warning badge-sm font-medium gap-1 text-black">Pending</span>;
    case "cancelled":
      return <span className="badge badge-error badge-sm font-medium gap-1 text-white">Cancelled</span>;
    case "no_show":
      return <span className="badge badge-ghost badge-sm font-medium gap-1 text-gray-500">No Show</span>;
    default:
      return <span className="badge badge-ghost badge-sm">{status}</span>;
  }
}

export function SiteStatusBadge({ status }: { status: "available" | "maintenance" | "inactive" | string }) {
  switch (status) {
    case "available":
      return <span className="badge badge-outline badge-success badge-sm font-medium">Available</span>;
    case "maintenance":
      return <span className="badge badge-outline badge-warning badge-sm font-medium">Maintenance</span>;
    case "inactive":
      return <span className="badge badge-outline badge-error badge-sm font-medium">Inactive</span>;
    default:
      return <span className="badge badge-outline badge-sm">{status}</span>;
  }
}

export function PaymentStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <span className="badge badge-success badge-xs font-semibold text-white">Paid</span>;
    case "pending":
      return <span className="badge badge-warning badge-xs font-semibold">Pending</span>;
    case "refunded":
      return <span className="badge badge-neutral badge-xs font-semibold">Refunded</span>;
    default:
      return <span className="badge badge-ghost badge-xs">{status}</span>;
  }
}
