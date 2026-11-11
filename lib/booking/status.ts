import { ReservationStatus } from "@/lib/constants";

/** Statuses that occupy a site (block other bookings for overlapping nights). */
export const BLOCKING_STATUSES: ReservationStatus[] = ["pending", "confirmed", "checked_in"];

/**
 * Allowed reservation status transitions (from → to).
 * Re-entering a blocking status from a non-blocking one requires an availability re-check.
 */
export const STATUS_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ["confirmed", "checked_in", "cancelled", "no_show"],
  confirmed: ["pending", "checked_in", "cancelled", "no_show"],
  checked_in: ["confirmed", "checked_out"], // checked_in → confirmed = undo an accidental check-in
  checked_out: ["checked_in"], // undo an accidental check-out (availability re-checked)
  cancelled: ["pending", "confirmed"], // reactivation (availability re-checked)
  no_show: ["confirmed", "cancelled"],
};

export function canTransition(from: ReservationStatus, to: ReservationStatus): boolean {
  return from === to || STATUS_TRANSITIONS[from]?.includes(to) === true;
}

export function isBlocking(status: ReservationStatus): boolean {
  return BLOCKING_STATUSES.includes(status);
}
