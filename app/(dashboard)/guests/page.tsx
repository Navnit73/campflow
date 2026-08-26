"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { GuestFormModal } from "@/components/guests/GuestFormModal";
import { Modal } from "@/components/ui/Modal";
import { ReservationBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate, formatRvType } from "@/lib/utils/format";
import {
  Users,
  Search,
  PlusCircle,
  RefreshCw,
  Edit2,
  Truck,
  Star,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function GuestsPage() {
  const { error } = useToast();
  const [guests, setGuests] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [guestToEdit, setGuestToEdit] = useState<any | null>(null);
  const [inspectGuestId, setInspectGuestId] = useState<string | null>(null);
  const [guestDetails, setGuestDetails] = useState<any | null>(null);

  const fetchGuests = async (page = 1) => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/guests", {
        params: {
          page,
          limit: 20,
          search: searchTerm || undefined,
        },
      });
      if (res.data?.success) {
        setGuests(res.data.data.guests);
        setPagination(res.data.data.pagination);
      }
    } catch (err: any) {
      error(err?.message || "Failed to load guests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuests(1);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchGuests(1);
  };

  const handleInspect = async (guestId: string) => {
    setInspectGuestId(guestId);
    try {
      const res = await apiClient.get(`/api/guests/${guestId}`);
      if (res.data?.success) {
        setGuestDetails(res.data.data);
      }
    } catch (err: any) {
      error(err?.message || "Failed to load guest history");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-base-content">
            Guest Directory & CRM
          </h1>
          <p className="text-xs text-base-content/60 mt-0.5">
            Manage camper profiles, rig specifications, stay history, and lifetime spending
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setGuestToEdit(null);
              setIsGuestModalOpen(true);
            }}
            className="btn btn-primary btn-sm gap-1.5 font-medium shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            Add Guest
          </button>
          <button
            onClick={() => fetchGuests(pagination.page)}
            className="btn btn-ghost btn-sm btn-circle"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card bg-base-100 shadow-sm border border-base-200 p-4">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-base-content/50 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by First Name, Last Name, Email, Phone, or License Plate..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-bordered input-sm w-full pl-9"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm">
            Search
          </button>
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                fetchGuests(1);
              }}
              className="btn btn-ghost btn-sm"
            >
              Reset
            </button>
          )}
        </form>
      </div>

      {/* Guests Table */}
      <div className="card bg-base-100 shadow-sm border border-base-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead className="bg-base-200/50">
              <tr>
                <th>Guest Name</th>
                <th>Contact Info</th>
                <th>RV Rig Details</th>
                <th>Total Stays</th>
                <th>Total Spent</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-xs text-base-content/60">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading guest directory...
                  </td>
                </tr>
              ) : guests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm text-base-content/50">
                    No guests found.
                  </td>
                </tr>
              ) : (
                guests.map((g) => (
                  <tr
                    key={g._id}
                    onClick={() => handleInspect(g._id)}
                    className="hover:bg-base-200/40 cursor-pointer"
                  >
                    <td>
                      <div className="font-bold text-sm text-base-content flex items-center gap-1.5">
                        <span>
                          {g.firstName} {g.lastName}
                        </span>
                        {g.isVip && (
                          <span
                            className="badge badge-warning badge-xs font-bold gap-1 text-slate-900"
                            title="VIP Camper"
                          >
                            <Star className="w-2.5 h-2.5 fill-slate-900" />
                            VIP
                          </span>
                        )}
                      </div>
                      {g.address?.city && (
                        <div className="text-[11px] text-base-content/60">
                          {g.address.city}, {g.address.state}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="text-xs">{g.email}</div>
                      <div className="text-xs font-mono text-base-content/60">{g.phone}</div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{formatRvType(g.rvDetails?.type || "travel_trailer")}</span>
                        {g.rvDetails?.lengthFt ? (
                          <span className="font-mono text-base-content/60">
                            ({g.rvDetails.lengthFt}ft)
                          </span>
                        ) : null}
                      </div>
                      {g.rvDetails?.licensePlate && (
                        <div className="text-[11px] font-mono text-base-content/50 uppercase">
                          Plate: {g.rvDetails.licensePlate}
                        </div>
                      )}
                    </td>
                    <td className="text-xs font-bold">{g.totalStays || 0} stays</td>
                    <td className="font-bold text-xs text-emerald-600 font-mono">
                      {formatCurrency(g.totalSpent || 0)}
                    </td>
                    <td>
                      {g.isBlacklisted ? (
                        <span className="badge badge-error badge-xs">Blacklisted</span>
                      ) : (
                        <span className="badge badge-ghost badge-xs">Active</span>
                      )}
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setGuestToEdit(g);
                          setIsGuestModalOpen(true);
                        }}
                        className="btn btn-ghost btn-xs text-primary"
                        title="Edit Profile"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
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
            <div>Showing {guests.length} of {pagination.total} guests</div>
            <div className="join">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchGuests(pagination.page - 1)}
                className="btn btn-outline btn-xs join-item"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button className="btn btn-outline btn-xs join-item font-mono font-bold">
                Page {pagination.page} / {pagination.totalPages}
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchGuests(pagination.page + 1)}
                className="btn btn-outline btn-xs join-item"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Guest Profile & Stay History Modal */}
      <Modal
        isOpen={!!inspectGuestId}
        onClose={() => {
          setInspectGuestId(null);
          setGuestDetails(null);
        }}
        title={guestDetails ? `${guestDetails.guest.firstName} ${guestDetails.guest.lastName}` : "Guest Details"}
        subtitle="Camper CRM history & previous stays"
        maxWidth="max-w-3xl"
      >
        {guestDetails && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-base-200/50 text-xs">
              <div>
                <span className="font-semibold text-base-content/60">Email: </span>
                <span className="font-medium text-base-content">{guestDetails.guest.email}</span>
              </div>
              <div>
                <span className="font-semibold text-base-content/60">Phone: </span>
                <span className="font-medium font-mono text-base-content">{guestDetails.guest.phone}</span>
              </div>
              <div>
                <span className="font-semibold text-base-content/60">Lifetime Spend: </span>
                <span className="font-bold text-emerald-600 font-mono">
                  {formatCurrency(guestDetails.guest.totalSpent || 0)}
                </span>
              </div>
            </div>

            {/* RV Specs */}
            <div className="p-3 rounded-xl border border-base-200 bg-base-100 text-xs space-y-1">
              <div className="font-bold text-base-content flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-emerald-600" />
                Rig Specifications
              </div>
              <div className="text-base-content/80">
                Type: {formatRvType(guestDetails.guest.rvDetails?.type || "travel_trailer")} • Length: {guestDetails.guest.rvDetails?.lengthFt || 0} ft
                {guestDetails.guest.rvDetails?.makeModel && ` • Model: ${guestDetails.guest.rvDetails.makeModel}`}
                {guestDetails.guest.rvDetails?.licensePlate && ` • Plate: ${guestDetails.guest.rvDetails.licensePlate}`}
              </div>
              {guestDetails.guest.notes && (
                <div className="pt-2 text-base-content/70 italic">
                  Notes: {guestDetails.guest.notes}
                </div>
              )}
            </div>

            {/* Stay History Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/70">
                Stay History ({guestDetails.reservations?.length || 0})
              </h4>
              <div className="overflow-x-auto border border-base-200 rounded-xl">
                <table className="table table-xs">
                  <thead className="bg-base-200/50">
                    <tr>
                      <th>Code</th>
                      <th>Site</th>
                      <th>Check-In</th>
                      <th>Check-Out</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guestDetails.reservations?.map((r: any) => (
                      <tr key={r._id}>
                        <td className="font-mono font-bold text-primary">{r.confirmationCode}</td>
                        <td>Site {r.siteSnapshot?.siteNumber}</td>
                        <td>{formatDate(r.checkInDate)}</td>
                        <td>{formatDate(r.checkOutDate)}</td>
                        <td className="font-bold font-mono text-emerald-600">
                          {formatCurrency(r.pricing?.totalAmount)}
                        </td>
                        <td>
                          <ReservationBadge status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Guest Form Modal */}
      <GuestFormModal
        isOpen={isGuestModalOpen}
        onClose={() => {
          setIsGuestModalOpen(false);
          setGuestToEdit(null);
        }}
        onSuccess={() => fetchGuests(pagination.page)}
        guestToEdit={guestToEdit}
      />
    </div>
  );
}
