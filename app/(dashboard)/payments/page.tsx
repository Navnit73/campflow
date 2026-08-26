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
} from "lucide-react";

export default function PaymentsPage() {
  const { error } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const fetchPayments = async (page = 1) => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/payments", {
        params: { page, limit: 20 },
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
  }, []);

  const totalCollected = payments.reduce((sum, p) => sum + (p.status === "completed" ? p.amount : 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Payment Transactions & Ledger
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Audit trail of credit card, cash, and online payments collected
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="surface-card p-3.5 rounded-lg space-y-1 border border-slate-200">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Page Total Collected</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            {formatCurrency(totalCollected)}
          </div>
        </div>

        <div className="surface-card p-3.5 rounded-lg space-y-1 border border-slate-200">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Total Transactions</span>
            <Hash className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {pagination.total}
          </div>
        </div>

        <div className="surface-card p-3.5 rounded-lg space-y-1 border border-slate-200">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Average Payment</span>
            <TrendingUp className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-sky-700 font-mono">
            {payments.length > 0 ? formatCurrency(totalCollected / payments.length) : "$0.00"}
          </div>
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
                <th className="min-w-[180px]">Guest</th>
                <th className="min-w-[100px]">Method</th>
                <th className="min-w-[130px]">Transaction Ref</th>
                <th className="min-w-[100px]">Status</th>
                <th className="text-right min-w-[100px]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-14 text-xs text-slate-500 space-y-2">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-1" />
                    <p>Loading payment transactions...</p>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-14 space-y-2">
                    <div className="w-10 h-10 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Inbox className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No payment records found</p>
                    <p className="text-xs text-slate-500">Payments recorded at check-in or booking will appear here.</p>
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
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
                    <td className="text-xs capitalize font-medium text-slate-700">{p.method?.replace("_", " ")}</td>
                    <td className="font-mono text-[11px] text-slate-500">
                      {p.transactionReference || "—"}
                    </td>
                    <td>
                      <PaymentStatusBadge status={p.status} />
                    </td>
                    <td className="text-right font-black text-xs text-emerald-700 font-mono">
                      {formatCurrency(p.amount)}
                    </td>
                  </tr>
                ))
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
