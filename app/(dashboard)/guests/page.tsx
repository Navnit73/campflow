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
  ChevronLeft,
  ChevronRight,
  Inbox,
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
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Guest Directory & CRM
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage camper profiles, rig specifications, stay history, and lifetime spending
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setGuestToEdit(null);
              setIsGuestModalOpen(true);
            }}
            className="btn btn-primary btn-sm gap-1.5 font-bold rounded-md"
          >
            <PlusCircle className="w-4 h-4" />
            Add Guest
          </button>
          <button
            onClick={() => fetchGuests(pagination.page)}
            className="btn btn-ghost btn-sm btn-circle text-slate-600 hover:text-slate-900 rounded-md"
            title="Refresh Directory"
            aria-label="Refresh Directory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="surface-card p-3.5 sm:p-4 rounded-lg border border-slate-200">
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2.5">
          <div className="flex-1 min-w-[260px] relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by First Name, Last Name, Email, Phone, or License Plate..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-bordered input-sm w-full pl-9 bg-white text-xs sm:text-sm rounded-md"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm font-bold text-xs rounded-md">
            Search
          </button>
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                fetchGuests(1);
              }}
              className="btn btn-ghost btn-sm text-xs font-semibold rounded-md"
            >
              Reset
            </button>
          )}
        </form>
      </div>

      {/* Guests Table */}
      <div className="surface-card rounded-lg overflow-hidden border border-slate-200">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="table table-sm min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="min-w-[180px]">Guest Name</th>
                <th className="min-w-[180px]">Contact Info</th>
                <th className="min-w-[170px]">RV Rig Details</th>
                <th className="min-w-[100px]">Total Stays</th>
                <th className="min-w-[110px]">Total Spent</th>
                <th className="min-w-[90px]">Status</th>
                <th className="text-right min-w-[80px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-14 text-xs text-slate-500 space-y-2">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-1" />
                    <p>Loading guest directory...</p>
                  </td>
                </tr>
              ) : guests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-14 space-y-2">
                    <div className="w-10 h-10 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Inbox className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No guests found</p>
                    <p className="text-xs text-slate-500">Try adjusting your search criteria or add a new guest.</p>
                  </td>
                </tr>
              ) : (
                guests.map((g) => (
                  <tr
                    key={g._id}
                    onClick={() => handleInspect(g._id)}
                    className="hover:bg-slate-50 cursor-pointer border-b border-slate-100 transition-colors"
                  >
                    <td>
                      <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                        <span>
                          {g.firstName} {g.lastName}
                        </span>
                        {g.isVip && (
                          <span
                            className="badge badge-warning badge-xs font-bold gap-1 text-slate-900 rounded"
                            title="VIP Camper"
                          >
                            <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                            VIP
                          </span>
                        )}
                      </div>
                      {g.address?.city && (
                        <div className="text-[11px] text-slate-500 font-medium">
                          {g.address.city}, {g.address.state}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="text-xs text-slate-800 font-medium">{g.email}</div>
                      <div className="text-xs font-mono text-slate-500">{g.phone}</div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-xs text-slate-700">
                        <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-medium">{formatRvType(g.rvDetails?.type || "travel_trailer")}</span>
                        {g.rvDetails?.lengthFt ? (
                          <span className="font-mono text-slate-500">
                            ({g.rvDetails.lengthFt}ft)
                          </span>
                        ) : null}
                      </div>
                      {g.rvDetails?.licensePlate && (
                        <div className="text-[11px] font-mono text-slate-400 uppercase">
                          Plate: {g.rvDetails.licensePlate}
                        </div>
                      )}
                    </td>
                    <td className="text-xs font-bold text-slate-800">{g.totalStays || 0} stays</td>
                    <td className="font-black text-xs text-emerald-700 font-mono">
                      {formatCurrency(g.totalSpent || 0)}
                    </td>
                    <td>
                      {g.isBlacklisted ? (
                        <span className="badge badge-error badge-xs text-white font-bold rounded">Blacklisted</span>
                      ) : (
                        <span className="badge badge-ghost badge-xs text-slate-600 font-semibold rounded">Active</span>
                      )}
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setGuestToEdit(g);
                          setIsGuestModalOpen(true);
                        }}
                        className="btn btn-ghost btn-xs text-emerald-700 hover:bg-emerald-50 rounded"
                        title="Edit Profile"
                        aria-label={`Edit ${g.firstName} ${g.lastName}`}
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
          <div className="p-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50">
            <div>Showing <span className="font-bold">{guests.length}</span> of <span className="font-bold">{pagination.total}</span> guests</div>
            <div className="join">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchGuests(pagination.page - 1)}
                className="btn btn-outline btn-xs join-item rounded-l-md"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button className="btn btn-outline btn-xs join-item font-mono font-bold">
                Page {pagination.page} / {pagination.totalPages}
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchGuests(pagination.page + 1)}
                className="btn btn-outline btn-xs join-item rounded-r-md"
                aria-label="Next page"
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="font-bold text-slate-500">Email: </span>
                <span className="font-medium text-slate-900">{guestDetails.guest.email}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500">Phone: </span>
                <span className="font-medium font-mono text-slate-900">{guestDetails.guest.phone}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500">Lifetime Spend: </span>
                <span className="font-black text-emerald-700 font-mono">
                  {formatCurrency(guestDetails.guest.totalSpent || 0)}
                </span>
              </div>
            </div>

            {/* RV Specs */}
            <div className="p-3 rounded-lg border border-slate-200 bg-white text-xs space-y-1.5">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-emerald-600" />
                Rig Specifications
              </div>
              <div className="text-slate-700">
                Type: <span className="font-semibold">{formatRvType(guestDetails.guest.rvDetails?.type || "travel_trailer")}</span> • Length: <span className="font-mono font-semibold">{guestDetails.guest.rvDetails?.lengthFt || 0} ft</span>
                {guestDetails.guest.rvDetails?.makeModel && ` • Model: ${guestDetails.guest.rvDetails.makeModel}`}
                {guestDetails.guest.rvDetails?.licensePlate && ` • Plate: ${guestDetails.guest.rvDetails.licensePlate}`}
              </div>
              {guestDetails.guest.notes && (
                <div className="pt-1.5 border-t border-slate-100 text-slate-600 italic">
                  Notes: {guestDetails.guest.notes}
                </div>
              )}
            </div>

            {/* Stay History Table */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Stay History ({guestDetails.reservations?.length || 0})
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="table table-xs">
                  <thead className="bg-slate-50 text-slate-600">
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
                      <tr key={r._id} className="border-b border-slate-100">
                        <td className="font-mono font-bold text-emerald-700">{r.confirmationCode}</td>
                        <td className="font-medium">Site {r.siteSnapshot?.siteNumber}</td>
                        <td>{formatDate(r.checkInDate)}</td>
                        <td>{formatDate(r.checkOutDate)}</td>
                        <td className="font-black font-mono text-emerald-700">
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
