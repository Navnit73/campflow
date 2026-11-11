"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/utils/format";
import {
  Megaphone,
  Plus,
  RefreshCw,
  Users,
  AlertTriangle,
  Flame,
  Wrench,
  Compass,
  Send,
  CheckCircle2,
  Clock,
  Mail,
  HelpCircle,
  Inbox,
} from "lucide-react";
import { BroadcastModal } from "@/components/communications/BroadcastModal";

export default function CommunicationsPage() {
  const { success, error } = useToast();

  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Audience counts
  const [inHouseCount, setInHouseCount] = useState<number>(0);
  const [upcomingCount, setUpcomingCount] = useState<number>(0);
  const [allGuestsCount, setAllGuestsCount] = useState<number>(0);

  const fetchBroadcastsAndCounts = async () => {
    setLoading(true);
    try {
      const [bRes, inHouseRes, upRes, allRes] = await Promise.all([
        apiClient.get("/api/communications/broadcasts"),
        apiClient.get("/api/communications/audience-count", {
          params: { recipientFilter: "in_house_campers" },
        }),
        apiClient.get("/api/communications/audience-count", {
          params: { recipientFilter: "upcoming_arrivals" },
        }),
        apiClient.get("/api/communications/audience-count", {
          params: { recipientFilter: "all_guests" },
        }),
      ]);

      if (bRes.data?.success) setBroadcasts(bRes.data.data || []);
      if (inHouseRes.data?.success) setInHouseCount(inHouseRes.data.data.count);
      if (upRes.data?.success) setUpcomingCount(upRes.data.data.count);
      if (allRes.data?.success) setAllGuestsCount(allRes.data.data.count);
    } catch (err: any) {
      error(err?.message || "Failed to load communications history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBroadcastsAndCounts();
  }, []);

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "weather_alert":
        return (
          <span className="badge badge-error badge-xs font-bold text-white uppercase text-[10px] gap-1">
            <AlertTriangle className="w-3 h-3" /> Weather Alert
          </span>
        );
      case "urgent":
        return (
          <span className="badge badge-warning badge-xs font-bold text-slate-900 uppercase text-[10px] gap-1">
            <Wrench className="w-3 h-3" /> Important Notice
          </span>
        );
      case "event":
        return (
          <span className="badge badge-secondary badge-xs font-bold text-white uppercase text-[10px] gap-1">
            <Flame className="w-3 h-3" /> Event & Social
          </span>
        );
      case "general":
      default:
        return (
          <span className="badge badge-success badge-xs font-bold text-white uppercase text-[10px] gap-1">
            <Megaphone className="w-3 h-3" /> Announcement
          </span>
        );
    }
  };

  const getAudienceBadge = (filter: string) => {
    switch (filter) {
      case "in_house_campers":
        return "In-House Checked-In Campers";
      case "upcoming_arrivals":
        return "Upcoming Arrivals (Next 7 Days)";
      case "all_guests":
      default:
        return "All Registered CRM Campers";
    }
  };

  return (
    <div className="space-y-5 max-w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-emerald-600" />
            Camper Announcements & Mass Mail
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Broadcast severe weather warnings, community events, and park advisories directly to all campers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary btn-sm gap-1.5 font-bold rounded-md shadow-xs"
          >
            <Plus className="w-4 h-4" />
            New Broadcast Announcement
          </button>

          <button
            onClick={fetchBroadcastsAndCounts}
            className="btn btn-ghost btn-sm btn-circle text-slate-600 hover:text-slate-900 rounded-md"
            title="Refresh History"
            aria-label="Refresh History"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="surface-card p-3.5 sm:p-4 rounded-lg border border-slate-200">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Broadcasts
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
            {broadcasts.length} Sent
          </div>
        </div>

        <div className="surface-card p-3.5 sm:p-4 rounded-lg border border-slate-200">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Currently In-House
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono mt-0.5">
            {inHouseCount} Campers
          </div>
        </div>

        <div className="surface-card p-3.5 sm:p-4 rounded-lg border border-slate-200">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Upcoming Next 7 Days
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-0.5">
            {upcomingCount} Arrivals
          </div>
        </div>

        <div className="surface-card p-3.5 sm:p-4 rounded-lg border border-slate-200">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total CRM Reach
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-0.5">
            {allGuestsCount} Guests
          </div>
        </div>
      </div>

      {/* Broadcast History Table */}
      <div className="surface-card rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-emerald-600" />
            Announcement History ({broadcasts.length})
          </h3>
          <span className="text-xs text-slate-400">Delivered via Resend</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-1" />
            <p className="text-xs font-semibold">Loading broadcast logs...</p>
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <Megaphone className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">No announcements sent yet</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Use mass messaging to communicate severe weather warnings, daily activities, or check-in instructions to all your guests at once.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn btn-primary btn-sm font-bold rounded-md mt-1"
            >
              Send First Broadcast
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {broadcasts.map((b) => (
              <div key={b._id} className="p-4 hover:bg-slate-50/70 transition-all space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(b.priority)}
                      <span className="badge badge-ghost badge-xs text-[10px] font-semibold text-slate-600">
                        {getAudienceBadge(b.recipientFilter)}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 pt-0.5">{b.subject}</h4>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {b.status === "queued" || b.status === "sending"
                        ? `Sending to ${b.recipientCount} recipients…`
                        : `${b.deliveryStats?.successful ?? b.recipientCount} of ${b.recipientCount} delivered`}
                      {(b.status === "failed" || b.status === "partial") && (
                        <span className="ml-1 text-amber-700">({b.status})</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {formatDateTime(b.createdAt)} by {b.sentByUserName || "Staff"}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-md border border-slate-100 whitespace-pre-line leading-relaxed">
                  {b.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Broadcast Modal */}
      <BroadcastModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchBroadcastsAndCounts}
      />
    </div>
  );
}
