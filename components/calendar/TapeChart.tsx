"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { useToast } from "@/components/ui/Toast";
import { HookupIcons } from "@/components/ui/HookupIcons";
import { formatCurrency } from "@/lib/utils/format";
import { parseDateOnly, formatDateKey, addDays, diffDays } from "@/lib/utils/date";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
  Wrench,
  Ban,
  Calendar as CalendarIcon,
  Percent,
} from "lucide-react";

interface TapeChartProps {
  onSelectReservation: (reservationId: string) => void;
  onBookSiteDate: (siteId: string, siteNumber: string, date: string) => void;
}

export function TapeChart({ onSelectReservation, onBookSiteDate }: TapeChartProps) {
  const { error, info } = useToast();
  const todayKey = formatDateKey(new Date());

  const [startDateStr, setStartDateStr] = useState<string>(todayKey);
  const [daysCount, setDaysCount] = useState<number>(14);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchSite, setSearchSite] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [siteCategories, setSiteCategories] = useState<any[]>([]);

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

  const dateColumns = Array.from({ length: daysCount }).map((_, i) => {
    const d = addDays(windowStartDate, i);
    const dateKey = formatDateKey(d);
    const dayName = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const dayNum = d.getUTCDate();
    const isToday = dateKey === todayKey;
    const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;

    return { dateKey, dayName, dayNum, isToday, isWeekend, fullDate: d };
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

  return (
    <div className="surface-card flex flex-col overflow-hidden rounded-lg border border-slate-200 w-full">
      {/* Tape Chart Top Controls */}
      <div className="p-2.5 sm:p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50">
        {/* Navigation & Date Picker */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={handleToday}
            className="btn btn-outline btn-xs sm:btn-sm font-bold text-xs rounded-md bg-white hover:bg-slate-50"
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
              className="input input-bordered input-xs sm:input-sm font-medium bg-white rounded-md text-xs"
            />
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search site # or name..."
            value={searchSite}
            onChange={(e) => setSearchSite(e.target.value)}
            className="input input-bordered input-xs sm:input-sm bg-white rounded-md text-xs w-36 sm:w-48"
          />

          {siteCategories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="select select-bordered select-xs sm:select-sm bg-white rounded-md text-xs font-medium"
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
                daysCount === 7 ? "bg-emerald-600 text-white border-emerald-600" : "btn-outline bg-white hover:bg-slate-50"
              }`}
            >
              7D
            </button>
            <button
              onClick={() => setDaysCount(14)}
              className={`btn btn-xs sm:btn-sm join-item font-bold text-xs ${
                daysCount === 14 ? "bg-emerald-600 text-white border-emerald-600" : "btn-outline bg-white hover:bg-slate-50"
              }`}
            >
              14D
            </button>
            <button
              onClick={() => setDaysCount(30)}
              className={`btn btn-xs sm:btn-sm join-item font-bold text-xs ${
                daysCount === 30 ? "bg-emerald-600 text-white border-emerald-600" : "btn-outline bg-white hover:bg-slate-50"
              }`}
            >
              30D
            </button>
          </div>

          <button
            onClick={() => loadData(startDateStr, daysCount)}
            className="btn btn-ghost btn-xs sm:btn-sm btn-circle text-slate-600 hover:text-slate-900 rounded-md"
            title="Refresh Timeline"
            aria-label="Refresh Timeline"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Status Legend & Occupancy Summary */}
      <div className="px-3 sm:px-4 py-2 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between text-xs gap-2">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 text-[11px] sm:text-xs">
          <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Legend:</span>
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
        <div className="flex items-center gap-3 text-slate-500 text-[11px] font-medium">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[10px] border border-emerald-200">
            <Percent className="w-3 h-3 text-emerald-600" /> {occupancyRate}% Occupied
          </span>
          <span className="hidden md:inline text-slate-400">Click empty slot to book • Click bar to view reservation</span>
        </div>
      </div>

      {/* Grid Container with Sticky Column & Horizontal Scroll */}
      <div className="overflow-x-auto relative custom-scrollbar touch-pan-x">
        <div className="min-w-fit">
          {/* Header Row */}
          <div className="flex border-b border-slate-200 bg-slate-100 sticky top-0 z-20">
            {/* Sticky Site Column Header */}
            <div className="w-36 sm:w-48 md:w-56 shrink-0 p-2 sm:p-2.5 font-bold text-[11px] sm:text-xs uppercase tracking-wider text-slate-600 border-r border-slate-200 sticky left-0 bg-slate-100 z-30 flex items-center justify-between shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
              <span>Sites ({filteredSites.length})</span>
              <span className="hidden sm:inline text-[10px] text-slate-400 font-normal">Base Rate</span>
            </div>

            {/* Date Headers */}
            <div
              className="flex-1 grid"
              style={{ gridTemplateColumns: `repeat(${daysCount}, minmax(46px, 1fr))` }}
            >
              {dateColumns.map((col) => (
                <div
                  key={col.dateKey}
                  className={`py-1.5 sm:py-2 px-1 text-center border-r border-slate-200 transition-colors ${
                    col.isToday
                      ? "bg-emerald-50 font-black text-emerald-800"
                      : col.isWeekend
                      ? "bg-slate-50 text-slate-700"
                      : "text-slate-700"
                  }`}
                >
                  <div className="text-[9px] sm:text-[10px] uppercase font-bold tracking-tight">{col.dayName}</div>
                  <div className={`text-[11px] sm:text-xs ${col.isToday ? "font-black text-emerald-700" : "font-semibold"}`}>
                    {col.dayNum}
                  </div>
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
              <p className="text-xs font-medium">No sites match the current search or category filter.</p>
            </div>
          ) : (
            filteredSites.map((site) => {
              const isMaintenance = site.status === "maintenance";
              const isInactive = site.status === "inactive";

              const siteReservations = chartData.reservations.filter(
                (r) => (r.siteId === site._id || r.siteId?._id === site._id) && r.status !== "cancelled"
              );

              return (
                <div
                  key={site._id}
                  className={`flex border-b border-slate-100 transition-colors group relative ${
                    isMaintenance ? "bg-amber-50/20" : isInactive ? "bg-slate-50 opacity-60" : "hover:bg-slate-50/60"
                  }`}
                >
                  {/* Sticky Site Info Cell */}
                  <div className="w-36 sm:w-48 md:w-56 shrink-0 p-2 sm:p-2.5 border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] min-w-0">
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 font-mono truncate">
                          Site {site.siteNumber}
                        </span>
                        {isMaintenance && (
                          <span title="Maintenance" className="badge badge-warning badge-xs text-[9px] font-bold p-0.5">
                            <Wrench className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] sm:text-xs font-black text-emerald-700 font-mono shrink-0">
                        {formatCurrency(site.currentBaseRate)}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-500 truncate mt-0.5" title={site.siteTypeSnapshot?.name}>
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
                    style={{ gridTemplateColumns: `repeat(${daysCount}, minmax(46px, 1fr))` }}
                  >
                    {/* Background Clickable Date Slots */}
                    {dateColumns.map((col) => {
                      if (isMaintenance) {
                        return (
                          <div
                            key={col.dateKey}
                            onClick={() => info(`Site ${site.siteNumber} is currently under maintenance.`)}
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
                            col.isToday ? "bg-emerald-500/5" : col.isWeekend ? "bg-slate-50/40" : ""
                          }`}
                          title={`Available • Click to book Site ${site.siteNumber} on ${col.dateKey}`}
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-700 opacity-0 group-hover/slot:opacity-100 transition-opacity" />
                        </div>
                      );
                    })}

                    {/* Overlay Reservation Bars */}
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
                          resStart.getTime() < windowStartDate.getTime() ? windowStartDate : resStart;
                        const effectiveEnd =
                          resEnd.getTime() > windowEndDate.getTime() ? windowEndDate : resEnd;

                        const startOffset = Math.max(0, diffDays(windowStartDate, effectiveStart));
                        const span = Math.max(1, diffDays(effectiveStart, effectiveEnd));

                        const leftPercent = (startOffset / daysCount) * 100;
                        const widthPercent = (span / daysCount) * 100;

                        const isContinuingLeft = resStart.getTime() < windowStartDate.getTime();
                        const isContinuingRight = resEnd.getTime() > windowEndDate.getTime();

                        return (
                          <div
                            key={res._id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectReservation(res._id);
                            }}
                            className={`absolute top-1.5 bottom-1.5 border flex items-center px-1.5 sm:px-2 cursor-pointer z-10 transition-transform overflow-hidden ${
                              isContinuingLeft ? "rounded-l-none border-l-0" : "rounded-l-md"
                            } ${
                              isContinuingRight ? "rounded-r-none border-r-0" : "rounded-r-md"
                            } ${getStatusColor(res.status)}`}
                            style={{
                              left: `${leftPercent}%`,
                              width: `${widthPercent}%`,
                            }}
                            title={`${res.guestSnapshot?.fullName || "Guest"} (${res.confirmationCode}) • ${formatDateKey(
                              resStart
                            )} → ${formatDateKey(resEnd)} (${res.numNights || span} nts) • ${res.status}`}
                          >
                            <div className="truncate text-[10px] sm:text-xs font-bold leading-tight flex items-center gap-1">
                              {isContinuingLeft && <span className="text-[9px] opacity-70">◀</span>}
                              <span className="truncate">{res.guestSnapshot?.fullName || "Guest"}</span>
                              {res.guestSnapshot?.rvLengthFt ? (
                                <span className="opacity-80 text-[9px] font-mono hidden sm:inline shrink-0">
                                  ({res.guestSnapshot.rvLengthFt}ft)
                                </span>
                              ) : null}
                              {isContinuingRight && <span className="text-[9px] opacity-70 ml-auto">▶</span>}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
