"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { useToast } from "@/components/ui/Toast";
import {
  X,
  CalendarClock,
  Mail,
  FileSpreadsheet,
  Clock,
  Layers,
  Save,
  Plus,
  Trash2,
} from "lucide-react";
import { ExportReportType } from "@/models/ExportJob";

interface ScheduleExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any | null;
}

export function ScheduleExportModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: ScheduleExportModalProps) {
  const { success, error } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<ExportReportType>("excel_master_accounting");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [dayOfWeek, setDayOfWeek] = useState<number>(1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [time, setTime] = useState<string>("08:00");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setType(initialData.type || "excel_master_accounting");
      setFrequency(initialData.frequency || "weekly");
      setDayOfWeek(initialData.dayOfWeek ?? 1);
      setDayOfMonth(initialData.dayOfMonth ?? 1);
      setTime(initialData.time || "08:00");
      setRecipients(initialData.recipients || []);
      setIsActive(initialData.isActive ?? true);
    } else {
      setName("");
      setType("excel_master_accounting");
      setFrequency("weekly");
      setDayOfWeek(1);
      setDayOfMonth(1);
      setTime("08:00");
      setRecipients([]);
      setIsActive(true);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleAddRecipient = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ("key" in e && e.key !== "Enter") return;
    e.preventDefault();

    const trimmed = recipientInput.trim().toLowerCase();
    if (!trimmed) return;

    if (!trimmed.includes("@") || !trimmed.includes(".")) {
      error("Please enter a valid email address");
      return;
    }

    if (recipients.includes(trimmed)) {
      setRecipientInput("");
      return;
    }

    setRecipients([...recipients, trimmed]);
    setRecipientInput("");
  };

  const handleRemoveRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      error("Please enter a schedule name");
      return;
    }

    let finalRecipients = [...recipients];
    if (recipientInput.trim()) {
      const trimmed = recipientInput.trim().toLowerCase();
      if (trimmed.includes("@") && !finalRecipients.includes(trimmed)) {
        finalRecipients.push(trimmed);
      }
    }

    if (finalRecipients.length === 0) {
      error("Please add at least one recipient email");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        frequency,
        dayOfWeek: frequency === "weekly" ? Number(dayOfWeek) : undefined,
        dayOfMonth: frequency === "monthly" ? Number(dayOfMonth) : undefined,
        time,
        recipients: finalRecipients,
        isActive,
      };

      if (initialData?._id) {
        await apiClient.put(`/api/exports/schedules/${initialData._id}`, payload);
        success("Export schedule updated successfully");
      } else {
        await apiClient.post("/api/exports/schedules", payload);
        success("Automated export schedule created successfully");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      error(err?.response?.data?.message || err?.message || "Failed to save schedule");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                {initialData ? "Edit Automated Export Schedule" : "Create Automated Export Schedule"}
              </h2>
              <p className="text-xs text-slate-500">
                Automate scheduled Excel report generation and email delivery
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-xs btn-circle text-slate-400 hover:text-slate-700"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Schedule Name */}
          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">
              Schedule Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Weekly Management & Accounting Report"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input input-bordered input-sm w-full font-medium rounded-md"
              required
            />
          </div>

          {/* Report Type */}
          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">
              Report Format <span className="text-rose-500">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ExportReportType)}
              className="select select-bordered select-sm w-full font-medium rounded-md"
            >
              <option value="excel_master_accounting">
                Master Campground Accounting Workbook (Multi-Sheet Comprehensive)
              </option>
              <option value="excel_bookings">Bookings & Occupancy Report</option>
              <option value="excel_transactions">Financial Transactions & Payment Ledger</option>
              <option value="excel_invoices">Invoices & Lodging Tax Liability Audit</option>
              <option value="excel_customers">Guest CRM Directory & Camper Roster</option>
            </select>
          </div>

          {/* Frequency & Timing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                className="select select-bordered select-sm w-full font-medium rounded-md"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {frequency === "weekly" && (
              <div>
                <label className="label text-xs font-bold text-slate-700 py-0.5">Day of Week</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="select select-bordered select-sm w-full font-medium rounded-md"
                >
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                  <option value={0}>Sunday</option>
                </select>
              </div>
            )}

            {frequency === "monthly" && (
              <div>
                <label className="label text-xs font-bold text-slate-700 py-0.5">Day of Month</label>
                <select
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Number(e.target.value))}
                  className="select select-bordered select-sm w-full font-medium rounded-md font-mono"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      Day {d} of month
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={frequency === "daily" ? "sm:col-span-2" : ""}>
              <label className="label text-xs font-bold text-slate-700 py-0.5">Time (24h)</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="input input-bordered input-sm w-full font-mono font-medium rounded-md"
                required
              />
            </div>
          </div>

          {/* Email Recipients */}
          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">
              Email Recipients (Automated Attachment Delivery) <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="accountant@campground.com"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={handleAddRecipient}
                className="input input-bordered input-sm flex-1 font-medium rounded-md text-xs"
              />
              <button
                type="button"
                onClick={handleAddRecipient}
                className="btn btn-sm btn-outline text-emerald-700 border-emerald-300 hover:bg-emerald-50 rounded-md font-bold"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            {/* Recipient Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2 min-h-[32px] p-2 bg-slate-50 border border-slate-200 rounded-md">
              {recipients.length === 0 ? (
                <span className="text-slate-400 italic text-[11px] py-0.5">
                  No email recipients added yet. Add at least one email address.
                </span>
              ) : (
                recipients.map((email) => (
                  <span
                    key={email}
                    className="badge badge-sm bg-white border-slate-300 text-slate-700 gap-1.5 py-1 px-2 font-medium"
                  >
                    <Mail className="w-3 h-3 text-slate-400" />
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(email)}
                      className="hover:text-rose-600 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <div className="font-bold text-slate-900">Enable Automated Schedule</div>
              <div className="text-[11px] text-slate-500">
                When active, CampFlow will generate and email the Excel workbook automatically.
              </div>
            </div>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="toggle toggle-emerald toggle-sm"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn btn-ghost btn-sm font-semibold rounded-md text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-sm font-bold rounded-md min-w-[130px]"
            >
              {submitting ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {initialData ? "Save Changes" : "Create Schedule"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
