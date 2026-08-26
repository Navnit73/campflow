"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { SiteStatusBadge } from "@/components/ui/Badge";
import { HookupIcons } from "@/components/ui/HookupIcons";
import { SiteFormModal } from "@/components/sites/SiteFormModal";
import { SiteTypeModal } from "@/components/sites/SiteTypeModal";
import { NewReservationModal } from "@/components/reservations/NewReservationModal";
import { ReservationDetailModal } from "@/components/reservations/ReservationDetailModal";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatRigType, formatDate } from "@/lib/utils/format";
import {
  PlusCircle,
  RefreshCw,
  Edit2,
  Trash2,
  MapPin,
  Layers,
  Inbox,
  LayoutGrid,
  List,
  CheckCircle2,
  Wrench,
  Ban,
  User,
  Calendar,
} from "lucide-react";

export default function SitesPage() {
  const { success, error } = useToast();
  const [sites, setSites] = useState<any[]>([]);
  const [siteTypes, setSiteTypes] = useState<any[]>([]);
  const [activeReservations, setActiveReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // View Mode: 'list' or 'map'
  const [viewMode, setViewMode] = useState<"list" | "map">("map");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Modals
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [siteToEdit, setSiteToEdit] = useState<any | null>(null);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [typeToEdit, setTypeToEdit] = useState<any | null>(null);

  // Direct Booking / Inspection Modals from Map
  const [bookingSiteId, setBookingSiteId] = useState<string | null>(null);
  const [selectedResId, setSelectedResId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sitesRes, typesRes, resRes] = await Promise.all([
        apiClient.get("/api/sites", {
          params: {
            status: statusFilter !== "all" ? statusFilter : undefined,
            siteTypeId: categoryFilter !== "all" ? categoryFilter : undefined,
          },
        }),
        apiClient.get("/api/sites/types"),
        apiClient.get("/api/reservations", {
          params: { status: "checked_in", limit: 100 },
        }),
      ]);

      if (sitesRes.data?.success) setSites(sitesRes.data.data);
      if (typesRes.data?.success) setSiteTypes(typesRes.data.data);
      if (resRes.data?.success) setActiveReservations(resRes.data.data.reservations || []);
    } catch (err: any) {
      error(err?.message || "Failed to load campground sites");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, categoryFilter]);

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

  // Map each site to its current active in-house reservation (if any)
  const siteOccupancyMap = new Map<string, any>();
  activeReservations.forEach((r) => {
    const sId = r.siteId?._id || r.siteId;
    if (sId) siteOccupancyMap.set(sId.toString(), r);
  });

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Campground Sites & Map
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time visual site map, dimensions, hookup specs, and site type categories
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          <div className="join bg-white border border-slate-200 rounded-md shadow-xs">
            <button
              onClick={() => setViewMode("map")}
              className={`btn btn-xs sm:btn-sm join-item font-bold gap-1.5 ${
                viewMode === "map" ? "bg-emerald-600 text-white" : "btn-ghost text-slate-600"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Visual Map
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`btn btn-xs sm:btn-sm join-item font-bold gap-1.5 ${
                viewMode === "list" ? "bg-emerald-600 text-white" : "btn-ghost text-slate-600"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Table List
            </button>
          </div>

          <button
            onClick={() => {
              setTypeToEdit(null);
              setIsTypeModalOpen(true);
            }}
            className="btn btn-outline btn-sm gap-1.5 font-bold text-xs rounded-md"
          >
            <Layers className="w-4 h-4 text-emerald-600" />
            + Category
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

      {/* Site Type Categories Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Site Categories ({siteTypes.length})
          </h3>
        </div>
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

      {/* Filter Toolbar */}
      <div className="surface-card p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status:</span>
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

        {siteTypes.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="select select-bordered select-xs bg-white rounded-md font-medium text-xs"
            >
              <option value="all">All Categories</option>
              {siteTypes.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* VIEW 1: VISUAL MAP / GRID VIEW */}
      {viewMode === "map" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Available
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span> Occupied (In-House)
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Maintenance
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span> Inactive
              </span>
            </div>
            <span>Showing {sites.length} sites</span>
          </div>

          {loading ? (
            <div className="surface-card p-14 text-center text-slate-500 space-y-2 border border-slate-200 rounded-lg">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-1" />
              <p className="text-xs font-semibold">Loading campground site map...</p>
            </div>
          ) : sites.length === 0 ? (
            <div className="surface-card p-14 text-center space-y-2 border border-slate-200 rounded-lg">
              <Inbox className="w-8 h-8 mx-auto text-slate-400" />
              <p className="text-sm font-semibold text-slate-700">No sites matching filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {sites.map((site) => {
                const currentRes = siteOccupancyMap.get(site._id.toString());
                const isOccupied = !!currentRes;

                return (
                  <div
                    key={site._id}
                    className={`surface-card rounded-lg border p-3.5 flex flex-col justify-between transition-all hover:shadow-md ${
                      site.status === "maintenance"
                        ? "border-amber-300 bg-amber-50/30"
                        : site.status === "inactive"
                        ? "border-slate-300 bg-slate-50 opacity-60"
                        : isOccupied
                        ? "border-sky-300 bg-sky-50/40"
                        : "border-emerald-200 bg-white hover:border-emerald-400"
                    }`}
                  >
                    {/* Site Header */}
                    <div>
                      <div className="flex items-start justify-between gap-1.5">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-base text-slate-900">
                              Site {site.siteNumber}
                            </span>
                            {site.petFriendly && (
                              <span title="Pet Friendly" className="text-xs">
                                🐾
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium truncate">
                            {site.siteTypeSnapshot?.name}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-black text-sm text-emerald-700 font-mono block">
                            {formatCurrency(site.currentBaseRate)}
                          </span>
                          {site.weekendBaseRate ? (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              Wkd: {formatCurrency(site.weekendBaseRate)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Hookup Specs */}
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <HookupIcons
                          hookups={site.siteTypeSnapshot?.hookups}
                          rigType={site.rigType}
                          maxRigLength={site.siteTypeSnapshot?.maxRigLength}
                          compact
                        />
                      </div>

                      {/* Occupant Card if Occupied */}
                      {isOccupied && (
                        <div
                          onClick={() => setSelectedResId(currentRes._id)}
                          className="mt-2 p-2 rounded-md bg-sky-100/70 border border-sky-200 text-xs cursor-pointer hover:bg-sky-100 transition-colors"
                        >
                          <div className="flex items-center gap-1 font-bold text-sky-900 truncate">
                            <User className="w-3 h-3 text-sky-700 shrink-0" />
                            <span className="truncate">{currentRes.guestSnapshot?.fullName}</span>
                          </div>
                          <div className="text-[10px] text-sky-700 flex items-center gap-1 mt-0.5 font-medium">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>Departs: {formatDate(currentRes.checkOutDate)}</span>
                          </div>
                        </div>
                      )}

                      {/* Maintenance status note */}
                      {site.status === "maintenance" && (
                        <div className="mt-2 p-1.5 rounded-md bg-amber-100/70 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-1 font-medium">
                          <Wrench className="w-3 h-3 shrink-0" />
                          <span>{site.notes || "Under Maintenance"}</span>
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setSiteToEdit(site);
                            setIsSiteModalOpen(true);
                          }}
                          className="btn btn-ghost btn-xs text-slate-600 hover:text-slate-900 rounded"
                          title="Edit Site"
                          aria-label={`Edit Site ${site.siteNumber}`}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteSite(site)}
                          className="btn btn-ghost btn-xs text-rose-600 hover:text-rose-900 rounded"
                          title="Delete Site"
                          aria-label={`Delete Site ${site.siteNumber}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      <div>
                        {site.status === "available" && !isOccupied && (
                          <button
                            onClick={() => setBookingSiteId(site._id)}
                            className="btn btn-primary btn-xs font-bold gap-1 rounded"
                          >
                            <PlusCircle className="w-3 h-3" />
                            Book
                          </button>
                        )}
                        {isOccupied && (
                          <button
                            onClick={() => setSelectedResId(currentRes._id)}
                            className="btn btn-info btn-xs text-white font-bold gap-1 rounded"
                          >
                            Folio
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: TABLE LIST VIEW */}
      {viewMode === "list" && (
        <div className="surface-card rounded-lg overflow-hidden border border-slate-200">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="table table-sm min-w-[840px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="min-w-[90px]">Site #</th>
                  <th className="min-w-[180px]">Name / Category</th>
                  <th className="min-w-[160px]">Hookup Specs</th>
                  <th className="min-w-[100px]">Rig Type</th>
                  <th className="min-w-[90px]">Surface</th>
                  <th className="min-w-[100px]">Nightly Rate</th>
                  <th className="min-w-[80px]">Pets</th>
                  <th className="min-w-[110px]">Status</th>
                  <th className="text-right min-w-[110px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-14 text-xs text-slate-500 space-y-2">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-1" />
                      <p>Loading site inventory...</p>
                    </td>
                  </tr>
                ) : sites.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-14 space-y-2">
                      <div className="w-10 h-10 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Inbox className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">No sites found</p>
                    </td>
                  </tr>
                ) : (
                  sites.map((site) => {
                    const isOccupied = siteOccupancyMap.has(site._id.toString());
                    return (
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
                        <td>
                          <div className="font-black text-emerald-700 text-xs font-mono">
                            {formatCurrency(site.currentBaseRate)}
                          </div>
                          {site.weekendBaseRate ? (
                            <div className="text-[10px] text-slate-400 font-mono">
                              Wkd: {formatCurrency(site.weekendBaseRate)}
                            </div>
                          ) : null}
                        </td>
                        <td className="text-xs">
                          {site.petFriendly ? (
                            <span className="badge badge-success badge-xs font-bold text-white rounded">Yes</span>
                          ) : (
                            <span className="badge badge-ghost badge-xs text-slate-400 rounded">No</span>
                          )}
                        </td>
                        <td>
                          {isOccupied ? (
                            <span className="badge badge-info badge-xs text-white font-bold rounded">Occupied</span>
                          ) : (
                            <SiteStatusBadge status={site.status} />
                          )}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {site.status === "available" && !isOccupied && (
                              <button
                                onClick={() => setBookingSiteId(site._id)}
                                className="btn btn-ghost btn-xs text-emerald-700 hover:bg-emerald-50 rounded"
                                title="Book Site"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSiteToEdit(site);
                                setIsSiteModalOpen(true);
                              }}
                              className="btn btn-ghost btn-xs text-slate-600 hover:bg-slate-100 rounded"
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
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      <NewReservationModal
        isOpen={!!bookingSiteId}
        initialSiteId={bookingSiteId || undefined}
        onClose={() => setBookingSiteId(null)}
        onSuccess={() => {
          setBookingSiteId(null);
          loadData();
        }}
      />

      <ReservationDetailModal
        reservationId={selectedResId}
        isOpen={!!selectedResId}
        onClose={() => setSelectedResId(null)}
        onUpdated={loadData}
        onOpenPayment={() => {}}
      />
    </div>
  );
}

