"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import apiClient from "@/lib/axios/client";
import { useToast } from "@/components/ui/Toast";
import { HookupIcons } from "@/components/ui/HookupIcons";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { parseDateOnly, formatDateKey, addDays, diffDays } from "@/lib/utils/date";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
  Wrench,
  Ban,
  Percent,
  GripVertical,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Zap,
  ZoomIn,
  ZoomOut,
  Maximize2,
  SlidersHorizontal,
} from "lucide-react";
import { useTapeChartDrag, DropResult } from "@/hooks/useTapeChartDrag";
import { MoveConfirmationModal } from "@/components/calendar/MoveConfirmationModal";
import { HoldingShelf } from "@/components/calendar/HoldingShelf";

interface TapeChartProps {
  onSelectReservation: (reservationId: string) => void;
  onBookSiteDate: (siteId: string, siteNumber: string, date: string) => void;
}

const DEFAULT_COL_WIDTH = 64; // px
const MIN_COL_WIDTH = 38; // px
const MAX_COL_WIDTH = 220; // px

const DEFAULT_SITE_WIDTH = 200; // px
const MIN_SITE_WIDTH = 130; // px
const MAX_SITE_WIDTH = 360; // px

export function TapeChart({ onSelectReservation, onBookSiteDate }: TapeChartProps) {
  const { success, error, info, warning } = useToast();
  const todayKey = formatDateKey(new Date());

  const [startDateStr, setStartDateStr] = useState<string>(todayKey);
  const [daysCount, setDaysCount] = useState<number>(14);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchSite, setSearchSite] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [siteCategories, setSiteCategories] = useState<any[]>([]);

  // Excel-like Column Width State
  const [columnWidth, setColumnWidth] = useState<number>(DEFAULT_COL_WIDTH);
  const [siteColumnWidth, setSiteColumnWidth] = useState<number>(DEFAULT_SITE_WIDTH);
  const [isResizingCol, setIsResizingCol] = useState<boolean>(false);
  const [isResizingSiteCol, setIsResizingSiteCol] = useState<boolean>(false);
  const [showWidthMenu, setShowWidthMenu] = useState<boolean>(false);

  // Drag Settings
  const [instantMove, setInstantMove] = useState<boolean>(true);
  const [confirmModalData, setConfirmModalData] = useState<DropResult | null>(null);
  const [confirmModalLoading, setConfirmModalLoading] = useState<boolean>(false);

  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  // Load column width preferences from localStorage
  useEffect(() => {
    try {
      const savedColWidth = localStorage.getItem("campflow_tape_chart_col_width");
      if (savedColWidth) {
        const val = parseInt(savedColWidth, 10);
        if (!isNaN(val) && val >= MIN_COL_WIDTH && val <= MAX_COL_WIDTH) {
          setColumnWidth(val);
        }
      }
      const savedSiteWidth = localStorage.getItem("campflow_tape_chart_site_width");
      if (savedSiteWidth) {
        const val = parseInt(savedSiteWidth, 10);
        if (!isNaN(val) && val >= MIN_SITE_WIDTH && val <= MAX_SITE_WIDTH) {
          setSiteColumnWidth(val);
        }
      }
    } catch {
      // LocalStorage not available or restricted
    }
  }, []);

  const saveColWidth = (width: number) => {
    const clamped = Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, width));
    setColumnWidth(clamped);
    try {
      localStorage.setItem("campflow_tape_chart_col_width", String(clamped));
    } catch {}
  };

  const saveSiteWidth = (width: number) => {
    const clamped = Math.max(MIN_SITE_WIDTH, Math.min(MAX_SITE_WIDTH, width));
    setSiteColumnWidth(clamped);
    try {
      localStorage.setItem("campflow_tape_chart_site_width", String(clamped));
    } catch {}
  };

  // Excel-like Column Width Resizing Handler (Dragging between column headers)
  const startColumnResize = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsResizingCol(true);

      const startX = e.clientX;
      const initialWidth = columnWidth;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const newWidth = Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, initialWidth + deltaX));
        setColumnWidth(newWidth);
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        setIsResizingCol(false);
        const deltaX = upEvent.clientX - startX;
        saveColWidth(initialWidth + deltaX);

        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [columnWidth]
  );

  // Excel-like Site Column Width Resizing Handler
  const startSiteColumnResize = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsResizingSiteCol(true);

      const startX = e.clientX;
      const initialWidth = siteColumnWidth;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const newWidth = Math.max(MIN_SITE_WIDTH, Math.min(MAX_SITE_WIDTH, initialWidth + deltaX));
        setSiteColumnWidth(newWidth);
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        setIsResizingSiteCol(false);
        const deltaX = upEvent.clientX - startX;
        saveSiteWidth(initialWidth + deltaX);

        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [siteColumnWidth]
  );

  const [chartData, setChartData] = useState<{
    sites: any[];
    reservations: any[];
  }>({ sites: [], reservations: [] });

  const loadData = async (dateStr: string, days: number) => {
    setLoading(true);
    try {
      const [res, typesRes] = await Promise.all([
        apiClient.get("/api/reservations/tape-chart", {
          params: { startDate: dateStr, days },
        }),
        apiClient.get("/api/sites/types"),
      ]);

      if (res.data?.success) {
        setChartData({
          sites: res.data.data.sites || [],
          reservations: res.data.data.reservations || [],
        });
      }
      if (typesRes.data?.success) {
        setSiteCategories(typesRes.data.data || []);
      }
    } catch (err: any) {
      error(err?.message || "Failed to load tape chart data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(startDateStr, daysCount);
  }, [startDateStr, daysCount]);

  // Generate normalized date array
  const windowStartDate = parseDateOnly(startDateStr);
  const windowEndDate = addDays(windowStartDate, daysCount);

  const dateColumns = useMemo(() => {
    return Array.from({ length: daysCount }).map((_, i) => {
      const d = addDays(windowStartDate, i);
      const dateKey = formatDateKey(d);
      const dayName = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
      const dayNum = d.getUTCDate();
      const isToday = dateKey === todayKey;
      const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;

      return { dateKey, dayName, dayNum, isToday, isWeekend, fullDate: d };
    });
  }, [startDateStr, daysCount, todayKey]);

  // Handle Drag Move Commit (API & Optimistic Update)
  const handleApplyMove = async (drop: DropResult) => {
    const {
      reservation,
      targetSiteId,
      targetSite,
      checkInDate,
      checkOutDate,
      previousSiteId,
      previousSite,
      previousCheckInDate,
      previousCheckOutDate,
    } = drop;

    // 1. Optimistic Update
    const previousReservations = [...chartData.reservations];
    const updatedReservations = chartData.reservations.map((r) => {
      if (r._id === reservation._id) {
        return {
          ...r,
          siteId: targetSiteId,
          checkInDate,
          checkOutDate,
          numNights: drop.nights,
          siteSnapshot: targetSite
            ? {
                siteNumber: targetSite.siteNumber,
                siteTypeName: targetSite.siteTypeSnapshot?.name || r.siteSnapshot?.siteTypeName,
                hookups: targetSite.siteTypeSnapshot?.hookups || r.siteSnapshot?.hookups,
                rigType: targetSite.rigType || r.siteSnapshot?.rigType,
                baseRate: targetSite.currentBaseRate || r.siteSnapshot?.baseRate,
              }
            : r.siteSnapshot,
        };
      }
      return r;
    });

    setChartData((prev) => ({ ...prev, reservations: updatedReservations }));

    // 2. Server Synchronization
    try {
      const res = await apiClient.patch(`/api/reservations/${reservation._id}`, {
        siteId: targetSiteId,
        checkInDate,
        checkOutDate,
      });

      if (res.data?.success) {
        const guestName = reservation.guestSnapshot?.fullName || "Guest";
        const newSiteNum = targetSite?.siteNumber || reservation.siteSnapshot?.siteNumber;
        const msg = `Moved ${guestName} to Site ${newSiteNum} (${formatDate(checkInDate)} → ${formatDate(checkOutDate)})`;

        // 3. Show Success with Undo action
        success(
          msg,
          {
            label: "Undo",
            onClick: async () => {
              // Rollback on server
              try {
                const undoRes = await apiClient.patch(`/api/reservations/${reservation._id}`, {
                  siteId: previousSiteId,
                  checkInDate: previousCheckInDate,
                  checkOutDate: previousCheckOutDate,
                });
                if (undoRes.data?.success) {
                  setChartData((prev) => ({ ...prev, reservations: previousReservations }));
                  info(`Restored ${guestName} back to Site ${previousSite?.siteNumber || ""}`);
                }
              } catch (undoErr: any) {
                error(undoErr?.message || "Failed to undo move");
                loadData(startDateStr, daysCount);
              }
            },
          },
          6000
        );
      }
    } catch (err: any) {
      // Revert optimistic update
      setChartData((prev) => ({ ...prev, reservations: previousReservations }));
      error(err?.message || "Failed to reassign reservation on server");
    }
  };

  // Called when drag completes
  const handleDropSuccess = (drop: DropResult) => {
    // If confirmation is required, or if there's a rate difference or RV length warning
    const requiresConfirmation =
      !instantMove || drop.rateDiff !== 0 || !!drop.rigWarning;

    if (requiresConfirmation) {
      setConfirmModalData(drop);
    } else {
      handleApplyMove(drop);
    }
  };

  const handleDropBlocked = (reason: string) => {
    warning(`Cannot move reservation: ${reason}`);
  };

  // Drag Hook
  const { dragState, isDragging, startDrag, cancelDrag } = useTapeChartDrag({
    sites: chartData.sites,
    reservations: chartData.reservations,
    dateColumns,
    gridContainerRef,
    onCommitMove: handleDropSuccess,
    onBlockMove: handleDropBlocked,
  });

  const handlePrev = () => {
    const prevDate = addDays(windowStartDate, -7);
    setStartDateStr(formatDateKey(prevDate));
  };

  const handleNext = () => {
    const nextDate = addDays(windowStartDate, 7);
    setStartDateStr(formatDateKey(nextDate));
  };

  const handleToday = () => {
    setStartDateStr(todayKey);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "checked_in":
        return "bg-sky-600 text-white border-sky-700 hover:bg-sky-700 shadow-xs";
      case "confirmed":
        return "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 shadow-xs";
      case "pending":
        return "bg-amber-500 text-slate-900 border-amber-600 hover:bg-amber-600 shadow-xs";
      case "checked_out":
        return "bg-slate-400 text-white border-slate-500 hover:bg-slate-500";
      default:
        return "bg-slate-500 text-white border-slate-600";
    }
  };

  // Filter sites by search and category
  const filteredSites = chartData.sites.filter((site) => {
    if (searchSite.trim()) {
      const q = searchSite.trim().toLowerCase();
      const numMatch = site.siteNumber?.toLowerCase().includes(q);
      const nameMatch = site.name?.toLowerCase().includes(q);
      const typeMatch = site.siteTypeSnapshot?.name?.toLowerCase().includes(q);
      if (!numMatch && !nameMatch && !typeMatch) return false;
    }
    if (categoryFilter !== "all") {
      const typeId = site.siteTypeId?._id || site.siteTypeId;
      if (typeId?.toString() !== categoryFilter) return false;
    }
    return true;
  });

  // Calculate occupancy percentage for visible window
  const totalSiteNights = Math.max(1, filteredSites.length * daysCount);
  let occupiedNights = 0;
  chartData.reservations.forEach((r) => {
    if (r.status === "cancelled") return;
    const rStart = parseDateOnly(r.checkInDate);
    const rEnd = parseDateOnly(r.checkOutDate);
    if (rEnd.getTime() <= windowStartDate.getTime() || rStart.getTime() >= windowEndDate.getTime()) return;
    const cStart = rStart.getTime() < windowStartDate.getTime() ? windowStartDate : rStart;
    const cEnd = rEnd.getTime() > windowEndDate.getTime() ? windowEndDate : rEnd;
    occupiedNights += Math.max(0, diffDays(cStart, cEnd));
  });
  const occupancyRate = Math.min(100, Math.round((occupiedNights / totalSiteNights) * 100));

  // Staged / Unassigned reservations
  const unassignedReservations = chartData.reservations.filter(
    (r) => !r.siteId || r.status === "pending"
  );

  return (
    <div className="space-y-3 w-full select-none">
      {/* Optional Staging Shelf */}
      {unassignedReservations.length > 0 && (
        <HoldingShelf
          unassignedReservations={unassignedReservations}
          onSelectReservation={onSelectReservation}
        />
      )}

      {/* Main Tape Chart Card */}
      <div className="surface-card flex flex-col overflow-hidden rounded-lg border border-slate-200 w-full shadow-xs">
        {/* Tape Chart Top Controls */}
        <div className="p-2.5 sm:p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50">
          {/* Navigation & Date Picker */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleToday}
              className="btn btn-outline btn-xs sm:btn-sm font-bold text-xs rounded-md bg-white hover:bg-slate-50 shadow-xs"
            >
              Today
            </button>
            <div className="join shadow-xs">
              <button
                onClick={handlePrev}
                className="btn btn-outline btn-xs sm:btn-sm join-item rounded-l-md bg-white hover:bg-slate-50"
                aria-label="Previous 7 days"
                title="Previous 7 days"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button
                onClick={handleNext}
                className="btn btn-outline btn-xs sm:btn-sm join-item rounded-r-md bg-white hover:bg-slate-50"
                aria-label="Next 7 days"
                title="Next 7 days"
              >
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                className="input input-bordered input-xs sm:input-sm font-medium bg-white rounded-md text-xs shadow-xs"
              />
            </div>
          </div>

          {/* Search, Filter & Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search site # or name..."
              value={searchSite}
              onChange={(e) => setSearchSite(e.target.value)}
              className="input input-bordered input-xs sm:input-sm bg-white rounded-md text-xs w-28 sm:w-36 shadow-xs"
            />

            {siteCategories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="select select-bordered select-xs sm:select-sm bg-white rounded-md text-xs font-medium shadow-xs"
              >
                <option value="all">All Categories</option>
                {siteCategories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}

            {/* Days Window Selector */}
            <div className="join shadow-xs">
              <button
                onClick={() => setDaysCount(7)}
                className={`btn btn-xs sm:btn-sm join-item font-bold text-xs ${
                  daysCount === 7
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "btn-outline bg-white hover:bg-slate-50"
                }`}
              >
                7D
              </button>
              <button
                onClick={() => setDaysCount(14)}
                className={`btn btn-xs sm:btn-sm join-item font-bold text-xs ${
                  daysCount === 14
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "btn-outline bg-white hover:bg-slate-50"
                }`}
              >
                14D
              </button>
              <button
                onClick={() => setDaysCount(30)}
                className={`btn btn-xs sm:btn-sm join-item font-bold text-xs ${
                  daysCount === 30
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "btn-outline bg-white hover:bg-slate-50"
                }`}
              >
                30D
              </button>
            </div>

            {/* Excel-style Column Width Controls (Zoom +/- & Presets) */}
            <div className="relative">
              <div className="join shadow-xs">
                <button
                  onClick={() => saveColWidth(columnWidth - 12)}
                  disabled={columnWidth <= MIN_COL_WIDTH}
                  className="btn btn-outline btn-xs sm:btn-sm join-item bg-white hover:bg-slate-50 text-slate-700"
                  title="Reduce column width (Excel Zoom Out)"
                  aria-label="Reduce column width"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowWidthMenu(!showWidthMenu)}
                  className="btn btn-outline btn-xs sm:btn-sm join-item bg-white hover:bg-slate-50 font-mono text-[11px] font-bold text-slate-700 px-2"
                  title="Click to select column width preset or adjust slider"
                >
                  {columnWidth}px
                </button>
                <button
                  onClick={() => saveColWidth(columnWidth + 12)}
                  disabled={columnWidth >= MAX_COL_WIDTH}
                  className="btn btn-outline btn-xs sm:btn-sm join-item bg-white hover:bg-slate-50 text-slate-700"
                  title="Increase column width (Excel Zoom In)"
                  aria-label="Increase column width"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Column Width Dropdown Popover */}
              {showWidthMenu && (
                <div className="absolute right-0 top-full mt-1.5 z-40 p-3 rounded-xl bg-white border border-slate-200 shadow-xl w-60 space-y-3 animate-scale-in text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-800 pb-1.5 border-b border-slate-100">
                    <span className="flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                      Column Widths (Excel)
                    </span>
                    <button
                      onClick={() => {
                        saveColWidth(DEFAULT_COL_WIDTH);
                        saveSiteWidth(DEFAULT_SITE_WIDTH);
                      }}
                      className="text-[10px] text-emerald-700 hover:underline font-bold"
                    >
                      Reset
                    </button>
                  </div>

                  {/* Day Column Width Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-slate-600 text-[11px]">
                      <span>Day Columns:</span>
                      <span className="font-mono font-bold text-slate-900">{columnWidth}px</span>
                    </div>
                    <input
                      type="range"
                      min={MIN_COL_WIDTH}
                      max={MAX_COL_WIDTH}
                      value={columnWidth}
                      onChange={(e) => saveColWidth(Number(e.target.value))}
                      className="range range-xs range-primary w-full"
                    />
                  </div>

                  {/* Presets */}
                  <div className="grid grid-cols-4 gap-1 pt-1">
                    {[
                      { label: "XS", val: 42 },
                      { label: "S", val: 56 },
                      { label: "M", val: 76 },
                      { label: "XL", val: 120 },
                    ].map((p) => (
                      <button
                        key={p.label}
                        onClick={() => saveColWidth(p.val)}
                        className={`py-1 text-[10px] font-bold rounded border transition-colors ${
                          Math.abs(columnWidth - p.val) <= 5
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {p.label} ({p.val}px)
                      </button>
                    ))}
                  </div>

                  {/* Site Column Width Slider */}
                  <div className="space-y-1 pt-2 border-t border-slate-100">
                    <div className="flex justify-between text-slate-600 text-[11px]">
                      <span>Site Column:</span>
                      <span className="font-mono font-bold text-slate-900">{siteColumnWidth}px</span>
                    </div>
                    <input
                      type="range"
                      min={MIN_SITE_WIDTH}
                      max={MAX_SITE_WIDTH}
                      value={siteColumnWidth}
                      onChange={(e) => saveSiteWidth(Number(e.target.value))}
                      className="range range-xs range-primary w-full"
                    />
                  </div>

                  <p className="text-[10px] text-slate-400 italic pt-1">
                    💡 Tip: You can also drag the vertical borders between headers just like Excel.
                  </p>
                </div>
              )}
            </div>

            {/* Instant Move Setting Toggle */}
            <button
              onClick={() => setInstantMove(!instantMove)}
              className={`btn btn-xs sm:btn-sm font-bold text-[11px] rounded-md gap-1 shadow-xs transition-colors ${
                instantMove
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                  : "btn-outline bg-white text-slate-700"
              }`}
              title={
                instantMove
                  ? "Instant Drag & Drop enabled (1-click Undo available)"
                  : "Confirmation required on every drop"
              }
            >
              <Zap className={`w-3.5 h-3.5 ${instantMove ? "text-emerald-600" : "text-slate-400"}`} />
              <span className="hidden md:inline">{instantMove ? "Instant Drag" : "Confirm Drag"}</span>
            </button>

            <button
              onClick={() => loadData(startDateStr, daysCount)}
              className="btn btn-ghost btn-xs sm:btn-sm btn-circle text-slate-600 hover:text-slate-900 rounded-md"
              title="Refresh Timeline"
              aria-label="Refresh Timeline"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? "animate-spin text-emerald-600" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Status Legend, Occupancy & Instructions */}
        <div className="px-3 sm:px-4 py-2 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between text-xs gap-2">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 text-[11px] sm:text-xs">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
              Legend:
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Confirmed
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-sky-600"></span> Checked In
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Pending
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span> Checked Out
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
              <Wrench className="w-3 h-3 text-amber-600" /> Maintenance
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-slate-500 text-[11px] font-medium">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[10px] border border-emerald-200">
              <Percent className="w-3 h-3 text-emerald-600" /> {occupancyRate}% Occupied
            </span>
            <span className="hidden lg:inline text-slate-400">
              💡 <strong>Drag column border</strong> to resize width • <strong>Drag bar</strong> to move • <strong>Esc</strong> to cancel
            </span>
          </div>
        </div>

        {/* Grid Container with Sticky Column & Horizontal Scroll */}
        <div
          ref={gridContainerRef}
          className={`overflow-x-auto relative custom-scrollbar touch-pan-x ${
            isResizingCol || isResizingSiteCol ? "cursor-col-resize select-none" : ""
          }`}
        >
          <div className="min-w-fit">
            {/* Header Row */}
            <div className="flex border-b border-slate-200 bg-slate-100 sticky top-0 z-20">
              {/* Sticky Site Column Header with Excel Resize Splitter */}
              <div
                style={{ width: `${siteColumnWidth}px`, minWidth: `${siteColumnWidth}px`, maxWidth: `${siteColumnWidth}px` }}
                className="shrink-0 p-2 sm:p-2.5 font-bold text-[11px] sm:text-xs uppercase tracking-wider text-slate-600 border-r border-slate-200 sticky left-0 bg-slate-100 z-30 flex items-center justify-between shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] relative group/sitehead"
              >
                <span>Sites ({filteredSites.length})</span>
                <span className="hidden sm:inline text-[10px] text-slate-400 font-normal">
                  Base Rate
                </span>

                {/* Excel Splitter for Site Column */}
                <div
                  onPointerDown={startSiteColumnResize}
                  onDoubleClick={() => saveSiteWidth(DEFAULT_SITE_WIDTH)}
                  className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-emerald-500/30 active:bg-emerald-500/60 z-40 flex items-center justify-center group-hover/sitehead:border-r-2 group-hover/sitehead:border-emerald-500 transition-colors"
                  title="Drag to resize Site Column width (Double-click to reset)"
                />
              </div>

              {/* Date Headers with Excel Column Resize Splitters */}
              <div
                className="flex-1 grid"
                style={{
                  gridTemplateColumns: `repeat(${daysCount}, minmax(${columnWidth}px, 1fr))`,
                  minWidth: `${daysCount * columnWidth}px`,
                }}
              >
                {dateColumns.map((col, idx) => (
                  <div
                    key={col.dateKey}
                    data-date-key={col.dateKey}
                    style={{ minWidth: `${columnWidth}px` }}
                    className={`py-1.5 sm:py-2 px-1 text-center border-r border-slate-200 transition-colors relative group/colhead ${
                      col.isToday
                        ? "bg-emerald-50 font-black text-emerald-800"
                        : col.isWeekend
                        ? "bg-slate-50 text-slate-700"
                        : "text-slate-700"
                    }`}
                  >
                    <div className="text-[9px] sm:text-[10px] uppercase font-bold tracking-tight">
                      {col.dayName}
                    </div>
                    <div
                      className={`text-[11px] sm:text-xs ${
                        col.isToday ? "font-black text-emerald-700" : "font-semibold"
                      }`}
                    >
                      {col.dayNum}
                    </div>

                    {/* Excel Splitter for Date Columns */}
                    <div
                      onPointerDown={startColumnResize}
                      onDoubleClick={() => saveColWidth(DEFAULT_COL_WIDTH)}
                      className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-emerald-500/40 active:bg-emerald-500/70 z-30 group-hover/colhead:border-r-2 group-hover/colhead:border-emerald-500 transition-colors"
                      title="Drag to resize all calendar columns like Excel (Double-click to reset)"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Body Rows */}
            {loading && filteredSites.length === 0 ? (
              <div className="p-10 sm:p-14 text-center text-slate-500 space-y-2">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-1" />
                <p className="text-xs font-semibold">Loading tape chart calendar...</p>
              </div>
            ) : filteredSites.length === 0 ? (
              <div className="p-10 sm:p-14 text-center text-slate-500 space-y-3">
                <p className="text-xs font-medium">
                  No sites match the current search or category filter.
                </p>
              </div>
            ) : (
              filteredSites.map((site) => {
                const isMaintenance = site.status === "maintenance";
                const isInactive = site.status === "inactive";

                const siteReservations = chartData.reservations.filter(
                  (r) =>
                    (r.siteId === site._id || r.siteId?._id === site._id) &&
                    r.status !== "cancelled"
                );

                // Is the currently dragged ghost bar targeting this site row?
                const isDragTargetSite = isDragging && dragState?.currentSiteId === site._id;

                return (
                  <div
                    key={site._id}
                    data-site-id={site._id}
                    className={`flex border-b border-slate-100 transition-colors group relative ${
                      isMaintenance
                        ? "bg-amber-50/20"
                        : isInactive
                        ? "bg-slate-50 opacity-60"
                        : isDragTargetSite
                        ? "bg-emerald-50/20"
                        : "hover:bg-slate-50/60"
                    }`}
                  >
                    {/* Sticky Site Info Cell */}
                    <div
                      style={{ width: `${siteColumnWidth}px`, minWidth: `${siteColumnWidth}px`, maxWidth: `${siteColumnWidth}px` }}
                      className="shrink-0 p-2 sm:p-2.5 border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] min-w-0"
                    >
                      <div className="flex items-center justify-between gap-1 min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 font-mono truncate">
                            Site {site.siteNumber}
                          </span>
                          {isMaintenance && (
                            <span
                              title="Maintenance"
                              className="badge badge-warning badge-xs text-[9px] font-bold p-0.5"
                            >
                              <Wrench className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] sm:text-xs font-black text-emerald-700 font-mono shrink-0">
                          {formatCurrency(site.currentBaseRate)}
                        </span>
                      </div>

                      <div
                        className="text-[10px] text-slate-500 truncate mt-0.5"
                        title={site.siteTypeSnapshot?.name}
                      >
                        {site.siteTypeSnapshot?.name}
                      </div>

                      <div className="mt-1 min-w-0">
                        <HookupIcons
                          hookups={site.siteTypeSnapshot?.hookups}
                          rigType={site.rigType}
                          maxRigLength={site.siteTypeSnapshot?.maxRigLength}
                          compact
                        />
                      </div>
                    </div>

                    {/* Date Grid Cell Layer */}
                    <div
                      className="flex-1 grid relative min-h-[52px] sm:min-h-[58px]"
                      style={{
                        gridTemplateColumns: `repeat(${daysCount}, minmax(${columnWidth}px, 1fr))`,
                        minWidth: `${daysCount * columnWidth}px`,
                      }}
                    >
                      {/* Background Clickable Date Slots */}
                      {dateColumns.map((col) => {
                        if (isMaintenance) {
                          return (
                            <div
                              key={col.dateKey}
                              onClick={() =>
                                info(`Site ${site.siteNumber} is currently under maintenance.`)
                              }
                              className="border-r border-amber-100 bg-amber-50/30 cursor-not-allowed flex items-center justify-center"
                              title={`Site ${site.siteNumber} is under maintenance on ${col.dateKey}`}
                            >
                              <Wrench className="w-2.5 h-2.5 text-amber-400 opacity-40" />
                            </div>
                          );
                        }

                        if (isInactive) {
                          return (
                            <div
                              key={col.dateKey}
                              className="border-r border-slate-100 bg-slate-100/40 cursor-not-allowed flex items-center justify-center"
                              title={`Site ${site.siteNumber} is inactive`}
                            >
                              <Ban className="w-2.5 h-2.5 text-slate-300" />
                            </div>
                          );
                        }

                        return (
                          <div
                            key={col.dateKey}
                            onClick={() => onBookSiteDate(site._id, site.siteNumber, col.dateKey)}
                            className={`border-r border-slate-100 hover:bg-emerald-500/10 cursor-pointer transition-colors relative flex items-center justify-center group/slot ${
                              col.isToday
                                ? "bg-emerald-500/5"
                                : col.isWeekend
                                ? "bg-slate-50/40"
                                : ""
                            }`}
                            title={`Available • Click to book Site ${site.siteNumber} on ${col.dateKey}`}
                          >
                            <Plus className="w-3.5 h-3.5 text-emerald-700 opacity-0 group-hover/slot:opacity-100 transition-opacity" />
                          </div>
                        );
                      })}

                      {/* Overlay Existing Reservation Bars */}
                      {!isMaintenance &&
                        !isInactive &&
                        siteReservations.map((res) => {
                          const resStart = parseDateOnly(res.checkInDate);
                          const resEnd = parseDateOnly(res.checkOutDate);

                          // If reservation finishes before window starts or starts after window ends -> skip
                          if (
                            resEnd.getTime() <= windowStartDate.getTime() ||
                            resStart.getTime() >= windowEndDate.getTime()
                          ) {
                            return null;
                          }

                          // Compute clamped boundaries in visible window
                          const effectiveStart =
                            resStart.getTime() < windowStartDate.getTime()
                              ? windowStartDate
                              : resStart;
                          const effectiveEnd =
                            resEnd.getTime() > windowEndDate.getTime()
                              ? windowEndDate
                              : resEnd;

                          const startOffset = Math.max(0, diffDays(windowStartDate, effectiveStart));
                          const span = Math.max(1, diffDays(effectiveStart, effectiveEnd));

                          const leftPercent = (startOffset / daysCount) * 100;
                          const widthPercent = (span / daysCount) * 100;

                          const isContinuingLeft = resStart.getTime() < windowStartDate.getTime();
                          const isContinuingRight = resEnd.getTime() > windowEndDate.getTime();

                          // Is this particular reservation being actively dragged?
                          const isCurrentlyDragged =
                            isDragging && dragState?.reservationId === res._id;

                          return (
                            <div
                              key={res._id}
                              onPointerDown={(e) => startDrag(e, res, "move")}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isDragging) {
                                  onSelectReservation(res._id);
                                }
                              }}
                              className={`absolute top-1.5 bottom-1.5 border flex items-center cursor-grab active:cursor-grabbing z-10 select-none group/bar transition-all overflow-hidden ${
                                isCurrentlyDragged ? "opacity-35 ring-2 ring-slate-400" : ""
                              } ${
                                isContinuingLeft ? "rounded-l-none border-l-0" : "rounded-l-md"
                              } ${
                                isContinuingRight ? "rounded-r-none border-r-0" : "rounded-r-md"
                              } ${getStatusColor(res.status)}`}
                              style={{
                                left: `${leftPercent}%`,
                                width: `${widthPercent}%`,
                              }}
                              title={`${res.guestSnapshot?.fullName || "Guest"} (${
                                res.confirmationCode
                              }) • ${formatDateKey(resStart)} → ${formatDateKey(resEnd)} (${
                                res.numNights || span
                              } nts) • Drag to move, drag edges to resize`}
                            >
                              {/* Left Resize Handle */}
                              {!isContinuingLeft && (
                                <div
                                  onPointerDown={(e) => {
                                    e.stopPropagation();
                                    startDrag(e, res, "resize-start");
                                  }}
                                  className="absolute left-0 top-0 bottom-0 w-2.5 sm:w-3 cursor-ew-resize hover:bg-white/40 active:bg-white/60 flex items-center justify-center transition-colors z-20 group/handle"
                                  title="Drag to change check-in date"
                                >
                                  <span className="w-1 h-3 bg-white/70 rounded-full group-hover/handle:bg-white transition-colors" />
                                </div>
                              )}

                              {/* Card Content & Guest Label */}
                              <div className="flex-1 px-3 sm:px-3.5 truncate text-[10px] sm:text-xs font-bold leading-tight flex items-center gap-1">
                                {isContinuingLeft && (
                                  <span className="text-[9px] opacity-70">◀</span>
                                )}
                                <GripVertical className="w-3 h-3 opacity-60 shrink-0 hidden sm:inline" />
                                <span className="truncate">
                                  {res.guestSnapshot?.fullName || "Guest"}
                                </span>
                                {res.guestSnapshot?.rvLengthFt ? (
                                  <span className="opacity-80 text-[9px] font-mono hidden sm:inline shrink-0">
                                    ({res.guestSnapshot.rvLengthFt}ft)
                                  </span>
                                ) : null}
                                {isContinuingRight && (
                                  <span className="text-[9px] opacity-70 ml-auto">▶</span>
                                )}
                              </div>

                              {/* Right Resize Handle */}
                              {!isContinuingRight && (
                                <div
                                  onPointerDown={(e) => {
                                    e.stopPropagation();
                                    startDrag(e, res, "resize-end");
                                  }}
                                  className="absolute right-0 top-0 bottom-0 w-2.5 sm:w-3 cursor-ew-resize hover:bg-white/40 active:bg-white/60 flex items-center justify-center transition-colors z-20 group/handle"
                                  title="Drag to change check-out date"
                                >
                                  <span className="w-1 h-3 bg-white/70 rounded-full group-hover/handle:bg-white transition-colors" />
                                </div>
                              )}
                            </div>
                          );
                        })}

                      {/* Live Snapped Ghost Preview Bar */}
                      {isDragTargetSite && dragState && (
                        (() => {
                          const gStart = parseDateOnly(dragState.currentStartDate);
                          const gEnd = parseDateOnly(dragState.currentEndDate);

                          // Clamp to window
                          const effectiveGStart =
                            gStart.getTime() < windowStartDate.getTime()
                              ? windowStartDate
                              : gStart;
                          const effectiveGEnd =
                            gEnd.getTime() > windowEndDate.getTime()
                              ? windowEndDate
                              : gEnd;

                          const startOffset = Math.max(
                            0,
                            diffDays(windowStartDate, effectiveGStart)
                          );
                          const span = Math.max(1, diffDays(effectiveGStart, effectiveGEnd));

                          const leftPercent = (startOffset / daysCount) * 100;
                          const widthPercent = (span / daysCount) * 100;

                          const isValid = dragState.isValid;
                          const hasRigWarning = !!dragState.rigWarning;

                          return (
                            <div
                              className={`absolute top-1 bottom-1 flex items-center justify-between px-2 sm:px-3 z-30 pointer-events-none rounded-md transition-all shadow-md ${
                                !isValid
                                  ? "bg-rose-500/25 ring-2 ring-rose-500 border border-rose-600 text-rose-950"
                                  : hasRigWarning
                                  ? "bg-amber-500/25 ring-2 ring-amber-500 border border-amber-600 text-amber-950"
                                  : "bg-emerald-500/25 ring-2 ring-emerald-500 border border-emerald-600 text-emerald-950 animate-pulse"
                              }`}
                              style={{
                                left: `${leftPercent}%`,
                                width: `${widthPercent}%`,
                              }}
                            >
                              <div className="flex items-center gap-1.5 truncate text-xs font-black">
                                {!isValid ? (
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                                ) : hasRigWarning ? (
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                )}
                                <span className="truncate">
                                  {dragState.reservation.guestSnapshot?.fullName || "Guest"}
                                </span>
                              </div>

                              <div className="font-mono text-[10px] font-bold shrink-0">
                                {dragState.currentNights} nt
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Floating Real-Time HUD Tooltip Following Pointer */}
      {isDragging && dragState && (
        <div
          className={`fixed pointer-events-none z-50 p-2.5 rounded-xl shadow-2xl border text-xs backdrop-blur-md transition-transform flex flex-col gap-1 max-w-xs ${
            !dragState.isValid
              ? "bg-rose-900/90 text-white border-rose-600 shadow-rose-950/40"
              : dragState.rigWarning
              ? "bg-amber-900/90 text-white border-amber-600 shadow-amber-950/40"
              : "bg-slate-900/90 text-white border-slate-700 shadow-slate-950/40"
          }`}
          style={{
            left: `${dragState.cursorX + 16}px`,
            top: `${dragState.cursorY + 16}px`,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-white/20 pb-1">
            <span className="font-bold truncate">
              {dragState.reservation.guestSnapshot?.fullName || "Guest"}
            </span>
            <span className="font-mono text-[10px] opacity-75">
              {dragState.dragType === "move"
                ? "Move"
                : dragState.dragType === "resize-start"
                ? "Resize Arrival"
                : "Resize Departure"}
            </span>
          </div>

          {/* Target Details */}
          <div className="flex items-center justify-between text-[11px] gap-2 pt-0.5">
            <span className="opacity-80">Target Site:</span>
            <span className="font-mono font-bold">
              Site{" "}
              {chartData.sites.find((s) => s._id === dragState.currentSiteId)?.siteNumber || "—"}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] gap-2">
            <span className="opacity-80">Dates:</span>
            <span className="font-medium">
              {formatDate(dragState.currentStartDate)} → {formatDate(dragState.currentEndDate)} (
              {dragState.currentNights} nt)
            </span>
          </div>

          {/* Rate Difference Preview */}
          {dragState.rateDiff !== 0 && (
            <div className="flex items-center justify-between text-[11px] gap-2">
              <span className="opacity-80">Rate Diff:</span>
              <span
                className={`font-mono font-bold ${
                  dragState.rateDiff > 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {dragState.rateDiff > 0
                  ? `+${formatCurrency(dragState.rateDiff)}/nt`
                  : `-${formatCurrency(Math.abs(dragState.rateDiff))}/nt`}
              </span>
            </div>
          )}

          {/* Conflict / Clearance Alert */}
          {!dragState.isValid ? (
            <div className="mt-1 pt-1 border-t border-rose-500/40 text-[10px] font-bold text-rose-200 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{dragState.conflictReason || "Invalid drop slot"}</span>
            </div>
          ) : dragState.rigWarning ? (
            <div className="mt-1 pt-1 border-t border-amber-500/40 text-[10px] font-bold text-amber-200 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>{dragState.rigWarning}</span>
            </div>
          ) : (
            <div className="mt-1 pt-1 border-t border-white/20 text-[10px] font-semibold text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span>Release to drop</span>
            </div>
          )}
        </div>
      )}

      {/* Move Confirmation Modal for Complex or Rate-Adjusted Drops */}
      <MoveConfirmationModal
        isOpen={!!confirmModalData}
        dropData={confirmModalData}
        loading={confirmModalLoading}
        onConfirm={async () => {
          if (confirmModalData) {
            setConfirmModalLoading(true);
            try {
              await handleApplyMove(confirmModalData);
              setConfirmModalData(null);
            } finally {
              setConfirmModalLoading(false);
            }
          }
        }}
        onClose={() => setConfirmModalData(null)}
      />
    </div>
  );
}
