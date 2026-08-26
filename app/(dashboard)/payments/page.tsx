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
          <h1 className="text-2xl font-bold tracking-tight text-base-content">
            Payment Transactions & Ledger
          </h1>
          <p className="text-xs text-base-content/60 mt-0.5">
            Audit trail of credit card, cash, and online payments collected
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchPayments(pagination.page)}
            className="btn btn-ghost btn-sm btn-circle"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card bg-base-100 border border-base-200 p-4">
          <div className="text-xs font-semibold text-base-content/60 uppercase">Page Total Collected</div>
          <div className="text-2xl font-bold text-emerald-600 font-mono mt-1">
            {formatCurrency(totalCollected)}
          </div>
        </div>
        <div className="card bg-base-100 border border-base-200 p-4">
          <div className="text-xs font-semibold text-base-content/60 uppercase">Total Transactions</div>
          <div className="text-2xl font-bold text-base-content font-mono mt-1">
            {pagination.total}
          </div>
        </div>
        <div className="card bg-base-100 border border-base-200 p-4">
          <div className="text-xs font-semibold text-base-content/60 uppercase">Average Payment</div>
          <div className="text-2xl font-bold text-sky-600 font-mono mt-1">
            {payments.length > 0 ? formatCurrency(totalCollected / payments.length) : "$0.00"}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card bg-base-100 shadow-sm border border-base-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead className="bg-base-200/50">
              <tr>
                <th>Date & Time</th>
                <th>Confirmation</th>
                <th>Guest</th>
                <th>Method</th>
                <th>Transaction Ref</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-xs text-base-content/60">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading payment transactions...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm text-base-content/50">
                    No payment records found.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p._id} className="hover:bg-base-200/40">
                    <td className="text-xs">{formatDateTime(p.createdAt)}</td>
                    <td className="font-mono font-bold text-xs text-primary">
                      {p.reservationId?.confirmationCode || "—"}
                    </td>
                    <td>
                      <div className="font-bold text-sm text-base-content">
                        {p.guestId ? `${p.guestId.firstName} ${p.guestId.lastName}` : "Guest"}
                      </div>
                      {p.guestId?.email && (
                        <div className="text-[11px] text-base-content/60">{p.guestId.email}</div>
                      )}
                    </td>
                    <td className="text-xs capitalize">{p.method?.replace("_", " ")}</td>
                    <td className="font-mono text-[11px] text-base-content/60">
                      {p.transactionReference || "—"}
                    </td>
                    <td>
                      <PaymentStatusBadge status={p.status} />
                    </td>
                    <td className="text-right font-bold text-sm text-emerald-600 font-mono">
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
          <div className="p-4 border-t border-base-200 flex items-center justify-between text-xs text-base-content/70">
            <div>Showing {payments.length} of {pagination.total} records</div>
            <div className="join">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchPayments(pagination.page - 1)}
                className="btn btn-outline btn-xs join-item"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button className="btn btn-outline btn-xs join-item font-mono font-bold">
                Page {pagination.page} / {pagination.totalPages}
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchPayments(pagination.page + 1)}
                className="btn btn-outline btn-xs join-item"
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
