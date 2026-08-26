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
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<string>("credit_card");
  const [transactionReference, setTransactionReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (reservation) {
      setAmount(reservation.pricing?.balanceDue || reservation.pricing?.totalAmount || 0);
      setTransactionReference("");
      setNotes("");
    }
  }, [reservation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservation) return;
    if (amount <= 0) {
      error("Payment amount must be greater than zero");
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post("/api/payments", {
        reservationId: reservation._id,
        amount: Number(amount),
        method,
        status: "completed",
        transactionReference,
        notes,
      });

      if (res.data?.success) {
        success(`Payment of ${formatCurrency(amount)} recorded successfully!`);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      error(err?.message || "Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !reservation) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Record Payment (${reservation.confirmationCode})`}
      subtitle={`Guest: ${reservation.guestSnapshot?.fullName || "Guest"}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 rounded-xl bg-base-200/60 flex items-center justify-between text-sm">
          <span className="text-base-content/70">Current Balance Due:</span>
          <span className="font-bold text-base text-error">
            {formatCurrency(reservation.pricing?.balanceDue)}
          </span>
        </div>

        <div>
          <label className="label text-xs font-semibold py-1">Payment Amount ($)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/60 font-bold">$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="10000"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="input input-bordered input-sm w-full pl-8 font-bold font-mono"
              required
            />
          </div>
        </div>

        <div>
          <label className="label text-xs font-semibold py-1">Payment Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="select select-bordered select-sm w-full font-medium"
          >
            <option value="credit_card">Credit Card (Terminal / POS)</option>
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="bank_transfer">Bank Transfer / ACH</option>
            <option value="online">Online Payment</option>
          </select>
        </div>

        <div>
          <label className="label text-xs font-semibold py-1">Transaction Ref / Check # (optional)</label>
          <input
            type="text"
            placeholder="e.g. AUTH-9284 / Check #1042"
            value={transactionReference}
            onChange={(e) => setTransactionReference(e.target.value)}
            className="input input-bordered input-sm w-full"
          />
        </div>

        <div>
          <label className="label text-xs font-semibold py-1">Notes</label>
          <input
            type="text"
            placeholder="e.g. Deposit collected at desk"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input input-bordered input-sm w-full"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary btn-sm min-w-[130px] shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Record Payment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
