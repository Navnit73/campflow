"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { parseDateOnly, formatDateKey, addDays, diffDays, isDateOverlap } from "@/lib/utils/date";

export type DragMode = "move" | "resize-start" | "resize-end";

export interface DragTargetState {
  reservationId: string;
  reservation: any;
  dragType: DragMode;

  initialSiteId: string;
  initialStartDate: string; // YYYY-MM-DD
  initialEndDate: string; // YYYY-MM-DD
  initialNights: number;

  currentSiteId: string;
  currentStartDate: string;
  currentEndDate: string;
  currentNights: number;

  // Validation results
  isValid: boolean;
  conflictReason: string | null;
  conflictingReservation: any | null;
  isMaintenance: boolean;
  isInactive: boolean;
  rigWarning: string | null;
  rateDiff: number; // target site rate - source site rate per night

  // Cursor & visual tracking
  cursorX: number;
  cursorY: number;
  startX: number;
  startY: number;
  hasMovedPastThreshold: boolean;
}

export interface DropResult {
  reservation: any;
  targetSiteId: string;
  targetSite: any;
  checkInDate: string;
  checkOutDate: string;
  previousSiteId: string;
  previousSite: any;
  previousCheckInDate: string;
  previousCheckOutDate: string;
  nights: number;
  rateDiff: number;
  rigWarning: string | null;
}

interface UseTapeChartDragProps {
  sites: any[];
  reservations: any[];
  dateColumns: { dateKey: string }[];
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  onCommitMove: (result: DropResult) => void;
  onBlockMove?: (reason: string) => void;
}

