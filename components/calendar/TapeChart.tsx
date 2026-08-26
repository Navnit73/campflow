"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { useToast } from "@/components/ui/Toast";
import { HookupIcons } from "@/components/ui/HookupIcons";
import { formatCurrency } from "@/lib/utils/format";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  RefreshCw,
  Plus,
  PlusCircle,
} from "lucide-react";

interface TapeChartProps {
  onSelectReservation: (reservationId: string) => void;
  onBookSiteDate: (siteId: string, siteNumber: string, date: string) => void;
}

export function TapeChart({ onSelectReservation, onBookSiteDate }: TapeChartProps) {
  const { error } = useToast();
  const [startDateStr, setStartDateStr] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [daysCount, setDaysCount] = useState<number>(14);
  const [loading, setLoading] = useState<boolean>(true);
  const [chartData, setChartData] = useState<{
    sites: any[];
    reservations: any[];
  }>({ sites: [], reservations: [] });

  const loadData = async (dateStr: string, days: number) => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/reservations/tape-chart", {
        params: { startDate: dateStr, days },
      });
      if (res.data?.success) {
        setChartData({
          sites: res.data.data.sites || [],
          reservations: res.data.data.reservations || [],
        });
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

  // Generate date array safely
  const validStart = startDateStr && !isNaN(new Date(startDateStr + "T00:00:00Z").getTime())
    ? startDateStr
    : new Date().toISOString().split("T")[0];

  const dateColumns = Array.from({ length: daysCount }).map((_, i) => {
    const d = new Date(validStart + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    const dateKey = d.toISOString().split("T")[0];
    const dayName = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const dayNum = d.getUTCDate();
    const isToday = dateKey === new Date().toISOString().split("T")[0];
    const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;

    return { dateKey, dayName, dayNum, isToday, isWeekend, fullDate: d };
  });

  const handlePrev = () => {
    const d = new Date(validStart + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 7);
    setStartDateStr(d.toISOString().split("T")[0]);
  };

  const handleNext = () => {
    const d = new Date(validStart + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 7);
    setStartDateStr(d.toISOString().split("T")[0]);
  };

  const handleToday = () => {
    setStartDateStr(new Date().toISOString().split("T")[0]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "checked_in":
        return "bg-sky-600 text-white border-sky-700 hover:bg-sky-700";
      case "confirmed":
        return "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700";
      case "pending":
        return "bg-amber-500 text-slate-900 border-amber-600 hover:bg-amber-600";
      case "checked_out":
        return "bg-slate-400 text-white border-slate-500 hover:bg-slate-500";
      default:
        return "bg-slate-500 text-white border-slate-600";
    }
  };

  return (
    <div className="surface-card flex flex-col overflow-hidden rounded-lg border border-slate-200 w-full">
      {/* Tape Chart Top Controls - Fully Responsive */}
      <div className="p-2.5 sm:p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50">
        {/* Navigation & Date Picker */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={handleToday}
            className="btn btn-outline btn-xs sm:btn-sm font-bold text-xs rounded-md"
          >
            Today
          </button>
          <div className="join">
            <button
              onClick={handlePrev}
              className="btn btn-outline btn-xs sm:btn-sm join-item rounded-l-md"
              aria-label="Previous 7 days"
              title="Previous 7 days"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              onClick={handleNext}
              className="btn btn-outline btn-xs sm:btn-sm join-item rounded-r-md"
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

        {/* Days Window Selector + Refresh */}
        <div className="flex items-center gap-2">
          <div className="join">
            <button
              onClick={() => setDaysCount(7)}
              className={`btn btn-xs sm:btn-sm join-item font-bold text-xs rounded-l-md ${
                daysCount === 7 ? "bg-emerald-600 text-white border-emerald-600" : "btn-outline"
              }`}
            >
              7D
            </button>
            <button
              onClick={() => setDaysCount(14)}
              className={`btn btn-xs sm:btn-sm join-item font-bold text-xs ${
                daysCount === 14 ? "bg-emerald-600 text-white border-emerald-600" : "btn-outline"
              }`}
            >
              14D
            </button>
            <button
              onClick={() => setDaysCount(30)}
              className={`btn btn-xs sm:btn-sm join-item font-bold text-xs rounded-r-md ${
                daysCount === 30 ? "bg-emerald-600 text-white border-emerald-600" : "btn-outline"
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

      {/* Status Legend */}
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
        </div>
        <div className="text-slate-400 text-[10px] sm:text-[11px] font-medium hidden md:block">
          Tap slot to book • Tap bar to inspect
        </div>
      </div>

      {/* Grid Container with Responsive Sticky Column & Horizontal Scroll */}
      <div className="overflow-x-auto relative custom-scrollbar touch-pan-x">
        <div className="min-w-fit">
          {/* Header Row */}
          <div className="flex border-b border-slate-200 bg-slate-100 sticky top-0 z-20">
            {/* Responsive Site Column Header */}
            <div className="w-32 sm:w-44 md:w-56 shrink-0 p-2 sm:p-2.5 font-bold text-[11px] sm:text-xs uppercase tracking-wider text-slate-600 border-r border-slate-200 sticky left-0 bg-slate-100 z-30 flex items-center justify-between shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
              <span>Site ({chartData.sites.length})</span>
              <span className="hidden sm:inline text-[10px] text-slate-400 font-normal">Rate</span>
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
          {loading && chartData.sites.length === 0 ? (
            <div className="p-10 sm:p-14 text-center text-slate-500 space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-1" />
              <p className="text-xs font-semibold">Loading tape chart calendar...</p>
            </div>
          ) : chartData.sites.length === 0 ? (
            <div className="p-10 sm:p-14 text-center text-slate-500 space-y-3">
              <p className="text-xs font-medium">No sites created yet in your campground inventory.</p>
              <Link href="/sites" className="btn btn-primary btn-sm gap-1.5 font-bold rounded-md">
                <PlusCircle className="w-4 h-4" />
                Add Your First Site
              </Link>
            </div>
          ) : (
            chartData.sites.map((site) => {
              const siteReservations = chartData.reservations.filter(
                (r) => r.siteId === site._id || r.siteId?._id === site._id
              );

              return (
                <div
                  key={site._id}
                  className="flex border-b border-slate-100 hover:bg-slate-50/60 transition-colors group relative"
                >
                  {/* Sticky Site Info Cell - Responsive width with divider shadow */}
                  <div className="w-32 sm:w-44 md:w-56 shrink-0 p-2 sm:p-2.5 border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 font-mono truncate">
                        Site {site.siteNumber}
                      </span>
                      <span className="text-[10px] sm:text-xs font-black text-emerald-700 font-mono shrink-0">
                        {formatCurrency(site.currentBaseRate)}
                      </span>
                    </div>
                    <div className="mt-0.5 sm:mt-1">
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
                    className="flex-1 grid relative min-h-[50px] sm:min-h-[56px]"
                    style={{ gridTemplateColumns: `repeat(${daysCount}, minmax(46px, 1fr))` }}
                  >
                    {/* Background Clickable Date Slots */}
                    {dateColumns.map((col) => (
                      <div
                        key={col.dateKey}
                        onClick={() => onBookSiteDate(site._id, site.siteNumber, col.dateKey)}
                        className={`border-r border-slate-100 hover:bg-emerald-500/10 cursor-pointer transition-colors relative flex items-center justify-center group/slot ${
                          col.isToday ? "bg-emerald-500/5" : col.isWeekend ? "bg-slate-50/40" : ""
                        }`}
                        title={`Click to book Site ${site.siteNumber} on ${col.dateKey}`}
                      >
                        <Plus className="w-3 h-3 text-emerald-700 opacity-0 group-hover/slot:opacity-100 transition-opacity" />
                      </div>
                    ))}

                    {/* Overlay Reservation Bars */}
                    {siteReservations.map((res) => {
                      const resStart = new Date(res.checkInDate).toISOString().split("T")[0];
                      const resEnd = new Date(res.checkOutDate).toISOString().split("T")[0];

                      const startIdx = dateColumns.findIndex((c) => c.dateKey === resStart);
                      const endIdx = dateColumns.findIndex((c) => c.dateKey === resEnd);

                      const effectiveStart = startIdx >= 0 ? startIdx : 0;
                      const effectiveEnd = endIdx >= 0 ? endIdx : daysCount;
                      const span = Math.max(1, effectiveEnd - effectiveStart);

                      if (startIdx < 0 && endIdx < 0 && resEnd < dateColumns[0].dateKey) {
                        return null;
                      }

                      return (
                        <div
                          key={res._id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectReservation(res._id);
                          }}
                          className={`absolute top-1 bottom-1 rounded border flex items-center px-1.5 sm:px-2 cursor-pointer z-10 transition-transform overflow-hidden ${getStatusColor(
                            res.status
                          )}`}
                          style={{
                            left: `${(effectiveStart / daysCount) * 100}%`,
                            width: `${(span / daysCount) * 100}%`,
                          }}
                          title={`${res.guestSnapshot?.fullName || "Guest"} (${res.confirmationCode}) • ${res.numNights} nights • ${res.status}`}
                        >
                          <div className="truncate text-[10px] sm:text-xs font-bold leading-tight">
                            <span>{res.guestSnapshot?.fullName || "Guest"}</span>
                            {res.guestSnapshot?.rvLengthFt ? (
                              <span className="opacity-80 ml-1 text-[9px] font-mono hidden sm:inline">
                                ({res.guestSnapshot.rvLengthFt}ft)
                              </span>
                            ) : null}
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
