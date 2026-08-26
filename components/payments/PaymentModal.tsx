"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils/format";
import { Loader2, DollarSign } from "lucide-react";

interface PaymentModalProps {
  reservation: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModal({ reservation, isOpen, onClose, onSuccess }: PaymentModalProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"payment" | "refund">("payment");
  const [amount, setAmount] = useState<number | string>(0);
  const [method, setMethod] = useState<string>("cash");
  const [transactionReference, setTransactionReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (reservation) {
      setMode("payment");
      setAmount(reservation.pricing?.balanceDue || reservation.pricing?.totalAmount || 0);
      setMethod("cash");
      setTransactionReference("");
      setNotes("");
    }
  }, [reservation, isOpen]);

  const handleModeChange = (newMode: "payment" | "refund") => {
    setMode(newMode);
    if (newMode === "payment") {
      setAmount(reservation?.pricing?.balanceDue || 0);
    } else {
      setAmount(reservation?.pricing?.paidAmount || 0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservation) return;
    const numericAmount = Number(amount || 0);
    if (numericAmount <= 0) {
      error(`${mode === "refund" ? "Refund" : "Payment"} amount must be greater than zero`);
      return;
    }

    if (mode === "refund" && numericAmount > (reservation.pricing?.paidAmount || 0)) {
      error(`Refund amount cannot exceed total paid amount of ${formatCurrency(reservation.pricing?.paidAmount || 0)}`);
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post("/api/payments", {
        reservationId: reservation._id,
        amount: Number(amount),
        type: mode,
        method,
        status: "completed",
        transactionReference,
        notes: notes || (mode === "refund" ? "Manual refund processed" : "Manual payment recorded"),
      });

      if (res.data?.success) {
        success(
          mode === "refund"
            ? `Refund of ${formatCurrency(numericAmount)} recorded successfully!`
            : `Payment of ${formatCurrency(numericAmount)} recorded successfully!`
        );
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      error(err?.message || "Failed to record transaction");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !reservation) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "refund" ? `Record Refund (${reservation.confirmationCode})` : `Record Payment (${reservation.confirmationCode})`}
      subtitle={`Guest: ${reservation.guestSnapshot?.fullName || "Guest"} • Site ${reservation.siteSnapshot?.siteNumber}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Mode Selector */}
        <div className="join w-full grid grid-cols-2">
          <button
            type="button"
            onClick={() => handleModeChange("payment")}
            className={`btn btn-sm join-item font-bold ${
              mode === "payment" ? "bg-emerald-600 text-white" : "btn-outline text-slate-700"
            }`}
          >
            Record Payment
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("refund")}
            className={`btn btn-sm join-item font-bold ${
              mode === "refund" ? "bg-rose-600 text-white" : "btn-outline text-slate-700"
            }`}
          >
            Record Refund
          </button>
        </div>

        {/* Balance & Paid Indicator */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-500 font-semibold">Total Bill: </span>
            <span className="font-bold text-slate-800 font-mono">
              {formatCurrency(reservation.pricing?.totalAmount)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold">Total Paid: </span>
            <span className="font-bold text-emerald-700 font-mono">
              {formatCurrency(reservation.pricing?.paidAmount)}
            </span>
          </div>
          <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
            <span className="text-slate-600 font-bold">Outstanding Balance:</span>
            <span
              className={`font-black text-sm font-mono ${
                reservation.pricing?.balanceDue > 0 ? "text-rose-700" : "text-emerald-700"
              }`}
            >
              {formatCurrency(reservation.pricing?.balanceDue)}
            </span>
          </div>
        </div>

        <div>
          <label className="label text-xs font-bold text-slate-700 py-0.5">
            {mode === "refund" ? "Refund Amount ($)" : "Payment Amount ($)"}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="10000"
              value={amount}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              className={`input input-bordered input-sm w-full pl-7 font-bold font-mono text-sm rounded-md ${
                mode === "refund" ? "text-rose-700" : "text-emerald-700"
              }`}
              required
            />
          </div>
        </div>

        <div>
          <label className="label text-xs font-bold text-slate-700 py-0.5">Payment Method (Offline / Manual)</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="select select-bordered select-sm w-full font-medium bg-white rounded-md text-xs sm:text-sm"
          >
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="bank_transfer">Bank Transfer / ACH</option>
            <option value="credit_card">Card (POS Terminal / Physical Reader)</option>
            <option value="other">Other / Voucher</option>
          </select>
        </div>

        <div>
          <label className="label text-xs font-bold text-slate-700 py-0.5">
            Transaction Ref / Check # (optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Check #1042 / Auth code 8492"
            value={transactionReference}
            onChange={(e) => setTransactionReference(e.target.value)}
            className="input input-bordered input-sm w-full font-mono text-xs rounded-md"
          />
        </div>

        <div>
          <label className="label text-xs font-bold text-slate-700 py-0.5">
            {mode === "refund" ? "Refund Reason" : "Transaction Notes"}
          </label>
          <input
            type="text"
            placeholder={mode === "refund" ? "e.g. Early checkout / weather refund" : "e.g. Collected at front desk"}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input input-bordered input-sm w-full rounded-md text-xs sm:text-sm"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm font-semibold rounded-md">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`btn btn-sm min-w-[140px] font-bold rounded-md ${
              mode === "refund" ? "btn-error text-white" : "btn-primary"
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === "refund" ? (
              "Record Refund"
            ) : (
              "Record Payment"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