export function useTapeChartDrag({
  sites,
  reservations,
  dateColumns,
  gridContainerRef,
  onCommitMove,
  onBlockMove,
}: UseTapeChartDragProps) {
  const [dragState, setDragState] = useState<DragTargetState | null>(null);
  const dragStateRef = useRef<DragTargetState | null>(null);
  dragStateRef.current = dragState;

  const activePointerIdRef = useRef<number | null>(null);
  const scrollIntervalRef = useRef<any>(null);

  // Stop edge scrolling loop
  const stopAutoScroll = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  // Check collision for target site and dates
  const checkTargetCollision = useCallback(
    (
      resId: string,
      targetSiteId: string,
      targetStartDate: string,
      targetEndDate: string,
      guestRvLength = 0
    ) => {
      const site = sites.find((s) => s._id === targetSiteId);
      if (!site) {
        return {
          isValid: false,
          conflictReason: "Target site was not found",
          conflictingReservation: null,
          isMaintenance: false,
          isInactive: false,
          rigWarning: null,
          rateDiff: 0,
        };
      }

      if (site.status === "maintenance") {
        return {
          isValid: false,
          conflictReason: `Site ${site.siteNumber} is currently under maintenance`,
          conflictingReservation: null,
          isMaintenance: true,
          isInactive: false,
          rigWarning: null,
          rateDiff: 0,
        };
      }

      if (site.status === "inactive") {
        return {
          isValid: false,
          conflictReason: `Site ${site.siteNumber} is inactive`,
          conflictingReservation: null,
          isMaintenance: false,
          isInactive: true,
          rigWarning: null,
          rateDiff: 0,
        };
      }

      // Check date overlaps with other reservations on target site
      const otherReservations = reservations.filter(
        (r) =>
          (r.siteId === targetSiteId || r.siteId?._id === targetSiteId) &&
          r._id !== resId &&
          r.status !== "cancelled"
      );

      const conflict = otherReservations.find((r) =>
        isDateOverlap(targetStartDate, targetEndDate, r.checkInDate, r.checkOutDate)
      );

      if (conflict) {
        const guestName = conflict.guestSnapshot?.fullName || "Guest";
        return {
          isValid: false,
          conflictReason: `Occupied by ${guestName} (${conflict.confirmationCode})`,
          conflictingReservation: conflict,
          isMaintenance: false,
          isInactive: false,
          rigWarning: null,
          rateDiff: 0,
        };
      }

      // Check RV clearance
      let rigWarning: string | null = null;
      const maxRig = site.siteTypeSnapshot?.maxRigLength ?? 45;
      if (guestRvLength > 0 && guestRvLength > maxRig) {
        rigWarning = `Guest RV (${guestRvLength}ft) exceeds Site ${site.siteNumber} max clearance (${maxRig}ft)`;
      }

      return {
        isValid: true,
        conflictReason: null,
        conflictingReservation: null,
        isMaintenance: false,
        isInactive: false,
        rigWarning,
        rateDiff: 0,
      };
    },
    [sites, reservations]
  );

  // Global listeners during active drag
  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (e: PointerEvent) => {
      const current = dragStateRef.current;
      if (!current) return;

      const deltaX = Math.abs(e.clientX - current.startX);
      const deltaY = Math.abs(e.clientY - current.startY);
      const hasMovedPastThreshold = current.hasMovedPastThreshold || deltaX > 4 || deltaY > 4;

      const container = gridContainerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();

      // Handle Edge Auto-Scrolling
      const edgeThreshold = 60;
      const scrollSpeed = 12;
      if (e.clientX < containerRect.left + edgeThreshold) {
        container.scrollLeft -= scrollSpeed;
      } else if (e.clientX > containerRect.right - edgeThreshold) {
        container.scrollLeft += scrollSpeed;
      }

      // Calculate Target Column from X coordinate
      // Find the date slot under cursor
      const dateHeaderElements = container.querySelectorAll<HTMLElement>("[data-date-key]");
      let targetDateKey = current.initialStartDate;
      let minXDiff = Infinity;

      dateHeaderElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right) {
          const key = el.getAttribute("data-date-key");
          if (key) targetDateKey = key;
        } else {
          const center = rect.left + rect.width / 2;
          const diff = Math.abs(e.clientX - center);
          if (diff < minXDiff) {
            minXDiff = diff;
            const key = el.getAttribute("data-date-key");
            if (key) targetDateKey = key;
          }
        }
      });

      // Calculate Target Site from Y coordinate
      const siteRowElements = container.querySelectorAll<HTMLElement>("[data-site-id]");
      let targetSiteId = current.currentSiteId;
      let minYDiff = Infinity;

      siteRowElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const sId = el.getAttribute("data-site-id");
          if (sId) targetSiteId = sId;
        } else {
          const center = rect.top + rect.height / 2;
          const diff = Math.abs(e.clientY - center);
          if (diff < minYDiff) {
            minYDiff = diff;
            const sId = el.getAttribute("data-site-id");
            if (sId) targetSiteId = sId;
          }
        }
      });

      // Compute new start and end dates based on dragType
      let newStartDate = current.initialStartDate;
      let newEndDate = current.initialEndDate;
      let newNights = current.initialNights;

      if (current.dragType === "move") {
        // Calculate day shift from initial start date to target date under cursor
        const dateStartIndex = dateColumns.findIndex((c) => c.dateKey === current.initialStartDate);
        const dateCursorIndex = dateColumns.findIndex((c) => c.dateKey === targetDateKey);

        if (dateStartIndex !== -1 && dateCursorIndex !== -1) {
          const dayOffset = dateCursorIndex - dateStartIndex;
          const shiftedStart = addDays(current.initialStartDate, dayOffset);
          const shiftedEnd = addDays(shiftedStart, current.initialNights);
          newStartDate = formatDateKey(shiftedStart);
          newEndDate = formatDateKey(shiftedEnd);
        } else {
          // Fallback based on target date key
          newStartDate = targetDateKey;
          newEndDate = formatDateKey(addDays(targetDateKey, current.initialNights));
        }
      } else if (current.dragType === "resize-start") {
        // Left handle resizing: only change start date, keep end date fixed
        targetSiteId = current.initialSiteId; // Stay on same site during resize
        if (targetDateKey < current.initialEndDate) {
          newStartDate = targetDateKey;
          newEndDate = current.initialEndDate;
          newNights = Math.max(1, diffDays(newStartDate, newEndDate));
        } else {
          // Cannot resize start date past end date
          newStartDate = formatDateKey(addDays(current.initialEndDate, -1));
          newEndDate = current.initialEndDate;
          newNights = 1;
        }
      } else if (current.dragType === "resize-end") {
        // Right handle resizing: only change end date, keep start date fixed
        targetSiteId = current.initialSiteId; // Stay on same site during resize
        if (targetDateKey > current.initialStartDate) {
          newStartDate = current.initialStartDate;
          newEndDate = targetDateKey;
          newNights = Math.max(1, diffDays(newStartDate, newEndDate));
        } else {
          // Cannot resize end date before start date + 1
          newStartDate = current.initialStartDate;
          newEndDate = formatDateKey(addDays(current.initialStartDate, 1));
          newNights = 1;
        }
      }

      // Check collision and rig limits
      const guestRvLength = current.reservation.guestSnapshot?.rvLengthFt || 0;
      const validation = checkTargetCollision(
        current.reservationId,
        targetSiteId,
        newStartDate,
        newEndDate,
        guestRvLength
      );

      // Compute rate difference
      const origSite = sites.find((s) => s._id === current.initialSiteId);
      const newSite = sites.find((s) => s._id === targetSiteId);
      const rateDiff = (newSite?.currentBaseRate || 0) - (origSite?.currentBaseRate || 0);

      setDragState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentSiteId: targetSiteId,
          currentStartDate: newStartDate,
          currentEndDate: newEndDate,
          currentNights: newNights,
          cursorX: e.clientX,
          cursorY: e.clientY,
          hasMovedPastThreshold,
          isValid: validation.isValid,
          conflictReason: validation.conflictReason,
          conflictingReservation: validation.conflictingReservation,
          isMaintenance: validation.isMaintenance,
          isInactive: validation.isInactive,
          rigWarning: validation.rigWarning,
          rateDiff,
        };
      });
    };

    const handlePointerUp = (e: PointerEvent) => {
      stopAutoScroll();
      const current = dragStateRef.current;
      if (!current) return;

      const hasChanged =
        current.currentSiteId !== current.initialSiteId ||
        current.currentStartDate !== current.initialStartDate ||
        current.currentEndDate !== current.initialEndDate;

      if (current.hasMovedPastThreshold && hasChanged) {
        if (current.isValid) {
          const targetSite = sites.find((s) => s._id === current.currentSiteId);
          const previousSite = sites.find((s) => s._id === current.initialSiteId);

          onCommitMove({
            reservation: current.reservation,
            targetSiteId: current.currentSiteId,
            targetSite,
            checkInDate: current.currentStartDate,
            checkOutDate: current.currentEndDate,
            previousSiteId: current.initialSiteId,
            previousSite,
            previousCheckInDate: current.initialStartDate,
            previousCheckOutDate: current.initialEndDate,
            nights: current.currentNights,
            rateDiff: current.rateDiff,
            rigWarning: current.rigWarning,
          });
        } else {
          if (onBlockMove) {
            onBlockMove(current.conflictReason || "Cannot move reservation to this slot");
          }
        }
      }

      setDragState(null);
      activePointerIdRef.current = null;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopAutoScroll();
        setDragState(null);
        activePointerIdRef.current = null;
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown);
      stopAutoScroll();
    };
  }, [dragState, sites, reservations, dateColumns, checkTargetCollision, onCommitMove, onBlockMove]);

  // Initiate drag from pointerdown
  const startDrag = useCallback(
    (e: React.PointerEvent, reservation: any, dragType: DragMode = "move") => {
      // Ignore right click or secondary buttons
      if (e.button !== 0) return;

      e.stopPropagation();

      const rSiteId = reservation.siteId?._id || reservation.siteId;
      const rStartDate = formatDateKey(reservation.checkInDate);
      const rEndDate = formatDateKey(reservation.checkOutDate);
      const rNights = reservation.numNights || Math.max(1, diffDays(rStartDate, rEndDate));

      const origSite = sites.find((s) => s._id === rSiteId);

      const initialValidation = checkTargetCollision(
        reservation._id,
        rSiteId,
        rStartDate,
        rEndDate,
        reservation.guestSnapshot?.rvLengthFt || 0
      );

      activePointerIdRef.current = e.pointerId;

      setDragState({
        reservationId: reservation._id,
        reservation,
        dragType,
        initialSiteId: rSiteId,
        initialStartDate: rStartDate,
        initialEndDate: rEndDate,
        initialNights: rNights,
        currentSiteId: rSiteId,
        currentStartDate: rStartDate,
        currentEndDate: rEndDate,
        currentNights: rNights,
        isValid: initialValidation.isValid,
        conflictReason: initialValidation.conflictReason,
        conflictingReservation: initialValidation.conflictingReservation,
        isMaintenance: initialValidation.isMaintenance,
        isInactive: initialValidation.isInactive,
        rigWarning: initialValidation.rigWarning,
        rateDiff: 0,
        cursorX: e.clientX,
        cursorY: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        hasMovedPastThreshold: false,
      });
    },
    [sites, checkTargetCollision]
  );

  const cancelDrag = useCallback(() => {
    stopAutoScroll();
    setDragState(null);
    activePointerIdRef.current = null;
  }, []);

  return {
    dragState,
    isDragging: !!dragState && dragState.hasMovedPastThreshold,
    startDrag,
    cancelDrag,
  };
}
