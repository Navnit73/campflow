"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { useToast } from "@/components/ui/Toast";
import { HookupIcons } from "@/components/ui/HookupIcons";
import { formatCurrency, formatHookup, formatRigType } from "@/lib/utils/format";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  RefreshCw,
  Plus,
  Info,
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

  // Generate date array
  const dateColumns = Array.from({ length: daysCount }).map((_, i) => {
    const d = new Date(startDateStr + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    const dateKey = d.toISOString().split("T")[0];
    const dayName = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const dayNum = d.getUTCDate();
    const isToday =
      dateKey === new Date().toISOString().split("T")[0];

    return { dateKey, dayName, dayNum, isToday, fullDate: d };
  });

  const handlePrev = () => {
    const d = new Date(startDateStr + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 7);
    setStartDateStr(d.toISOString().split("T")[0]);
  };

  const handleNext = () => {
    const d = new Date(startDateStr + "T00:00:00Z");
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
    <div className="card bg-base-100 shadow-sm border border-base-200 flex flex-col overflow-hidden">
      {/* Tape Chart Top Controls */}
      <div className="p-4 border-b border-base-200 flex flex-wrap items-center justify-between gap-3 bg-base-50/50">
        <div className="flex items-center gap-2">
          <button onClick={handleToday} className="btn btn-outline btn-xs sm:btn-sm font-semibold">
            Today
          </button>
          <div className="join">
            <button onClick={handlePrev} className="btn btn-outline btn-xs sm:btn-sm join-item">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={handleNext} className="btn btn-outline btn-xs sm:btn-sm join-item">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 pl-2">
            <CalendarIcon className="w-4 h-4 text-base-content/60" />
            <input
              type="date"
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              className="input input-bordered input-xs sm:input-sm font-medium"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Days selector */}
          <div className="join">
            <button
              onClick={() => setDaysCount(7)}
              className={`btn btn-xs sm:btn-sm join-item ${daysCount === 7 ? "btn-primary" : "btn-outline"}`}
            >
              7 Days
            </button>
            <button
              onClick={() => setDaysCount(14)}
              className={`btn btn-xs sm:btn-sm join-item ${daysCount === 14 ? "btn-primary" : "btn-outline"}`}
            >
              14 Days
            </button>
            <button
              onClick={() => setDaysCount(30)}
              className={`btn btn-xs sm:btn-sm join-item ${daysCount === 30 ? "btn-primary" : "btn-outline"}`}
            >
              30 Days
            </button>
          </div>

          <button
            onClick={() => loadData(startDateStr, daysCount)}
            className="btn btn-ghost btn-xs sm:btn-sm btn-circle"
            title="Refresh Timeline"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Status Legend */}
      <div className="px-4 py-2 border-b border-base-200 bg-base-100 flex flex-wrap items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-base-content/60">Legend:</span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="w-3 h-3 rounded-full bg-emerald-600"></span> Confirmed
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="w-3 h-3 rounded-full bg-sky-600"></span> Checked In
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span> Pending
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="w-3 h-3 rounded-full bg-slate-400"></span> Checked Out
          </span>
        </div>
        <div className="text-base-content/50 italic text-[11px]">
          Click any empty slot to book • Click reservation bar to view/check-in
        </div>
      </div>

      {/* Grid Container with Horizontal Scroll */}
      <div className="overflow-x-auto relative">
        <div className="min-w-[900px]">
          {/* Header Row */}
          <div className="flex border-b border-base-200 bg-base-200/50 sticky top-0 z-20">
            {/* Site Column Header */}
            <div className="w-64 shrink-0 p-3 font-bold text-xs uppercase tracking-wider text-base-content/70 border-r border-base-200 sticky left-0 bg-base-200/90 backdrop-blur-xs z-30">
              Site / Hookups ({chartData.sites.length})
            </div>

            {/* Date Headers */}
            <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${daysCount}, minmax(56px, 1fr))` }}>
              {dateColumns.map((col) => (
                <div
                  key={col.dateKey}
                  className={`py-2 px-1 text-center border-r border-base-200/80 ${
                    col.isToday ? "bg-primary/15 font-bold text-primary" : "text-base-content/70"
                  }`}
                >
                  <div className="text-[10px] uppercase font-semibold">{col.dayName}</div>
                  <div className={`text-xs ${col.isToday ? "font-black" : "font-medium"}`}>{col.dayNum}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Body Rows */}
          {loading && chartData.sites.length === 0 ? (
            <div className="p-12 text-center text-base-content/60">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
              Loading tape chart calendar...
            </div>
          ) : chartData.sites.length === 0 ? (
            <div className="p-12 text-center text-base-content/60">
              No sites configured yet. Go to Sites & Hookups to add your campground sites.
            </div>
          ) : (
            chartData.sites.map((site) => {
              // Find all reservations for this site
              const siteReservations = chartData.reservations.filter(
                (r) => r.siteId === site._id || r.siteId?._id === site._id
              );

              return (
                <div
                  key={site._id}
                  className="flex border-b border-base-200/70 hover:bg-base-50/70 transition-colors group relative"
                >
                  {/* Sticky Site Info Cell */}
                  <div className="w-64 shrink-0 p-3 border-r border-base-200 sticky left-0 bg-base-100 group-hover:bg-base-50 z-10">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-base-content font-mono">
                        {site.siteNumber}
                      </span>
                      <span className="text-xs font-semibold text-emerald-600">
                        {formatCurrency(site.currentBaseRate)}/nt
                      </span>
                    </div>
                    <div className="mt-1">
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
                    className="flex-1 grid relative min-h-[58px]"
                    style={{ gridTemplateColumns: `repeat(${daysCount}, minmax(56px, 1fr))` }}
                  >
                    {/* Background Clickable Date Slots */}
                    {dateColumns.map((col) => (
                      <div
                        key={col.dateKey}
                        onClick={() => onBookSiteDate(site._id, site.siteNumber, col.dateKey)}
                        className={`border-r border-base-200/40 hover:bg-emerald-500/10 cursor-pointer transition-colors relative flex items-center justify-center group/slot ${
                          col.isToday ? "bg-primary/5" : ""
                        }`}
                        title={`Click to book Site ${site.siteNumber} on ${col.dateKey}`}
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-600 opacity-0 group-hover/slot:opacity-80 transition-opacity" />
                      </div>
                    ))}

                    {/* Overlay Reservation Bars */}
                    {siteReservations.map((res) => {
                      const resStart = new Date(res.checkInDate).toISOString().split("T")[0];
                      const resEnd = new Date(res.checkOutDate).toISOString().split("T")[0];

                      // Calculate grid start & span
                      const startIdx = dateColumns.findIndex((c) => c.dateKey === resStart);
                      const endIdx = dateColumns.findIndex((c) => c.dateKey === resEnd);

                      // If starts before view window, pin to start (index 0)
                      const effectiveStart = startIdx >= 0 ? startIdx : 0;
                      // If ends after view window, pin to end
                      const effectiveEnd = endIdx >= 0 ? endIdx : daysCount;
                      const span = Math.max(1, effectiveEnd - effectiveStart);

                      // If outside visible range entirely, skip rendering
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
                          className={`absolute top-1.5 bottom-1.5 rounded-lg border shadow-xs flex items-center px-2.5 cursor-pointer z-10 transition-transform hover:scale-[1.01] overflow-hidden ${getStatusColor(
                            res.status
                          )}`}
                          style={{
                            left: `${(effectiveStart / daysCount) * 100}%`,
                            width: `${(span / daysCount) * 100}%`,
                          }}
                          title={`${res.guestSnapshot?.fullName || "Guest"} (${res.confirmationCode}) • ${res.numNights} nights • ${res.status}`}
                        >
                          <div className="truncate text-xs font-semibold leading-tight">
                            <span>{res.guestSnapshot?.fullName || "Guest"}</span>
                            {res.guestSnapshot?.rvLengthFt ? (
                              <span className="opacity-80 ml-1 text-[11px] font-mono">
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
