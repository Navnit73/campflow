"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { SiteStatusBadge } from "@/components/ui/Badge";
import { HookupIcons } from "@/components/ui/HookupIcons";
import { SiteFormModal } from "@/components/sites/SiteFormModal";
import { SiteTypeModal } from "@/components/sites/SiteTypeModal";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatRigType } from "@/lib/utils/format";
import {
  PlusCircle,
  RefreshCw,
  Edit2,
  Trash2,
  MapPin,
  Layers,
  Inbox,
} from "lucide-react";

export default function SitesPage() {
  const { success, error } = useToast();
  const [sites, setSites] = useState<any[]>([]);
  const [siteTypes, setSiteTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [siteToEdit, setSiteToEdit] = useState<any | null>(null);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [typeToEdit, setTypeToEdit] = useState<any | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sitesRes, typesRes] = await Promise.all([
        apiClient.get("/api/sites", {
          params: { status: statusFilter !== "all" ? statusFilter : undefined },
        }),
        apiClient.get("/api/sites/types"),
      ]);

      if (sitesRes.data?.success) setSites(sitesRes.data.data);
      if (typesRes.data?.success) setSiteTypes(typesRes.data.data);
    } catch (err: any) {
      error(err?.message || "Failed to load sites");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleDeleteSite = async (site: any) => {
    if (!confirm(`Are you sure you want to delete Site ${site.siteNumber}?`)) {
      return;
    }
    try {
      const res = await apiClient.delete(`/api/sites/${site._id}`);
      if (res.data?.success) {
        success(`Site ${site.siteNumber} deleted successfully`);
        loadData();
      }
    } catch (err: any) {
      error(err?.message || "Failed to delete site");
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Sites & Inventory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Configure campground parking sites, hookup capabilities, and site type categories
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setTypeToEdit(null);
              setIsTypeModalOpen(true);
            }}
            className="btn btn-outline btn-sm gap-1.5 font-bold text-xs rounded-md"
          >
            <Layers className="w-4 h-4 text-emerald-600" />
            + Site Category
          </button>
          <button
            onClick={() => {
              setSiteToEdit(null);
              setIsSiteModalOpen(true);
            }}
            className="btn btn-primary btn-sm gap-1.5 font-bold rounded-md"
          >
            <PlusCircle className="w-4 h-4" />
            Add Site
          </button>
          <button
            onClick={loadData}
            className="btn btn-ghost btn-sm btn-circle text-slate-600 hover:text-slate-900 rounded-md"
            title="Refresh Sites"
            aria-label="Refresh Sites"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Site Type Cards Section */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Site Categories ({siteTypes.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {siteTypes.map((st) => (
            <div
              key={st._id}
              className="surface-card p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-all space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">{st.name}</h4>
                  <span className="text-xs font-black text-emerald-700 font-mono">
                    {formatCurrency(st.defaultBaseRate)} / nt
                  </span>
                </div>
                <button
                  onClick={() => {
                    setTypeToEdit(st);
                    setIsTypeModalOpen(true);
                  }}
                  className="btn btn-ghost btn-xs btn-circle text-slate-500 hover:text-slate-900"
                  title="Edit Category"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <HookupIcons
                  hookups={st.hookups}
                  maxRigLength={st.maxRigLength}
                  compact
                />
              </div>

              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 font-medium">
                Max {st.maxOccupancy} guests • Max {st.maxRigLength}ft rig
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sites Inventory Table */}
      <div className="surface-card rounded-lg overflow-hidden space-y-3 p-4 border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">
              Campground Sites Inventory ({sites.length})
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            {["all", "available", "maintenance", "inactive"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`btn btn-xs capitalize font-bold rounded ${
                  statusFilter === status ? "bg-emerald-600 text-white" : "btn-ghost text-slate-600"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="table table-sm min-w-[780px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="min-w-[90px]">Site #</th>
                <th className="min-w-[180px]">Name / Category</th>
                <th className="min-w-[160px]">Hookup Specs</th>
                <th className="min-w-[100px]">Rig Type</th>
                <th className="min-w-[90px]">Surface</th>
                <th className="min-w-[100px]">Nightly Rate</th>
                <th className="min-w-[110px]">Status</th>
                <th className="text-right min-w-[90px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-xs text-slate-500 space-y-2">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-1" />
                    <p>Loading site inventory...</p>
                  </td>
                </tr>
              ) : sites.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-14 space-y-2">
                    <div className="w-10 h-10 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Inbox className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No sites found</p>
                    <p className="text-xs text-slate-500">Click &quot;Add Site&quot; to configure your campground inventory.</p>
                  </td>
                </tr>
              ) : (
                sites.map((site) => (
                  <tr key={site._id} className="hover:bg-slate-50 border-b border-slate-100 transition-colors">
                    <td className="font-mono font-bold text-sm text-slate-900">
                      Site {site.siteNumber}
                    </td>
                    <td>
                      <div className="font-bold text-sm text-slate-900">{site.name || `Site ${site.siteNumber}`}</div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {site.siteTypeSnapshot?.name}
                      </div>
                    </td>
                    <td>
                      <HookupIcons
                        hookups={site.siteTypeSnapshot?.hookups}
                        maxRigLength={site.siteTypeSnapshot?.maxRigLength}
                        compact
                      />
                    </td>
                    <td className="text-xs font-medium">{formatRigType(site.rigType)}</td>
                    <td className="text-xs capitalize font-medium">{site.surfaceType}</td>
                    <td className="font-black text-emerald-700 text-xs font-mono">
                      {formatCurrency(site.currentBaseRate)}
                    </td>
                    <td>
                      <SiteStatusBadge status={site.status} />
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setSiteToEdit(site);
                            setIsSiteModalOpen(true);
                          }}
                          className="btn btn-ghost btn-xs text-emerald-700 hover:bg-emerald-50 rounded"
                          title="Edit Site"
                          aria-label={`Edit Site ${site.siteNumber}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSite(site)}
                          className="btn btn-ghost btn-xs text-rose-700 hover:bg-rose-50 rounded"
                          title="Delete Site"
                          aria-label={`Delete Site ${site.siteNumber}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <SiteFormModal
        isOpen={isSiteModalOpen}
        onClose={() => {
          setIsSiteModalOpen(false);
          setSiteToEdit(null);
        }}
        onSuccess={loadData}
        siteToEdit={siteToEdit}
        siteTypes={siteTypes}
      />

      <SiteTypeModal
        isOpen={isTypeModalOpen}
        onClose={() => {
          setIsTypeModalOpen(false);
          setTypeToEdit(null);
        }}
        onSuccess={loadData}
        typeToEdit={typeToEdit}
      />
    </div>
  );
}
