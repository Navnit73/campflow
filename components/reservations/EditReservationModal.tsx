"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { RV_TYPES, RESERVATION_STATUSES } from "@/lib/constants";
import { calculatePricing } from "@/lib/utils/pricing";
import { formatCurrency, formatRvType } from "@/lib/utils/format";
import { Loader2, Calendar, User, CreditCard, MapPin, Truck, AlertTriangle } from "lucide-react";

interface EditReservationModalProps {
  isOpen: boolean;
  reservation: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditReservationModal({
  isOpen,
  reservation,
  onClose,
  onSuccess,
}: EditReservationModalProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState<any[]>([]);

  // Form States
  const [siteId, setSiteId] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [adults, setAdults] = useState<number | string>(2);
  const [children, setChildren] = useState<number | string>(0);
  const [pets, setPets] = useState<number | string>(0);
  const [status, setStatus] = useState<string>("confirmed");
  const [discountCode, setDiscountCode] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [notes, setNotes] = useState("");

  // Guest Snapshot
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [rvType, setRvType] = useState<string>("travel_trailer");
  const [rvLengthFt, setRvLengthFt] = useState<number | string>(30);

  // Load sites
  useEffect(() => {
    if (isOpen) {
      apiClient.get("/api/sites").then((res) => {
        if (res.data?.success) {
          setSites(res.data.data);
        }
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (reservation) {
      setSiteId(reservation.siteId?._id || reservation.siteId || "");
      const dIn = new Date(reservation.checkInDate).toISOString().split("T")[0];
      const dOut = new Date(reservation.checkOutDate).toISOString().split("T")[0];
      setCheckInDate(dIn);
      setCheckOutDate(dOut);
      setAdults(reservation.adults ?? 2);
      setChildren(reservation.children ?? 0);
      setPets(reservation.pets ?? 0);
      setStatus(reservation.status || "confirmed");
      setDiscountCode(reservation.discountCode || "");
      setSpecialRequests(reservation.specialRequests || "");
      setNotes(reservation.notes || "");

      setGuestName(reservation.guestSnapshot?.fullName || "");
      setGuestEmail(reservation.guestSnapshot?.email || "");
      setGuestPhone(reservation.guestSnapshot?.phone || "");
      setRvType(reservation.guestSnapshot?.rvType || "travel_trailer");
      setRvLengthFt(reservation.guestSnapshot?.rvLengthFt ?? 30);
    }
  }, [reservation, isOpen]);

  // Selected site for compatibility checking
  const selectedSite = sites.find((s) => s._id === siteId);
  const maxRig = selectedSite?.siteTypeSnapshot?.maxRigLength ?? 45;
  const isLengthIncompatible = Number(rvLengthFt) > maxRig;

  // Recalculate estimated pricing
  const pricing = calculatePricing({
    nightlyRate: selectedSite?.currentBaseRate || reservation?.pricing?.nightlyRate || 50,
    checkInDate,
    checkOutDate: checkOutDate > checkInDate ? checkOutDate : checkInDate,
    taxRatePercent: 7.5,
    paidAmount: reservation?.pricing?.paidAmount || 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservation) return;
    if (checkOutDate <= checkInDate) {
      error("Check-out date must be after check-in date");
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        siteId,
        checkInDate,
        checkOutDate,
        adults: Number(adults),
        children: Number(children),
        pets: Number(pets),
        status,
        discountCode: discountCode || undefined,
        specialRequests,
        notes,
        guestSnapshot: {
          fullName: guestName,
          email: guestEmail,
          phone: guestPhone,
          rvType,
          rvLengthFt: Number(rvLengthFt),
        },
      };

      const res = await apiClient.patch(`/api/reservations/${reservation._id}`, payload);
      if (res.data?.success) {
        success(`Reservation ${reservation.confirmationCode} updated successfully!`);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      error(err?.message || "Failed to update reservation");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !reservation) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Reservation (${reservation.confirmationCode})`}
      subtitle="Modify stay dates, change site assignment, or update guest details"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1: Site & Dates */}
        <div className="p-3 sm:p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-200/60">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            1. Site & Stay Dates
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Assigned Site</label>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="select select-bordered select-sm w-full font-medium bg-white rounded-md text-xs sm:text-sm"
                required
              >
                {sites.map((s) => (
                  <option key={s._id} value={s._id}>
                    Site {s.siteNumber} — {s.siteTypeSnapshot?.name} ({formatCurrency(s.currentBaseRate)}/nt)
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Booking Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="select select-bordered select-sm w-full capitalize bg-white rounded-md text-xs sm:text-sm"
              >
                {RESERVATION_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Compatibility Warning if RV length exceeds site limit */}
          {isLengthIncompatible && (
            <div className="p-2.5 rounded-md bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-800 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Warning: Guest RV is <strong>{rvLengthFt}ft</strong>, but Site{" "}
                <strong>{selectedSite?.siteNumber}</strong> maximum clearance is{" "}
                <strong>{maxRig}ft</strong>.
              </span>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Check-In Date</label>
              <input
                type="date"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
                className="input input-bordered input-sm w-full font-medium bg-white rounded-md text-xs sm:text-sm"
                required
              />
            </div>

            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Check-Out Date</label>
              <input
                type="date"
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                className="input input-bordered input-sm w-full font-medium bg-white rounded-md text-xs sm:text-sm"
                min={checkInDate}
                required
              />
            </div>
          </div>

          {/* Occupancy */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-0.5">
            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">Adults</label>
              <input
                type="number"
                min={1}
                max={12}
                value={adults}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setAdults(e.target.value === "" ? "" : Number(e.target.value))}
                className="input input-bordered input-sm w-full bg-white rounded-md font-mono"
              />
            </div>
            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">Children</label>
              <input
                type="number"
                min={0}
                max={10}
                value={children}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setChildren(e.target.value === "" ? "" : Number(e.target.value))}
                className="input input-bordered input-sm w-full bg-white rounded-md font-mono"
              />
            </div>
            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">Pets</label>
              <input
                type="number"
                min={0}
                max={6}
                value={pets}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setPets(e.target.value === "" ? "" : Number(e.target.value))}
                className="input input-bordered input-sm w-full bg-white rounded-md font-mono"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Guest Details & Rig */}
        <div className="p-3 sm:p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-200/60">
            <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            2. Guest Information & RV Rig
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Full Name</label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="input input-bordered input-sm w-full bg-white rounded-md font-medium"
                required
              />
            </div>
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Email</label>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="input input-bordered input-sm w-full bg-white rounded-md"
                required
              />
            </div>
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Phone</label>
              <input
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="input input-bordered input-sm w-full font-mono bg-white rounded-md"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-200/60">
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">RV Rig Type</label>
              <select
                value={rvType}
                onChange={(e) => setRvType(e.target.value)}
                className="select select-bordered select-sm w-full bg-white rounded-md text-xs"
              >
                {RV_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {formatRvType(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">RV Length (ft)</label>
              <input
                type="number"
                min={0}
                max={60}
                value={rvLengthFt}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setRvLengthFt(e.target.value === "" ? "" : Number(e.target.value))}
                className="input input-bordered input-sm w-full font-mono bg-white rounded-md"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Billing Recalculation & Notes */}
        <div className="p-3 sm:p-4 rounded-lg border border-slate-200 bg-white space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700">
              <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              3. Rate Recalculation
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 font-mono">
                {pricing.numNights} Nights • Total: {formatCurrency(pricing.totalAmount)} • Paid: {formatCurrency(pricing.paidAmount)} • Balance Due:{" "}
              </span>
              <span className="text-sm font-black text-rose-700 font-mono">
                {formatCurrency(pricing.balanceDue)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Guest Requests</label>
              <input
                type="text"
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="Near bathhouse, quiet area..."
                className="input input-bordered input-sm w-full rounded-md"
              />
            </div>
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Staff Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Gate code given, late arrival..."
                className="input input-bordered input-sm w-full rounded-md"
              />
            </div>
          </div>
        </div>

        {/* Footer CTAs */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm w-full sm:w-auto font-semibold rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-sm w-full sm:w-auto min-w-[140px] font-bold rounded-md"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
