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
  Settings2,
  RefreshCw,
  Edit2,
  Trash2,
  MapPin,
  Layers,
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
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-base-content">
            Sites & Hookup Inventory
          </h1>
          <p className="text-xs text-base-content/60 mt-0.5">
            Configure campground parking sites, hookup capabilities, and site type categories
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setTypeToEdit(null);
              setIsTypeModalOpen(true);
            }}
            className="btn btn-outline btn-sm gap-1.5 font-semibold"
          >
            <Layers className="w-4 h-4 text-primary" />
            + Site Type
          </button>
          <button
            onClick={() => {
              setSiteToEdit(null);
              setIsSiteModalOpen(true);
            }}
            className="btn btn-primary btn-sm gap-1.5 font-medium shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            Add Site
          </button>
          <button
            onClick={loadData}
            className="btn btn-ghost btn-sm btn-circle"
            title="Refresh Sites"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Site Type Cards Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60">
          Site Categories ({siteTypes.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {siteTypes.map((st) => (
            <div
              key={st._id}
              className="card bg-base-100 border border-base-200 p-4 hover:border-base-300 transition-all space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-sm text-base-content">{st.name}</h4>
                  <span className="text-xs font-bold text-emerald-600">
                    {formatCurrency(st.defaultBaseRate)} / night
                  </span>
                </div>
                <button
                  onClick={() => {
                    setTypeToEdit(st);
                    setIsTypeModalOpen(true);
                  }}
                  className="btn btn-ghost btn-xs btn-circle text-base-content/60"
                  title="Edit Type"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="pt-1">
                <HookupIcons
                  hookups={st.hookups}
                  maxRigLength={st.maxRigLength}
                  compact
                />
              </div>

              <div className="text-[11px] text-base-content/60 pt-1">
                Max {st.maxOccupancy} guests • Clearance {st.maxRigLength}ft
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sites Inventory Table */}
      <div className="card bg-base-100 shadow-sm border border-base-200 overflow-hidden space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-200 pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-base-content">
              All Campground Sites ({sites.length})
            </h3>
          </div>

          <div className="flex items-center gap-1">
            {["all", "available", "maintenance", "inactive"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`btn btn-xs capitalize ${
                  statusFilter === status ? "btn-primary" : "btn-ghost"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead className="bg-base-200/50">
              <tr>
                <th>Site #</th>
                <th>Name / Category</th>
                <th>Hookup Specs</th>
                <th>Rig Type</th>
                <th>Surface</th>
                <th>Nightly Rate</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-xs text-base-content/60">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading site inventory...
                  </td>
                </tr>
              ) : sites.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm text-base-content/50">
                    No sites found. Click &quot;Add Site&quot; to configure your campground.
                  </td>
                </tr>
              ) : (
                sites.map((site) => (
                  <tr key={site._id} className="hover:bg-base-200/40">
                    <td className="font-mono font-bold text-sm text-base-content">
                      {site.siteNumber}
                    </td>
                    <td>
                      <div className="font-semibold text-sm">{site.name || `Site ${site.siteNumber}`}</div>
                      <div className="text-[11px] text-base-content/60">
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
                    <td className="text-xs">{formatRigType(site.rigType)}</td>
                    <td className="text-xs capitalize">{site.surfaceType}</td>
                    <td className="font-bold text-emerald-600 text-xs font-mono">
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
                          className="btn btn-ghost btn-xs text-primary"
                          title="Edit Site"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSite(site)}
                          className="btn btn-ghost btn-xs text-error"
                          title="Delete Site"
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
