"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { PaymentStatusBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import {
  CreditCard,
  RefreshCw,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Inbox,
  TrendingUp,
  Hash,
  Search,
  RotateCcw,
} from "lucide-react";

export default function PaymentsPage() {
  const { error } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [methodFilter, setMethodFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchPayments = async (page = 1) => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/payments", {
        params: {
          page,
          limit: 20,
          method: methodFilter !== "all" ? methodFilter : undefined,
          search: searchTerm || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      });
      if (res.data?.success) {
        setPayments(res.data.data.payments);
        setPagination(res.data.data.pagination);
      }
    } catch (err: any) {
      error(err?.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments(1);
  }, [methodFilter, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPayments(1);
  };

  // Metrics
  const totalPayments = payments
    .filter((p) => p.type !== "refund" && p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalRefunds = payments
    .filter((p) => p.type === "refund" && p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  const netCollected = totalPayments - totalRefunds;

  const methodOptions = [
    { label: "All Methods", value: "all" },
    { label: "Cash", value: "cash" },
    { label: "Check", value: "check" },
    { label: "Bank Transfer", value: "bank_transfer" },
    { label: "Card (POS / Terminal)", value: "credit_card" },
    { label: "Other / Voucher", value: "other" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Payment Transactions & Ledger
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Offline manual transactions audit trail: cash, check, terminal card readers, and refunds
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchPayments(pagination.page)}
            className="btn btn-ghost btn-sm btn-circle text-slate-600 hover:text-slate-900 rounded-md"
            title="Refresh Ledger"
            aria-label="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Summary Banner Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="surface-card p-3.5 rounded-lg space-y-1 border border-slate-200">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Net Collected</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            {formatCurrency(netCollected)}
          </div>
        </div>

        <div className="surface-card p-3.5 rounded-lg space-y-1 border border-slate-200">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Gross Payments</span>
            <TrendingUp className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-sky-700 font-mono">
            +{formatCurrency(totalPayments)}
          </div>
        </div>

        <div className="surface-card p-3.5 rounded-lg space-y-1 border border-slate-200">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Manual Refunds</span>
            <RotateCcw className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700 font-mono">
            -{formatCurrency(totalRefunds)}
          </div>
        </div>

        <div className="surface-card p-3.5 rounded-lg space-y-1 border border-slate-200">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Total Records</span>
            <Hash className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {pagination.total}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="surface-card p-3.5 rounded-lg border border-slate-200 space-y-2.5">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2.5">
          <div className="flex-1 min-w-[220px] relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search reference # or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-bordered input-sm w-full pl-9 bg-white text-xs rounded-md"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input input-bordered input-sm bg-white font-medium text-xs rounded-md"
              title="Start Date"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input input-bordered input-sm bg-white font-medium text-xs rounded-md"
              title="End Date"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-sm font-bold text-xs rounded-md">
            Filter
          </button>

          {(searchTerm || startDate || endDate || methodFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setStartDate("");
                setEndDate("");
                setMethodFilter("all");
                fetchPayments(1);
              }}
              className="btn btn-ghost btn-sm text-xs font-semibold rounded-md"
            >
              Clear
            </button>
          )}
        </form>

        {/* Method Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-500 mr-1">Method:</span>
          {methodOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMethodFilter(opt.value)}
              className={`btn btn-xs rounded font-bold ${
                methodFilter === opt.value
                  ? "bg-emerald-600 text-white"
                  : "btn-ghost text-slate-600 hover:bg-slate-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="surface-card rounded-lg overflow-hidden border border-slate-200">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="table table-sm min-w-[780px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="min-w-[140px]">Date & Time</th>
                <th className="min-w-[110px]">Confirmation</th>
                <th className="min-w-[180px]">Guest / Folio</th>
                <th className="min-w-[100px]">Type</th>
                <th className="min-w-[130px]">Method</th>
                <th className="min-w-[140px]">Transaction Ref</th>
                <th className="min-w-[100px]">Status</th>
                <th className="text-right min-w-[110px]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-xs text-slate-500 space-y-2">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-1" />
                    <p>Loading payment transactions...</p>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-14 space-y-2">
                    <div className="w-10 h-10 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Inbox className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No payment records found</p>
                    <p className="text-xs text-slate-500">Offline payments or refunds will appear in this ledger.</p>
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const isRefund = p.type === "refund";
                  return (
                    <tr key={p._id} className="hover:bg-slate-50 border-b border-slate-100 transition-colors">
                      <td className="text-xs text-slate-600 font-medium">{formatDateTime(p.createdAt)}</td>
                      <td className="font-mono font-bold text-xs text-emerald-700">
                        {p.reservationId?.confirmationCode || "—"}
                      </td>
                      <td>
                        <div className="font-bold text-sm text-slate-900">
                          {p.guestId ? `${p.guestId.firstName} ${p.guestId.lastName}` : "Guest"}
                        </div>
                        {p.guestId?.email && (
                          <div className="text-[11px] text-slate-500 truncate">{p.guestId.email}</div>
                        )}
                      </td>
                      <td>
                        {isRefund ? (
                          <span className="badge badge-error badge-xs text-white font-bold rounded">Refund</span>
                        ) : (
                          <span className="badge badge-success badge-xs text-white font-bold rounded">Payment</span>
                        )}
                      </td>
                      <td className="text-xs capitalize font-medium text-slate-700">
                        {p.method?.replace("_", " ")}
                      </td>
                      <td className="font-mono text-[11px] text-slate-500">
                        {p.transactionReference || "—"}
                      </td>
                      <td>
                        <PaymentStatusBadge status={p.status} />
                      </td>
                      <td className={`text-right font-black text-xs font-mono ${
                        isRefund ? "text-rose-700" : "text-emerald-700"
                      }`}>
                        {isRefund ? `-${formatCurrency(p.amount)}` : `+${formatCurrency(p.amount)}`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50">
            <div>Showing <span className="font-bold">{payments.length}</span> of <span className="font-bold">{pagination.total}</span> records</div>
            <div className="join">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchPayments(pagination.page - 1)}
                className="btn btn-outline btn-xs join-item rounded-l-md"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button className="btn btn-outline btn-xs join-item font-mono font-bold">
                Page {pagination.page} / {pagination.totalPages}
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchPayments(pagination.page + 1)}
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
  );
}

