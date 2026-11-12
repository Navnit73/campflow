"use client";

import React, { useState } from "react";
import apiClient from "@/lib/axios/client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Loader2 } from "lucide-react";

export interface PickerItem {
  key: string;
  name: string;
  description: string;
  meta: string;
}

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
  title: string;
  subtitle: string;
  items: PickerItem[];
  /** Label for the owner-entered amount, e.g. "Nightly rate" or "Price". */
  priceLabel: string;
  endpoint: string;
  /** Names that already exist — shown as added and not selectable. */
  existingNames?: string[];
}

/**
 * Lets the owner pick starter items and enter their OWN price for each one.
 * Nothing is pre-priced: a selected item can't be saved until its price is filled in.
 */
export function TemplatePickerModal({
  isOpen,
  onClose,
  onDone,
  title,
  subtitle,
  items,
  priceLabel,
  endpoint,
  existingNames = [],
}: TemplatePickerModalProps) {
  const { success, error } = useToast();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const existing = new Set(existingNames.map((n) => n.toLowerCase()));

  const close = () => {
    setSelected({});
    setPrices({});
    onClose();
  };

  const chosen = items.filter((i) => selected[i.key]);
  const missingPrice = chosen.filter((i) => (prices[i.key] ?? "").trim() === "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chosen.length === 0 || missingPrice.length > 0) return;
    setSaving(true);
    try {
      const res = await apiClient.post(endpoint, {
        items: chosen.map((i) => ({ key: i.key, price: Number(prices[i.key]) })),
      });
      success(res.data?.message || "Added");
      onDone();
      close();
    } catch (err: unknown) {
      error((err as Error)?.message || "Could not add the selected items");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title={title} subtitle={subtitle} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-slate-600">
          Tick what your park offers and enter <strong>your own {priceLabel.toLowerCase()}</strong> for each. Nothing is
          added with a made-up price, and you can edit everything afterwards.
        </p>
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-md max-h-[55vh] overflow-y-auto">
          {items.map((item) => {
            const already = existing.has(item.name.toLowerCase());
            const isOn = Boolean(selected[item.key]);
            return (
              <li key={item.key} className={`p-3 flex items-start gap-3 ${already ? "opacity-60" : ""}`}>
                <input
                  type="checkbox"
                  aria-label={`Add ${item.name}`}
                  className="checkbox checkbox-sm checkbox-primary mt-0.5"
                  disabled={already}
                  checked={isOn}
                  onChange={(e) => setSelected((s) => ({ ...s, [item.key]: e.target.checked }))}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-900">
                    {item.name} {already && <span className="text-[11px] font-normal text-slate-500">(already added)</span>}
                  </div>
                  <div className="text-xs text-slate-500">{item.description}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{item.meta}</div>
                </div>
                <label className="w-32 shrink-0">
                  <span className="sr-only">
                    {priceLabel} for {item.name}
                  </span>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      placeholder={priceLabel}
                      aria-label={`${priceLabel} for ${item.name}`}
                      disabled={!isOn || already}
                      required={isOn}
                      value={prices[item.key] ?? ""}
                      onChange={(e) => setPrices((p) => ({ ...p, [item.key]: e.target.value }))}
                      className="input input-bordered input-sm w-full pl-5 font-mono rounded-md"
                    />
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            {chosen.length === 0
              ? "Nothing selected"
              : missingPrice.length > 0
              ? `Enter a ${priceLabel.toLowerCase()} for ${missingPrice.length} selected item${missingPrice.length === 1 ? "" : "s"}`
              : `${chosen.length} selected`}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={close} className="btn btn-ghost btn-sm rounded-md">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || chosen.length === 0 || missingPrice.length > 0}
              className="btn btn-primary btn-sm font-bold rounded-md min-w-[140px]"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : `Add ${chosen.length || ""} selected`}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
