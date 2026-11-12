"use client";
import { TemplatePickerModal } from "@/components/onboarding/TemplatePickerModal";
import { ADDON_TEMPLATES } from "@/lib/onboarding/templates";


import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils/format";
import {
  Sparkles,
  Plus,
  RefreshCw,
  Search,
  Flame,
  Truck,
  Zap,
  Wifi,
  Package,
  Clock,
  Coffee,
  Shield,
  MapPin,
  Edit2,
  Trash2,
  Layers,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Tag,
  DollarSign,
} from "lucide-react";
import { AddOnModal } from "@/components/services/AddOnModal";

const ICON_MAP: Record<string, any> = {
  sparkles: Sparkles,
  flame: Flame,
  truck: Truck,
  zap: Zap,
  wifi: Wifi,
  package: Package,
  clock: Clock,
  coffee: Coffee,
  shield: Shield,
  map: MapPin,
};

const PRICING_LABELS = { per_stay: "per stay", per_night: "per night", per_unit: "per item", per_person: "per person" } as const;

export default function ServicesPage() {
  const { success, error, info } = useToast();

  const [addOns, setAddOns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddOn, setEditingAddOn] = useState<any | null>(null);

  const fetchAddOns = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/addons", {
        params: {
          category: selectedCategory !== "all" ? selectedCategory : undefined,
          search: searchTerm || undefined,
        },
      });

      if (res.data?.success) {
        setAddOns(res.data.data);
      }
    } catch (err: any) {
      error(err?.message || "Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddOns();
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAddOns();
  };

  const handleToggleActive = async (addOn: any) => {
    try {
      const updatedStatus = !addOn.isActive;
      const res = await apiClient.patch(`/api/addons/${addOn._id}`, {
        isActive: updatedStatus,
      });

      if (res.data?.success) {
        setAddOns((prev) =>
          prev.map((item) =>
            item._id === addOn._id ? { ...item, isActive: updatedStatus } : item
          )
        );
        success(`"${addOn.name}" marked ${updatedStatus ? "Active" : "Inactive"}`);
      }
    } catch (err: any) {
      error(err?.message || "Failed to update status");
    }
  };

  const handleDelete = async (addOn: any) => {
    if (!confirm(`Are you sure you want to delete "${addOn.name}"?`)) {
      return;
    }

    try {
      const res = await apiClient.delete(`/api/addons/${addOn._id}`);
      if (res.data?.success) {
        setAddOns((prev) => prev.filter((item) => item._id !== addOn._id));
        success(`"${addOn.name}" deleted successfully.`);
      }
    } catch (err: any) {
      error(err?.message || "Failed to delete add-on");
    }
  };

  // Starter list: the owner picks items and enters their own prices (no example prices are saved).
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const handleSeedDefaults = () => setIsTemplatesOpen(true);

  // Metrics
  const totalCount = addOns.length;
  const activeCount = addOns.filter((a) => a.isActive).length;
  const avgRate =
    totalCount > 0
      ? addOns.reduce((sum, a) => sum + (a.price || 0), 0) / totalCount
      : 0;

  const categories = [
    { id: "all", label: "All Categories" },
    { id: "merchandise", label: "Merchandise" },
    { id: "equipment", label: "Equipment" },
    { id: "utility", label: "Utilities" },
    { id: "convenience", label: "Convenience" },
    { id: "activities", label: "Activities" },
    { id: "fees", label: "Fees & Passes" },
  ];

  const getPricingBadge = (type: string) => {
    switch (type) {
      case "per_night":
        return "Per Night";
      case "per_unit":
        return "Per Unit / Item";
      case "per_person":
        return "Per Person";
      case "per_stay":
      default:
        return "Per Stay (Flat)";
    }
  };

  return (
    <div className="space-y-5 max-w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-600" />
            Services & Add-Ons
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Configure campground merchandise, rental equipment, utility refills, and rate models
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!loading && (
            <button
              onClick={handleSeedDefaults}
              className="btn btn-outline btn-sm font-bold text-xs rounded-md bg-white hover:bg-slate-50"
            >
              Starter List
            </button>
          )}

          <button
            onClick={() => {
              setEditingAddOn(null);
              setIsModalOpen(true);
            }}
            className="btn btn-primary btn-sm gap-1.5 font-bold rounded-md shadow-xs"
          >
            <Plus className="w-4 h-4" />
            New Service / Add-On
          </button>

          <button
            onClick={fetchAddOns}
            className="btn btn-ghost btn-sm btn-circle text-slate-600 hover:text-slate-900 rounded-md"
            title="Refresh List"
            aria-label="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="surface-card p-3.5 sm:p-4 rounded-lg border border-slate-200">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Catalog
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
            {totalCount} Items
          </div>
        </div>

        <div className="surface-card p-3.5 sm:p-4 rounded-lg border border-slate-200">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Active for Booking
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-0.5">
            {activeCount} Active
          </div>
        </div>

        <div className="surface-card p-3.5 sm:p-4 rounded-lg border border-slate-200">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Average Rate
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-0.5">
            {formatCurrency(avgRate)}
          </div>
        </div>

        <div className="surface-card p-3.5 sm:p-4 rounded-lg border border-slate-200">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Pricing Models
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
            4 Types
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="surface-card p-3 sm:p-3.5 rounded-lg border border-slate-200 space-y-3">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-2.5">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search services by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-bordered input-sm w-full pl-9 text-xs sm:text-sm bg-white rounded-md"
            />
          </div>

          {(searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                fetchAddOns();
              }}
              className="btn btn-ghost btn-sm text-xs font-semibold rounded-md"
            >
              Reset Search
            </button>
          )}
        </form>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="p-14 text-center text-slate-500 space-y-2 surface-card rounded-lg border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-1" />
          <p className="text-xs font-semibold">Loading add-on catalog...</p>
        </div>
      ) : addOns.length === 0 ? (
        <div className="p-12 text-center text-slate-500 space-y-3 surface-card rounded-lg border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-base">No services found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Create your own services, or pick from a starter list (firewood, pet fee, rentals…) and set your own prices.
          </p>
          <button
            onClick={handleSeedDefaults}
            className="btn btn-primary btn-sm font-bold rounded-md mt-2"
          >
            Choose from Starter List
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {addOns.map((item) => {
            const IconComp = ICON_MAP[item.icon] || Sparkles;

            return (
              <div
                key={item._id}
                className={`surface-card p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                  item.isActive
                    ? "border-slate-200 hover:border-emerald-300 hover:shadow-xs"
                    : "border-slate-200 opacity-60 bg-slate-50/60"
                }`}
              >
                {/* Card Top */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 leading-snug">
                          {item.name}
                        </h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 capitalize">
                          {item.category}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingAddOn(item);
                          setIsModalOpen(true);
                        }}
                        className="btn btn-ghost btn-xs btn-circle text-slate-500 hover:text-emerald-700"
                        title="Edit Service"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="btn btn-ghost btn-xs btn-circle text-slate-400 hover:text-rose-600"
                        title="Delete Service"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {item.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Card Pricing & Status Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-base font-black text-emerald-800 font-mono">
                      {formatCurrency(item.price)}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500">
                      {getPricingBadge(item.pricingType)}
                      {item.taxable && <span className="text-slate-400 ml-1">• Taxable</span>}
                    </div>
                  </div>

                  {/* Active Toggle Switch */}
                  <label className="cursor-pointer flex items-center gap-1.5 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={item.isActive}
                      onChange={() => handleToggleActive(item)}
                      className="checkbox checkbox-xs checkbox-success rounded"
                    />
                    <span className={`text-[11px] font-bold ${item.isActive ? "text-emerald-800" : "text-slate-400"}`}>
                      {item.isActive ? "Active" : "Inactive"}
                    </span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Service Modal */}
      <AddOnModal
        isOpen={isModalOpen}
        addOn={editingAddOn}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAddOn(null);
        }}
        onSuccess={fetchAddOns}
      />
      <TemplatePickerModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onDone={fetchAddOns}
        title="Add services from the starter list"
        subtitle="Pick what you offer and set your own prices"
        priceLabel="Price"
        endpoint="/api/addons/seed"
        existingNames={addOns.map((a) => a.name)}
        items={ADDON_TEMPLATES.map((t) => ({
          key: t.key,
          name: t.name,
          description: t.description,
          meta: `${PRICING_LABELS[t.pricingType]} · ${t.taxable ? "taxable" : "not taxable"}`,
        }))}
      />
    </div>
  );
}
