"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  Megaphone,
  Users,
  AlertTriangle,
  Flame,
  Wrench,
  Compass,
  Send,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  BROADCAST_PRIORITIES,
  BROADCAST_RECIPIENT_FILTERS,
} from "@/lib/validations/communication.schema";

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialFilter?: "all_guests" | "in_house_campers" | "upcoming_arrivals";
}

const TEMPLATES = [
  {
    id: "weather",
    title: "Severe Weather Warning",
    icon: AlertTriangle,
    priority: "weather_alert" as const,
    subject: "Severe Weather Warning: Please Secure RV Awnings & Equipment",
    message:
      "A high-wind and thunderstorm advisory has been issued for our area this evening.\n\nFor your safety and protection, please retract all RV awnings, secure loose camp furniture, and disconnect water hoses if freezing temperatures are forecast. Our park clubhouse remains open 24/7 if you need storm shelter.",
  },
  {
    id: "event",
    title: "Campfire Social & S'mores",
    icon: Flame,
    priority: "event" as const,
    subject: "Community Campfire & S'mores Night at the Pavilion!",
    message:
      "Join our campground team tonight at 7:30 PM by the Main Pavilion fire pit for complimentary hot cocoa, s'mores kits, and live acoustic music!\n\nAll campers, families, and furry friends are welcome. Bring a camp chair and enjoy the evening stars with fellow adventurers.",
  },
  {
    id: "maintenance",
    title: "Utility Maintenance Notice",
    icon: Wrench,
    priority: "urgent" as const,
    subject: "Scheduled Water / Power Maintenance Tomorrow Morning",
    message:
      "Please be advised that scheduled maintenance will take place tomorrow between 9:00 AM and 11:00 AM to upgrade campground utility lines.\n\nWater and power services may experience brief 15-minute interruptions during this window. We apologize for the temporary inconvenience as we keep our resort facilities in top shape.",
  },
  {
    id: "advisory",
    title: "Arrival / Route Advisory",
    icon: Compass,
    priority: "general" as const,
    subject: "Campground Route & Check-in Advisory",
    message:
      "Safe travels on your journey to our campground!\n\nDue to local highway roadwork, we recommend approaching via North Gate Entrance (Mile Marker 4). Front Desk check-in is available until 8:00 PM; if you expect to arrive later, please give our office a quick call for after-hours site escort.",
  },
];

export function BroadcastModal({
  isOpen,
  onClose,
  onSuccess,
  initialFilter = "in_house_campers",
}: BroadcastModalProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);

  // Form State
  const [recipientFilter, setRecipientFilter] = useState<
    "all_guests" | "in_house_campers" | "upcoming_arrivals"
  >(initialFilter);
  const [priority, setPriority] = useState<"general" | "event" | "urgent" | "weather_alert">(
    "general"
  );
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // Audience Count
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);

  // Fetch Audience Count when filter changes
  useEffect(() => {
    if (isOpen) {
      setAudienceLoading(true);
      apiClient
        .get("/api/communications/audience-count", {
          params: { recipientFilter },
        })
        .then((res) => {
          if (res.data?.success) {
            setAudienceCount(res.data.data.count);
          }
        })
        .catch(() => {})
        .finally(() => setAudienceLoading(false));
    }
  }, [recipientFilter, isOpen]);

  const handleApplyTemplate = (tmpl: (typeof TEMPLATES)[0]) => {
    setSubject(tmpl.subject);
    setMessage(tmpl.message);
    setPriority(tmpl.priority);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      error("Please fill in subject and message body");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to send this broadcast to ${
          audienceCount !== null ? audienceCount : "all targeted"
        } campers?`
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post("/api/communications/broadcasts", {
        subject,
        message,
        priority,
        recipientFilter,
      });

      if (res.data?.success) {
        success(
          `Announcement dispatched to ${res.data.data.recipientCount} campers successfully!`
        );
        onSuccess();
        onClose();
        setSubject("");
        setMessage("");
      }
    } catch (err: any) {
      error(err?.message || "Failed to dispatch broadcast");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Broadcast Announcement to Campers"
      subtitle="Send high-priority emails to in-house guests, upcoming arrivals, or your entire guest directory"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1: Audience & Priority */}
        <div className="p-3.5 sm:p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700">
              <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              1. Target Audience
            </div>
            {/* Live Audience Count Badge */}
            <div className="flex items-center gap-1.5 text-xs font-bold bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
              <span className="text-slate-500">Recipients:</span>
              {audienceLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              ) : audienceCount && audienceCount > 0 ? (
                <span className="font-mono text-emerald-800 font-black">
                  {audienceCount} Campers
                </span>
              ) : (
                <span className="font-mono text-amber-700 font-bold">
                  0 Campers (Test Mode)
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">
                Who should receive this?
              </label>
              <select
                value={recipientFilter}
                onChange={(e) => setRecipientFilter(e.target.value as any)}
                className="select select-bordered select-sm w-full bg-white rounded-md text-xs font-medium"
              >
                <option value="in_house_campers">
                  Currently Checked-In Campers (In-House)
                </option>
                <option value="upcoming_arrivals">
                  Upcoming Arrivals (Next 7 Days)
                </option>
                <option value="all_guests">All Registered Guests in CRM</option>
              </select>
            </div>

            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">
                Priority & Tone
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="select select-bordered select-sm w-full bg-white rounded-md text-xs font-medium capitalize"
              >
                <option value="general">Standard Announcement (Green)</option>
                <option value="event">Event & Activities (Purple)</option>
                <option value="urgent">Important Notice (Orange)</option>
                <option value="weather_alert">⚠️ Severe Weather Alert (Red)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Quick Template Presets */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-600" /> Quick Preset Templates
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TEMPLATES.map((tmpl) => {
              const IconComp = tmpl.icon;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleApplyTemplate(tmpl)}
                  className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-emerald-400 text-left transition-all flex flex-col justify-between space-y-1 group"
                >
                  <div className="flex items-center gap-1.5">
                    <IconComp className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-600" />
                    <span className="text-[11px] font-bold text-slate-800 line-clamp-1">
                      {tmpl.title}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">1-click insert</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Subject & Message Body */}
        <div className="p-3.5 sm:p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-200/60">
            <Megaphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            2. Message Content
          </div>

          <div className="space-y-3">
            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">
                Email Subject Line
              </label>
              <input
                type="text"
                placeholder="e.g. Severe Weather Alert: High Wind Advisory This Evening"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="input input-bordered input-sm w-full bg-white rounded-md text-xs sm:text-sm font-semibold"
                required
              />
            </div>

            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">
                Announcement Message
              </label>
              <textarea
                placeholder="Write your announcement message for campers..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="textarea textarea-bordered textarea-sm w-full bg-white rounded-md text-xs leading-relaxed"
                required
              />
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn btn-ghost btn-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-sm px-6 font-bold shadow-xs flex items-center gap-1.5"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {audienceCount && audienceCount > 0 ? "Send Broadcast Now" : "Send Test Broadcast"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
