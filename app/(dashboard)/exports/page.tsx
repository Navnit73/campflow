"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { useToast } from "@/components/ui/Toast";
import { StatCard } from "@/components/ui/StatCard";
import { ScheduleExportModal } from "@/components/exports/ScheduleExportModal";
import { formatDateTime } from "@/lib/utils/format";
import {
  FileSpreadsheet,
  Download,
  CalendarClock,
  History,
  CalendarCheck,
  CreditCard,
  Receipt,
  Users,
  Layers,
  Clock,
  Play,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Mail,
  ChevronLeft,
  ChevronRight,
  Filter,
  Sparkles,
  Inbox,
} from "lucide-react";
import { ExportReportType } from "@/models/ExportJob";

export default function ExportsPage() {
  const { success, error, info } = useToast();

  // Active Tab
  const [activeTab, setActiveTab] = useState<"on-demand" | "schedules" | "history">("on-demand");

  // On-Demand Form State
  const [selectedReportType, setSelectedReportType] = useState<ExportReportType>("excel_master_accounting");
  const [preset, setPreset] = useState<string>("30d");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [isGenerating, setIsGenerating] = useState(false);

  // Schedules State
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any | null>(null);
  const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null);

  // History State
  const [historyJobs, setHistoryJobs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyPagination, setHistoryPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");

  // Summary Metrics
  const [totalExportsCount, setTotalExportsCount] = useState(0);

  // Load Schedules
  const fetchSchedules = async () => {
    setLoadingSchedules(true);
    try {
      const res = await apiClient.get("/api/exports/schedules");
      if (res.data?.success) {
        setSchedules(res.data.data);
      }
    } catch (err: any) {
      error(err?.message || "Failed to load schedules");
    } finally {
      setLoadingSchedules(false);
    }
  };

  // Load History
  const fetchHistory = async (page = 1) => {
    setLoadingHistory(true);
    try {
      const res = await apiClient.get("/api/exports/history", {
        params: {
          page,
          limit: 20,
          type: historyTypeFilter !== "all" ? historyTypeFilter : undefined,
          status: historyStatusFilter !== "all" ? historyStatusFilter : undefined,
        },
      });
      if (res.data?.success) {
        setHistoryJobs(res.data.data.jobs);
        setHistoryPagination(res.data.data.pagination);
        setTotalExportsCount(res.data.data.pagination.total);
      }
    } catch (err: any) {
      error(err?.message || "Failed to load export history");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
    fetchHistory(1);
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory(1);
    } else if (activeTab === "schedules") {
      fetchSchedules();
    }
  }, [activeTab, historyTypeFilter, historyStatusFilter]);

  // Trigger On-Demand Export and auto-download
  const handleGenerateOnDemand = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    try {
      const payload = {
        type: selectedReportType,
        preset: preset !== "custom" ? preset : undefined,
        startDate: preset === "custom" && startDate ? startDate : undefined,
        endDate: preset === "custom" && endDate ? endDate : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        paymentMethod: methodFilter !== "all" ? methodFilter : undefined,
      };

      info("Generating formatted Excel workbook...");

      const res = await apiClient.post("/api/exports/on-demand", payload);

      if (res.data?.success) {
        const downloadUrl = res.data.data.downloadUrl;
        const fileName = res.data.data.fileName;

        // Auto trigger browser download
        const downloadLink = document.createElement("a");
        downloadLink.href = downloadUrl;
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        success(`✓ "${fileName}" (${res.data.data.recordsCount} records) downloaded successfully!`);
        fetchHistory(1);
      }
    } catch (err: any) {
      error(err?.response?.data?.message || err?.message || "Export generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  // Run Schedule Now
  const handleRunScheduleNow = async (scheduleId: string, scheduleName: string) => {
    setRunningScheduleId(scheduleId);
    try {
      info(`Executing scheduled report "${scheduleName}"...`);
      const res = await apiClient.post(`/api/exports/schedules/${scheduleId}/run-now`);
      if (res.data?.success) {
        success(`✓ Scheduled report "${scheduleName}" generated and dispatched to recipients!`);
        fetchSchedules();
        fetchHistory(1);
      }
    } catch (err: any) {
      error(err?.response?.data?.message || err?.message || "Failed to execute schedule");
    } finally {
      setRunningScheduleId(null);
    }
  };

  // Delete Schedule
  const handleDeleteSchedule = async (scheduleId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete schedule "${name}"?`)) return;
    try {
      await apiClient.delete(`/api/exports/schedules/${scheduleId}`);
      success("Schedule deleted successfully");
      fetchSchedules();
    } catch (err: any) {
      error(err?.message || "Failed to delete schedule");
    }
  };

  // Toggle Schedule Active
  const handleToggleSchedule = async (schedule: any) => {
    try {
      await apiClient.put(`/api/exports/schedules/${schedule._id}`, {
        isActive: !schedule.isActive,
      });
      success(`Schedule ${!schedule.isActive ? "activated" : "paused"}`);
      fetchSchedules();
    } catch (err: any) {
      error(err?.message || "Failed to update schedule status");
    }
  };

  const reportTypeCards: Array<{
    type: ExportReportType;
    title: string;
    description: string;
    badge: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      type: "excel_master_accounting",
      title: "Master Campground Accounting Workbook",
      description:
        "Comprehensive multi-worksheet file including Executive Summary KPI Cover, Bookings Ledger, Transactions, Invoices & Lodging Tax Liability Audit, and Guest CRM Directory.",
      badge: "Multi-Sheet All-in-One",
      icon: Layers,
    },
    {
      type: "excel_bookings",
      title: "Bookings & Occupancy Report",
      description:
        "Confirmation numbers, guest contacts, site numbers, hookups, RV specifications, check-in/out dates, total nights, lodging rates, add-ons, and balances.",
      badge: "Reservations",
      icon: CalendarCheck,
    },
    {
      type: "excel_transactions",
      title: "Financial Transactions & Payment Ledger",
      description:
        "Payment timestamps, confirmation IDs, payment methods (cash, card, check), gross receipts, manual refunds, and net revenue audit trails.",
      badge: "Payments Ledger",
      icon: CreditCard,
    },
    {
      type: "excel_invoices",
      title: "Invoices & Lodging Tax Liability Audit",
      description:
        "Nightly lodging base, taxable vs non-taxable add-on line items, lodging tax percentages (%), tax amounts collected, gross billed, and receivables.",
      badge: "Tax & Folios",
      icon: Receipt,
    },
    {
      type: "excel_customers",
      title: "Guest CRM Directory & Camper Roster",
      description:
        "Camper roster with contact information, residential addresses, RV types & lengths, license plates, total lifetime stays, and spend.",
      badge: "CRM Roster",
      icon: Users,
    },
  ];

  const presetsList = [
    { id: "today", label: "Today" },
    { id: "7d", label: "Last 7 Days" },
    { id: "30d", label: "Last 30 Days" },
    { id: "mtd", label: "Month to Date" },
    { id: "qtd", label: "Quarter to Date" },
    { id: "ytd", label: "Year to Date" },
    { id: "custom", label: "Custom Dates" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            Exports & Financial Reporting
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Structured Microsoft Excel (.xlsx) financial workbooks, bookings ledgers, tax liability audits, and automated recurring schedules
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingSchedule(null);
              setScheduleModalOpen(true);
            }}
            className="btn btn-primary btn-sm font-bold text-xs rounded-md"
          >
            <CalendarClock className="w-4 h-4" />
            New Schedule
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
        <StatCard
          title="Total Exports"
          value={totalExportsCount}
          subtitle="Lifetime files generated"
          icon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
          colorClass="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          title="Active Schedules"
          value={schedules.filter((s) => s.isActive).length}
          subtitle="Automated email delivery"
          icon={<CalendarClock className="w-4 h-4 text-sky-600" />}
          colorClass="bg-sky-50 text-sky-700"
        />
        <StatCard
          title="File Format"
          value="Excel (.xlsx)"
          subtitle="Formatted multi-sheet workbooks"
          icon={<Layers className="w-4 h-4 text-indigo-600" />}
          colorClass="bg-indigo-50 text-indigo-700"
        />
        <StatCard
          title="Automated Email"
          value="Resend Mailer"
          subtitle="With attached .xlsx files"
          icon={<Mail className="w-4 h-4 text-amber-600" />}
          colorClass="bg-amber-50 text-amber-700"
        />
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200">
        <div className="flex space-x-1 sm:space-x-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab("on-demand")}
            className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeTab === "on-demand"
                ? "border-emerald-600 text-emerald-800 bg-emerald-50/50 rounded-t-md"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Download className="w-4 h-4" />
            On-Demand Excel Exporter
          </button>

          <button
            onClick={() => setActiveTab("schedules")}
            className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeTab === "schedules"
                ? "border-emerald-600 text-emerald-800 bg-emerald-50/50 rounded-t-md"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <CalendarClock className="w-4 h-4" />
            Automated Schedules
            <span className="badge badge-xs bg-slate-100 text-slate-700 font-mono font-bold ml-1">
              {schedules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeTab === "history"
                ? "border-emerald-600 text-emerald-800 bg-emerald-50/50 rounded-t-md"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <History className="w-4 h-4" />
            Activity & Audit History
            <span className="badge badge-xs bg-slate-100 text-slate-700 font-mono font-bold ml-1">
              {historyPagination.total}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ON-DEMAND EXCEL EXPORTER */}
      {/* ========================================================================= */}
      {activeTab === "on-demand" && (
        <form onSubmit={handleGenerateOnDemand} className="space-y-4">
          {/* Step 1: Select Report Format */}
          <div className="surface-card p-4 sm:p-5 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                  1
                </span>
                <h3 className="font-bold text-sm text-slate-900">Select Report Type</h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                Structured & formatted Microsoft Excel (.xlsx) output
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {reportTypeCards.map((c) => {
                const Icon = c.icon;
                const isSelected = selectedReportType === c.type;
                return (
                  <div
                    key={c.type}
                    onClick={() => setSelectedReportType(c.type)}
                    className={`p-3.5 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50/60 shadow-xs"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div
                          className={`w-7 h-7 rounded-md flex items-center justify-center ${
                            isSelected
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span
                          className={`badge badge-xs font-bold uppercase rounded ${
                            isSelected
                              ? "bg-emerald-700 text-white"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {c.badge}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                        {c.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {c.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className={`font-semibold ${isSelected ? "text-emerald-700" : "text-slate-400"}`}>
                        {isSelected ? "● Selected" : "Click to select"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Date Range & Presets */}
          <div className="surface-card p-4 sm:p-5 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <h3 className="font-bold text-sm text-slate-900">Select Date Range & Filter Presets</h3>
              </div>
            </div>

            {/* Presets Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {presetsList.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={`btn btn-xs rounded font-bold text-xs transition-all ${
                    preset === p.id
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                      : "btn-outline border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Dates Inputs */}
            {preset === "custom" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 p-3 bg-slate-50 rounded-md border border-slate-200">
                <div>
                  <label className="label text-xs font-bold text-slate-700 py-0.5">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input input-bordered input-sm w-full bg-white font-medium text-xs rounded-md"
                    required={preset === "custom"}
                  />
                </div>
                <div>
                  <label className="label text-xs font-bold text-slate-700 py-0.5">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input input-bordered input-sm w-full bg-white font-medium text-xs rounded-md"
                    required={preset === "custom"}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Optional Granular Filters */}
          <div className="surface-card p-4 sm:p-5 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <h3 className="font-bold text-sm text-slate-900">Optional Filters</h3>
              </div>
              <span className="text-xs text-slate-400">Filter specific subsets of data</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div>
                <label className="label text-xs font-bold text-slate-700 py-0.5">Reservation Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="select select-bordered select-sm w-full text-xs font-medium rounded-md"
                >
                  <option value="all">All Reservation Statuses</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked_in">Checked In</option>
                  <option value="checked_out">Checked Out</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="label text-xs font-bold text-slate-700 py-0.5">Payment Method</label>
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="select select-bordered select-sm w-full text-xs font-medium rounded-md"
                >
                  <option value="all">All Payment Methods</option>
                  <option value="credit_card">Credit Card / Terminal POS</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={isGenerating}
              className="btn btn-primary btn-md w-full sm:w-auto min-w-[240px] font-bold text-sm rounded-md shadow-xs"
            >
              {isGenerating ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Generating Excel Workbook...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Generate & Download Excel (.xlsx)
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: AUTOMATED RECURRING SCHEDULES */}
      {/* ========================================================================= */}
      {activeTab === "schedules" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Configured Recurring Schedules</h3>
              <p className="text-xs text-slate-500">
                CampFlow automatically compiles and emails formatted Excel reports on the designated schedule.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingSchedule(null);
                setScheduleModalOpen(true);
              }}
              className="btn btn-primary btn-sm font-bold text-xs rounded-md"
            >
              <CalendarClock className="w-4 h-4" />
              Add Schedule
            </button>
          </div>

          <div className="surface-card rounded-lg overflow-hidden border border-slate-200">
            {loadingSchedules ? (
              <div className="py-16 text-center text-xs text-slate-500 space-y-2">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600" />
                <p>Loading schedules...</p>
              </div>
            ) : schedules.length === 0 ? (
              <div className="py-16 text-center space-y-2.5">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-slate-900">No automated schedules configured</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Set up recurring daily, weekly, or monthly Excel exports with direct email delivery to park owners and CPAs.
                </p>
                <button
                  onClick={() => {
                    setEditingSchedule(null);
                    setScheduleModalOpen(true);
                  }}
                  className="btn btn-primary btn-sm font-bold text-xs rounded-md mt-1"
                >
                  Create Your First Schedule
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="table table-sm min-w-[800px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th>Schedule Name</th>
                      <th>Report Type</th>
                      <th>Frequency & Time</th>
                      <th>Recipients</th>
                      <th>Status</th>
                      <th>Next Run</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((s) => (
                      <tr key={s._id} className="hover:bg-slate-50 border-b border-slate-100 transition-colors">
                        <td>
                          <div className="font-bold text-xs text-slate-900">{s.name}</div>
                          {s.lastRunAt && (
                            <div className="text-[10px] text-slate-400">
                              Last run: {formatDateTime(s.lastRunAt)}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-sm font-medium bg-slate-100 text-slate-700 border-slate-200 text-[11px]">
                            {reportTypeCards.find((r) => r.type === s.type)?.badge || s.type}
                          </span>
                        </td>
                        <td>
                          <div className="font-bold text-xs capitalize text-emerald-800 font-mono">
                            {s.frequency} @ {s.time}
                          </div>
                          {s.frequency === "weekly" && (
                            <div className="text-[10px] text-slate-500">
                              {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][s.dayOfWeek || 1]}
                            </div>
                          )}
                          {s.frequency === "monthly" && (
                            <div className="text-[10px] text-slate-500">
                              Day {s.dayOfMonth || 1} of month
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {s.recipients?.map((email: string) => (
                              <span key={email} className="badge badge-xs bg-slate-100 text-slate-600 text-[10px]">
                                {email}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <button
                            onClick={() => handleToggleSchedule(s)}
                            className={`badge badge-xs font-bold uppercase cursor-pointer ${
                              s.isActive
                                ? "badge-success text-white"
                                : "badge-ghost text-slate-400 border-slate-300"
                            }`}
                          >
                            {s.isActive ? "Active" : "Paused"}
                          </button>
                        </td>
                        <td className="font-mono text-xs text-slate-600">
                          {s.nextRunAt ? formatDateTime(s.nextRunAt) : "—"}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleRunScheduleNow(s._id, s.name)}
                              disabled={runningScheduleId === s._id}
                              className="btn btn-ghost btn-xs text-emerald-700 hover:bg-emerald-50 rounded"
                              title="Run Now & Email Report"
                            >
                              {runningScheduleId === s._id ? (
                                <span className="loading loading-spinner loading-xs text-emerald-600" />
                              ) : (
                                <>
                                  <Play className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Run Now</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setEditingSchedule(s);
                                setScheduleModalOpen(true);
                              }}
                              className="btn btn-ghost btn-xs text-slate-500 hover:text-slate-900 rounded"
                              title="Edit Schedule"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSchedule(s._id, s.name)}
                              className="btn btn-ghost btn-xs text-rose-500 hover:bg-rose-50 rounded"
                              title="Delete Schedule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: EXPORT ACTIVITY & AUDIT HISTORY */}
      {/* ========================================================================= */}
      {activeTab === "history" && (
        <div className="space-y-3">
          {/* History Filters */}
          <div className="surface-card p-3.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={historyTypeFilter}
                onChange={(e) => setHistoryTypeFilter(e.target.value)}
                className="select select-bordered select-xs text-xs rounded"
              >
                <option value="all">All Report Types</option>
                <option value="excel_master_accounting">Master Accounting</option>
                <option value="excel_bookings">Bookings & Occupancy</option>
                <option value="excel_transactions">Payment Ledger</option>
                <option value="excel_invoices">Invoices & Tax Audit</option>
                <option value="excel_customers">Guest CRM Roster</option>
              </select>

              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="select select-bordered select-xs text-xs rounded"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <button
              onClick={() => fetchHistory(historyPagination.page)}
              className="btn btn-ghost btn-xs text-slate-600 hover:text-slate-900 rounded"
              title="Refresh History"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin text-emerald-600" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* History Table */}
          <div className="surface-card rounded-lg overflow-hidden border border-slate-200">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="table table-sm min-w-[780px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th>Date & Time</th>
                    <th>File Name</th>
                    <th>Report Type</th>
                    <th>Source</th>
                    <th>Records</th>
                    <th>Size</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingHistory ? (
                    <tr>
                      <td colSpan={8} className="text-center py-14 text-xs text-slate-500 space-y-2">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-1" />
                        <p>Loading export audit logs...</p>
                      </td>
                    </tr>
                  ) : historyJobs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-14 space-y-2">
                        <div className="w-10 h-10 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                          <Inbox className="w-5 h-5" />
                        </div>
                        <p className="text-sm font-semibold text-slate-700">No export jobs recorded</p>
                        <p className="text-xs text-slate-500">Generated on-demand files or scheduled reports will appear here.</p>
                      </td>
                    </tr>
                  ) : (
                    historyJobs.map((job) => (
                      <tr key={job._id} className="hover:bg-slate-50 border-b border-slate-100 transition-colors">
                        <td className="text-xs text-slate-600 font-medium">
                          {formatDateTime(job.createdAt)}
                        </td>
                        <td>
                          <div className="font-mono text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            {job.fileName}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-sm font-medium bg-slate-100 text-slate-700 border-slate-200 text-[10px]">
                            {reportTypeCards.find((r) => r.type === job.type)?.badge || job.type}
                          </span>
                        </td>
                        <td>
                          {job.isScheduled ? (
                            <span className="badge badge-info badge-xs text-white font-bold rounded">
                              Scheduled
                            </span>
                          ) : (
                            <span className="badge badge-ghost badge-xs font-bold text-slate-600 rounded">
                              On-Demand
                            </span>
                          )}
                        </td>
                        <td className="font-mono text-xs text-slate-700 font-semibold">
                          {job.recordsCount}
                        </td>
                        <td className="font-mono text-xs text-slate-500">
                          {job.fileSizeBytes ? `${(job.fileSizeBytes / 1024).toFixed(1)} KB` : "—"}
                        </td>
                        <td>
                          {job.status === "completed" ? (
                            <span className="badge badge-success badge-xs text-white font-bold rounded">
                              Completed
                            </span>
                          ) : (
                            <span className="badge badge-error badge-xs text-white font-bold rounded">
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          <a
                            href={`/api/exports/download/${job._id}`}
                            download={job.fileName}
                            className="btn btn-outline btn-xs font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 rounded"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {historyPagination.totalPages > 1 && (
              <div className="p-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50">
                <div>
                  Showing <span className="font-bold">{historyJobs.length}</span> of{" "}
                  <span className="font-bold">{historyPagination.total}</span> export records
                </div>
                <div className="join">
                  <button
                    disabled={historyPagination.page <= 1}
                    onClick={() => fetchHistory(historyPagination.page - 1)}
                    className="btn btn-outline btn-xs join-item rounded-l-md"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button className="btn btn-outline btn-xs join-item font-mono font-bold">
                    Page {historyPagination.page} / {historyPagination.totalPages}
                  </button>
                  <button
                    disabled={historyPagination.page >= historyPagination.totalPages}
                    onClick={() => fetchHistory(historyPagination.page + 1)}
                    className="btn btn-outline btn-xs join-item rounded-r-md"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      <ScheduleExportModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        onSuccess={() => {
          fetchSchedules();
          fetchHistory(1);
        }}
        initialData={editingSchedule}
      />
    </div>
  );
}
