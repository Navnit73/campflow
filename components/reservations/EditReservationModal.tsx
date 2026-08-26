"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { RV_TYPES, RESERVATION_STATUSES } from "@/lib/constants";
import { calculatePricing } from "@/lib/utils/pricing";
import { formatCurrency, formatRvType } from "@/lib/utils/format";
import { parseDateOnly, formatDateKey, addDaysStr } from "@/lib/utils/date";
import {
  Loader2,
  Calendar,
  User,
  CreditCard,
  MapPin,
  Truck,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Plus,
  Minus,
} from "lucide-react";

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
  const [availableAddOns, setAvailableAddOns] = useState<any[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, { isAvailable: boolean; conflictReason: string | null }>>({});

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

  // Selected Add-Ons: { [addOnId or name]: quantity }
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});

  // Guest Snapshot
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [rvType, setRvType] = useState<string>("travel_trailer");
  const [rvLengthFt, setRvLengthFt] = useState<number | string>(30);

  // Load sites & add-ons
  useEffect(() => {
    if (isOpen) {
      apiClient.get("/api/sites").then((res) => {
        if (res.data?.success) {
          setSites(res.data.data);
        }
      });

      apiClient.get("/api/addons?isActive=true").then((res) => {
        if (res.data?.success) {
          setAvailableAddOns(res.data.data || []);
        }
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (reservation) {
      setSiteId(reservation.siteId?._id || reservation.siteId || "");
      const dIn = formatDateKey(reservation.checkInDate);
      const dOut = formatDateKey(reservation.checkOutDate);
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

      // Populate existing add-ons
      const addOnMap: Record<string, number> = {};
      if (reservation.addOns && Array.isArray(reservation.addOns)) {
        reservation.addOns.forEach((a: any) => {
          const key = a.addOnId?.toString() || a.name;
          addOnMap[key] = a.quantity || 1;
        });
      }
      setSelectedAddOns(addOnMap);
    }
  }, [reservation, isOpen]);

  // Query site availability for changed dates/site, excluding current reservation
  useEffect(() => {
    if (isOpen && checkInDate && checkOutDate && checkOutDate > checkInDate && reservation?._id) {
      apiClient
        .get("/api/reservations/availability", {
          params: {
            checkInDate,
            checkOutDate,
            excludeReservationId: reservation._id,
          },
        })
        .then((res) => {
          if (res.data?.success) {
            const map: Record<string, { isAvailable: boolean; conflictReason: string | null }> = {};
            res.data.data.forEach((s: any) => {
              map[s._id] = {
                isAvailable: s.isAvailable,
                conflictReason: s.conflictReason,
              };
            });
            setAvailabilityMap(map);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, checkInDate, checkOutDate, reservation?._id]);

  const handleCheckInChange = (newIn: string) => {
    setCheckInDate(newIn);
    if (!checkOutDate || checkOutDate <= newIn) {
      setCheckOutDate(addDaysStr(newIn, 1));
    }
  };

  const handleToggleAddOn = (addon: any) => {
    const key = addon._id || addon.name;
    setSelectedAddOns((prev) => {
      const current = prev[key] || 0;
      if (current > 0) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: 1 };
    });
  };

  const handleUpdateAddOnQty = (addon: any, delta: number) => {
    const key = addon._id || addon.name;
    setSelectedAddOns((prev) => {
      const current = prev[key] || 0;
      const nextVal = Math.max(0, current + delta);
      if (nextVal === 0) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: nextVal };
    });
  };

  // Selected site for compatibility checking
  const selectedSite = sites.find((s) => s._id === siteId);
  const maxRig = selectedSite?.siteTypeSnapshot?.maxRigLength ?? 45;
  const isLengthIncompatible = Number(rvLengthFt) > maxRig;
  const isSiteAvailable = availabilityMap[siteId]?.isAvailable ?? true;
  const conflictReason = availabilityMap[siteId]?.conflictReason;

  // Build applied add-ons
  const appliedAddOns = availableAddOns
    .filter((a) => (selectedAddOns[a._id] || selectedAddOns[a.name] || 0) > 0)
    .map((a) => ({
      addOnId: a._id,
      name: a.name,
      price: a.price,
      pricingType: a.pricingType,
      quantity: selectedAddOns[a._id] || selectedAddOns[a.name] || 1,
      taxable: a.taxable,
    }));

  // Recalculate estimated pricing
  const pricing = calculatePricing({
    nightlyRate: selectedSite?.currentBaseRate || reservation?.pricing?.nightlyRate || 50,
    checkInDate,
    checkOutDate: checkOutDate > checkInDate ? checkOutDate : checkInDate,
    adults: Number(adults) || 2,
    taxRatePercent: 7.5,
    paidAmount: reservation?.pricing?.paidAmount || 0,
    addOns: appliedAddOns,
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
        addOns: appliedAddOns,
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
      title={`Edit Reservation: ${reservation.confirmationCode}`}
      subtitle="Modify stay dates, site assignment, add-on services, or camper details"
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1: Site, Status & Dates */}
        <div className="p-3 sm:p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              1. Site & Reservation Status
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700">Status:</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="select select-bordered select-xs font-bold capitalize bg-white rounded"
              >
                {RESERVATION_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Site selection */}
          <div className="w-full">
            <label className="label text-xs font-bold text-slate-700 py-0.5">Campground Site</label>
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className={`select select-bordered select-sm w-full font-medium bg-white rounded-md text-xs sm:text-sm ${
                !isSiteAvailable ? "border-rose-400 focus:border-rose-500" : ""
              }`}
              required
            >
              {sites.map((s) => {
                const avail = availabilityMap[s._id];
                const isAvail = avail ? avail.isAvailable : s.status === "available";
                const isCurrent = s._id === reservation.siteId?._id || s._id === reservation.siteId;
                const labelSuffix = isCurrent
                  ? "(Current Site)"
                  : avail
                  ? isAvail
                    ? "✓ Available"
                    : `✗ ${avail.conflictReason || "Unavailable"}`
                  : "";

                return (
                  <option
                    key={s._id}
                    value={s._id}
                    disabled={!isCurrent && avail && !isAvail}
                  >
                    Site {s.siteNumber} — {s.siteTypeSnapshot?.name || "Standard"} ({formatCurrency(s.currentBaseRate)}/nt) {labelSuffix}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Availability Conflict Alert */}
          {!isSiteAvailable && (
            <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-800 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>
                Site {selectedSite?.siteNumber} is {conflictReason || "unavailable for these dates"}.
              </span>
            </div>
          )}

          {/* Compatibility Warning */}
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
                onChange={(e) => handleCheckInChange(e.target.value)}
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
                min={addDaysStr(checkInDate, 1)}
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

        {/* Section 2: Guest Details */}
        <div className="p-3 sm:p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-200/60">
            <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            2. Guest Information & Equipment
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">Full Name</label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="input input-bordered input-sm w-full bg-white rounded-md text-xs sm:text-sm font-medium"
                required
              />
            </div>
            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">Email Address</label>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="input input-bordered input-sm w-full bg-white rounded-md text-xs sm:text-sm"
                required
              />
            </div>
            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">Phone Number</label>
              <input
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="input input-bordered input-sm w-full bg-white rounded-md text-xs sm:text-sm font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">RV / Rig Type</label>
              <select
                value={rvType}
                onChange={(e) => setRvType(e.target.value)}
                className="select select-bordered select-sm w-full bg-white rounded-md text-xs sm:text-sm"
              >
                {RV_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {formatRvType(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">Rig Length (Feet)</label>
              <input
                type="number"
                min={0}
                max={55}
                value={rvLengthFt}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setRvLengthFt(e.target.value === "" ? "" : Number(e.target.value))}
                className="input input-bordered input-sm w-full bg-white rounded-md font-mono"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Add-On Services & Extras */}
        {availableAddOns.length > 0 && (
          <div className="p-3 sm:p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-200/60">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                3. Add-On Services & Amenities
              </div>
              {pricing.addOnsSubtotal > 0 && (
                <span className="badge badge-success badge-xs font-mono font-bold text-[10px] text-white">
                  +{formatCurrency(pricing.addOnsSubtotal)} Added
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {availableAddOns.map((addon) => {
                const qty = selectedAddOns[addon._id] || selectedAddOns[addon.name] || 0;
                const isSelected = qty > 0;

                return (
                  <div
                    key={addon._id}
                    className={`p-2.5 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? "bg-emerald-50/50 border-emerald-400 shadow-2xs"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="min-w-0 pr-1">
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {addon.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {formatCurrency(addon.price)}{" "}
                        <span className="text-[10px]">
                          {addon.pricingType === "per_night"
                            ? "/ nt"
                            : addon.pricingType === "per_person"
                            ? "/ person"
                            : addon.pricingType === "per_unit"
                            ? "/ unit"
                            : "flat"}
                        </span>
                      </div>
                    </div>

                    {/* Quantity Stepper */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isSelected ? (
                        <div className="flex items-center gap-1 bg-white rounded-md border border-emerald-300 p-0.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateAddOnQty(addon, -1)}
                            className="btn btn-ghost btn-xs btn-circle h-6 w-6 text-slate-600 hover:text-slate-900"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center font-mono font-bold text-xs text-emerald-800">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateAddOnQty(addon, 1)}
                            className="btn btn-ghost btn-xs btn-circle h-6 w-6 text-slate-600 hover:text-slate-900"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleAddOn(addon)}
                          className="btn btn-outline btn-xs font-bold text-[11px] text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 4: Notes & Pricing Summary */}
        <div className="p-3 sm:p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">Special Requests</label>
              <textarea
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                className="textarea textarea-bordered textarea-sm w-full bg-white rounded-md"
                rows={2}
              />
            </div>
            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">Internal Staff Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="textarea textarea-bordered textarea-sm w-full bg-white rounded-md"
                rows={2}
              />
            </div>
          </div>

          {/* Pricing Details */}
          <div className="p-3 rounded-md bg-white border border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>
                Nightly Rate ({pricing.numNights} night{pricing.numNights > 1 ? "s" : ""} @ {formatCurrency(pricing.nightlyRate)}):
              </span>
              <span className="font-mono">{formatCurrency(pricing.baseSubtotal)}</span>
            </div>
            {pricing.addOnsSubtotal > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Add-On Services & Extras:</span>
                <span className="font-mono font-bold text-emerald-800">
                  +{formatCurrency(pricing.addOnsSubtotal)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Taxes & Fees (7.5%):</span>
              <span className="font-mono">{formatCurrency(pricing.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Paid to Date:</span>
              <span className="font-mono text-emerald-700">-{formatCurrency(pricing.paidAmount)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-100">
              <span>Balance Due:</span>
              <span className="text-emerald-700 font-mono font-black">{formatCurrency(pricing.balanceDue)}</span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-sm px-5 font-bold"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
