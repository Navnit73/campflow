"use client";

import { useAuth } from "@/hooks/useAuth";
import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils/format";
import {
  Flame,
  Truck,
  Zap,
  Wifi,
  Sparkles,
  Package,
  Clock,
  Coffee,
  Shield,
  MapPin,
  HelpCircle,
  Loader2,
  DollarSign,
  Layers,
} from "lucide-react";
import { ADDON_CATEGORIES, ADDON_PRICING_TYPES } from "@/lib/validations/addon.schema";

interface AddOnModalProps {
  isOpen: boolean;
  addOn: any | null; // null for create, object for edit
  onClose: () => void;
  onSuccess: () => void;
}

const AVAILABLE_ICONS = [
  { id: "sparkles", label: "Sparkles", icon: Sparkles },
  { id: "flame", label: "Fire / Wood", icon: Flame },
  { id: "truck", label: "Vehicle / Cart", icon: Truck },
  { id: "zap", label: "Energy / Propane", icon: Zap },
  { id: "wifi", label: "Internet", icon: Wifi },
  { id: "package", label: "Package", icon: Package },
  { id: "clock", label: "Time / Late", icon: Clock },
  { id: "coffee", label: "Food / Drink", icon: Coffee },
  { id: "shield", label: "Insurance / Safety", icon: Shield },
  { id: "map", label: "Tour / Map", icon: MapPin },
];

export function AddOnModal({ isOpen, addOn, onClose, onSuccess }: AddOnModalProps) {
  const { success, error } = useToast();
  const { property: authProperty } = useAuth();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("convenience");
  const [pricingType, setPricingType] = useState<string>("per_stay");
  const [price, setPrice] = useState<number | string>("");
  const [taxable, setTaxable] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [icon, setIcon] = useState("sparkles");

  useEffect(() => {
    if (addOn) {
      setName(addOn.name || "");
      setDescription(addOn.description || "");
      setCategory(addOn.category || "convenience");
      setPricingType(addOn.pricingType || "per_stay");
      setPrice(addOn.price ?? "");
      setTaxable(addOn.taxable ?? true);
      setIsActive(addOn.isActive ?? true);
      setIcon(addOn.icon || "sparkles");
    } else {
      setName("");
      setDescription("");
      setCategory("convenience");
      setPricingType("per_stay");
      setPrice("");
      setTaxable(true);
      setIsActive(true);
      setIcon("sparkles");
    }
  }, [addOn, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        name,
        description,
        category,
        pricingType,
        price: Number(price),
        taxable,
        isActive,
        icon,
      };

      if (addOn) {
        const res = await apiClient.patch(`/api/addons/${addOn._id}`, payload);
        if (res.data?.success) {
          success(`Service "${name}" updated successfully!`);
          onSuccess();
          onClose();
        }
      } else {
        const res = await apiClient.post("/api/addons", payload);
        if (res.data?.success) {
          success(`Service "${name}" created successfully!`);
          onSuccess();
          onClose();
        }
      }
    } catch (err: any) {
      error(err?.message || "Failed to save add-on service");
    } finally {
      setLoading(false);
    }
  };

  const getPricingLabel = (type: string) => {
    switch (type) {
      case "per_night":
        return "/ night of stay";
      case "per_unit":
        return "/ item or unit";
      case "per_person":
        return "/ person";
      case "per_stay":
      default:
        return "flat fee per stay";
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={addOn ? `Edit Service: ${addOn.name}` : "Create New Add-On Service"}
      subtitle="Define catalog item, billing rate rules, and amenity category"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Details */}
        <div className="space-y-3 p-3.5 sm:p-4 rounded-lg bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-200/60">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            1. Service Information
          </div>

          <div className="space-y-3">
            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">
                Service / Item Name
              </label>
              <input
                type="text"
                placeholder="e.g. Firewood Bundle, Golf Cart Rental, Late Check-Out"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input input-bordered input-sm w-full bg-white rounded-md font-medium text-xs sm:text-sm"
                required
              />
            </div>

            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">
                Description / Notes for Camper
              </label>
              <textarea
                placeholder="Brief description of what's included with this service..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="textarea textarea-bordered textarea-sm w-full bg-white rounded-md text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs font-bold text-slate-700 py-0.5">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="select select-bordered select-sm w-full bg-white rounded-md text-xs capitalize"
                >
                  {ADDON_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Icon Picker */}
              <div>
                <label className="label text-xs font-bold text-slate-700 py-0.5">Visual Icon</label>
                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                  {AVAILABLE_ICONS.map((ic) => {
                    const IconComp = ic.icon;
                    const isSelected = icon === ic.id;
                    return (
                      <button
                        key={ic.id}
                        type="button"
                        onClick={() => setIcon(ic.id)}
                        className={`p-1.5 rounded-md border transition-all shrink-0 ${
                          isSelected
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                        title={ic.label}
                      >
                        <IconComp className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing & Billing Rules */}
        <div className="space-y-3 p-3.5 sm:p-4 rounded-lg bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-200/60">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            2. Rate & Billing Type
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">Pricing Model</label>
              <select
                value={pricingType}
                onChange={(e) => setPricingType(e.target.value)}
                className="select select-bordered select-sm w-full bg-white rounded-md text-xs font-medium"
              >
                <option value="per_stay">Per Stay (Flat One-Time Fee)</option>
                <option value="per_night">Per Night (Multiplied by Nights)</option>
                <option value="per_unit">Per Unit / Quantity</option>
                <option value="per_person">Per Person / Headcount</option>
              </select>
            </div>

            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">
                Service Rate ($ USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold text-xs">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  className="input input-bordered input-sm w-full pl-7 bg-white rounded-md font-mono font-bold text-emerald-700 text-xs sm:text-sm"
                  required
                />
              </div>
            </div>
          </div>

          {/* Pricing Preview Badge */}
          <div className="p-2.5 rounded-md bg-white border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Customer Billing Formula:</span>
            <span className="font-bold font-mono text-emerald-800">
              {formatCurrency(Number(price) || 0)} {getPricingLabel(pricingType)}
            </span>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200/60">
            <label className="cursor-pointer label justify-start gap-2.5 py-1">
              <input
                type="checkbox"
                checked={taxable}
                onChange={(e) => setTaxable(e.target.checked)}
                className="checkbox checkbox-primary checkbox-xs sm:checkbox-sm rounded"
              />
              <span className="label-text font-bold text-xs text-slate-800">
                Subject to Tax ({authProperty?.taxRatePercent ?? 0}%)
              </span>
            </label>

            <label className="cursor-pointer label justify-start gap-2.5 py-1">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="checkbox checkbox-success checkbox-xs sm:checkbox-sm rounded"
              />
              <span className="label-text font-bold text-xs text-slate-800">
                Available for Booking
              </span>
            </label>
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
            className="btn btn-primary btn-sm px-5 font-bold shadow-xs flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : addOn ? "Save Changes" : "Create Service"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
