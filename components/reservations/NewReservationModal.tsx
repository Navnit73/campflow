"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { RV_TYPES } from "@/lib/constants";
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
  AlertCircle,
  Sparkles,
  Plus,
  Minus,
  Check,
} from "lucide-react";

interface NewReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialSiteId?: string;
  initialDate?: string;
  initialGuest?: any;
}

export function NewReservationModal({
  isOpen,
  onClose,
  onSuccess,
  initialSiteId,
  initialDate,
  initialGuest,
}: NewReservationModalProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState<any[]>([]);
  const [existingGuests, setExistingGuests] = useState<any[]>([]);
  const [availableAddOns, setAvailableAddOns] = useState<any[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, { isAvailable: boolean; conflictReason: string | null }>>({});

  // Guest Mode: 'new' or 'existing'
  const [guestMode, setGuestMode] = useState<"new" | "existing">("new");
  const [selectedGuestId, setSelectedGuestId] = useState<string>("");

  // Form State
  const today = formatDateKey(new Date());
  const tomorrow = addDaysStr(today, 1);

  const [siteId, setSiteId] = useState(initialSiteId || "");
  const [checkInDate, setCheckInDate] = useState(initialDate || today);
  const [checkOutDate, setCheckOutDate] = useState(tomorrow);
  const [adults, setAdults] = useState<number | string>(2);
  const [children, setChildren] = useState<number | string>(0);
  const [pets, setPets] = useState<number | string>(0);
  const [discountCode, setDiscountCode] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [notes, setNotes] = useState("");

  // Selected Add-Ons State: { [addOnId]: quantity }
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});

  // Guest Details
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [rvType, setRvType] = useState<string>("travel_trailer");
  const [rvLengthFt, setRvLengthFt] = useState<number | string>(30);
  const [licensePlate, setLicensePlate] = useState("");

  // Payment details (Offline only)
  const [collectPaymentNow, setCollectPaymentNow] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("credit_card");

  // Load sites, guests & active add-ons
  useEffect(() => {
    if (isOpen) {
      apiClient.get("/api/sites").then((res) => {
        if (res.data?.success) {
          setSites(res.data.data);
          if (!siteId && res.data.data.length > 0) {
            setSiteId(res.data.data[0]._id);
          }
        }
      });

      apiClient.get("/api/guests?limit=100").then((res) => {
        if (res.data?.success) {
          setExistingGuests(res.data.data.guests || []);
        }
      });

      apiClient.get("/api/addons?isActive=true").then((res) => {
        if (res.data?.success) {
          setAvailableAddOns(res.data.data || []);
        }
      });
    }
  }, [isOpen]);

  // Query site availability for chosen dates
  useEffect(() => {
    if (isOpen && checkInDate && checkOutDate && checkOutDate > checkInDate) {
      apiClient
        .get("/api/reservations/availability", {
          params: { checkInDate, checkOutDate },
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
  }, [isOpen, checkInDate, checkOutDate]);

  const handleCheckInChange = (newIn: string) => {
    setCheckInDate(newIn);
    if (!checkOutDate || checkOutDate <= newIn) {
      setCheckOutDate(addDaysStr(newIn, 1));
    }
  };

  useEffect(() => {
    if (initialSiteId) setSiteId(initialSiteId);
    if (initialDate && !isNaN(new Date(initialDate + "T00:00:00Z").getTime())) {
      setCheckInDate(initialDate);
      setCheckOutDate(addDaysStr(initialDate, 2));
    }
    if (initialGuest) {
      setGuestMode("existing");
      setSelectedGuestId(initialGuest._id);
      setGuestFirstName(initialGuest.firstName);
      setGuestLastName(initialGuest.lastName);
      setGuestEmail(initialGuest.email);
      setGuestPhone(initialGuest.phone);
      if (initialGuest.rvDetails) {
        setRvType(initialGuest.rvDetails.type || "travel_trailer");
        setRvLengthFt(initialGuest.rvDetails.lengthFt ?? 30);
        setLicensePlate(initialGuest.rvDetails.licensePlate || "");
      }
    }
  }, [initialSiteId, initialDate, initialGuest]);

  const handleSelectExistingGuest = (id: string) => {
    setSelectedGuestId(id);
    const g = existingGuests.find((guest) => guest._id === id);
    if (g) {
      setGuestFirstName(g.firstName);
      setGuestLastName(g.lastName);
      setGuestEmail(g.email);
      setGuestPhone(g.phone);
      if (g.rvDetails) {
        setRvType(g.rvDetails.type || "travel_trailer");
        setRvLengthFt(g.rvDetails.lengthFt ?? 30);
        setLicensePlate(g.rvDetails.licensePlate || "");
      }
    }
  };

  const handleToggleAddOn = (addOnId: string) => {
    setSelectedAddOns((prev) => {
      const current = prev[addOnId] || 0;
      if (current > 0) {
        const next = { ...prev };
        delete next[addOnId];
        return next;
      }
      return { ...prev, [addOnId]: 1 };
    });
  };

  const handleUpdateAddOnQty = (addOnId: string, delta: number) => {
    setSelectedAddOns((prev) => {
      const current = prev[addOnId] || 0;
      const nextVal = Math.max(0, current + delta);
      if (nextVal === 0) {
        const next = { ...prev };
        delete next[addOnId];
        return next;
      }
      return { ...prev, [addOnId]: nextVal };
    });
  };

  // Build applied addOns for pricing
  const appliedAddOns = availableAddOns
    .filter((a) => (selectedAddOns[a._id] || 0) > 0)
    .map((a) => ({
      addOnId: a._id,
      name: a.name,
      price: a.price,
      pricingType: a.pricingType,
      quantity: selectedAddOns[a._id],
      taxable: a.taxable,
    }));

  // Selected site pricing estimate & compatibility
  const selectedSite = sites.find((s) => s._id === siteId);
  const maxRig = selectedSite?.siteTypeSnapshot?.maxRigLength ?? 45;
  const isLengthIncompatible = Number(rvLengthFt) > maxRig;
  const isSiteAvailable = availabilityMap[siteId]?.isAvailable ?? true;
  const conflictReason = availabilityMap[siteId]?.conflictReason;

  const pricing = calculatePricing({
    nightlyRate: selectedSite?.currentBaseRate || 50,
    checkInDate,
    checkOutDate: checkOutDate > checkInDate ? checkOutDate : checkInDate,
    adults: Number(adults) || 2,
    taxRatePercent: 7.5,
    addOns: appliedAddOns,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId) {
      error("Please select a site");
      return;
    }
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
        addOns: appliedAddOns,
        discountCode: discountCode || undefined,
        specialRequests,
        notes,
        source: "admin",
      };

      if (guestMode === "existing" && selectedGuestId) {
        payload.guestId = selectedGuestId;
      } else {
        payload.guest = {
          firstName: guestFirstName,
          lastName: guestLastName,
          email: guestEmail,
          phone: guestPhone,
          rvType,
          rvLengthFt: Number(rvLengthFt),
          licensePlate,
        };
      }

      if (collectPaymentNow) {
        payload.initialPayment = {
          amount: pricing.totalAmount,
          method: paymentMethod,
          notes: "Collected at front desk reservation creation",
        };
      }

      const res = await apiClient.post("/api/reservations", payload);
      if (res.data?.success) {
        success(`Reservation ${res.data.data.confirmationCode} created successfully!`);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      error(err?.message || "Failed to create reservation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Reservation"
      subtitle="Book a campground site, attach services, and record camper details"
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1: Site & Dates */}
        <div className="p-3 sm:p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-200/60">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            1. Site & Stay Dates
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
              <option value="" disabled>Select a site...</option>
              {sites.map((s) => {
                const avail = availabilityMap[s._id];
                const isAvail = avail ? avail.isAvailable : s.status === "available";
                const labelSuffix = avail
                  ? isAvail
                    ? "✓ Available"
                    : `✗ ${avail.conflictReason || "Unavailable"}`
                  : "";

                return (
                  <option key={s._id} value={s._id} disabled={avail && !isAvail}>
                    Site {s.siteNumber} — {s.siteTypeSnapshot?.name || "Standard"} ({formatCurrency(s.currentBaseRate)}/nt) {labelSuffix ? `• ${labelSuffix}` : ""}
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
                Site {selectedSite?.siteNumber} is {conflictReason || "unavailable for the selected dates"}.
              </span>
            </div>
          )}

          {/* Compatibility Alert */}
          {isLengthIncompatible && (
            <div className="p-2.5 rounded-md bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-800 font-medium">
              <span className="font-bold">⚠️ Warning:</span>
              <span>
                Camper rig length ({rvLengthFt}ft) exceeds Site {selectedSite?.siteNumber} clearance ({maxRig}ft).
              </span>
            </div>
          )}

          {/* Check-In / Check-Out Grid */}
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

          {/* Occupancy counts */}
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
                className="input input-bordered input-sm w-full bg-white rounded-md font-mono text-center sm:text-left"
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
                className="input input-bordered input-sm w-full bg-white rounded-md font-mono text-center sm:text-left"
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
                className="input input-bordered input-sm w-full bg-white rounded-md font-mono text-center sm:text-left"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Guest Information */}
        <div className="p-3 sm:p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-200/60">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700">
              <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              2. Guest Profile & Rig Specs
            </div>

            {/* Mode Switcher */}
            <div className="join">
              <button
                type="button"
                onClick={() => setGuestMode("new")}
                className={`btn btn-xs join-item font-bold ${
                  guestMode === "new" ? "bg-emerald-600 text-white" : "btn-ghost text-slate-600"
                }`}
              >
                New Guest
              </button>
              <button
                type="button"
                onClick={() => setGuestMode("existing")}
                className={`btn btn-xs join-item font-bold ${
                  guestMode === "existing" ? "bg-emerald-600 text-white" : "btn-ghost text-slate-600"
                }`}
              >
                Existing CRM Guest
              </button>
            </div>
          </div>

          {guestMode === "existing" && (
            <div>
              <label className="label text-xs font-bold text-slate-700 py-0.5">Select Existing Guest</label>
              <select
                value={selectedGuestId}
                onChange={(e) => handleSelectExistingGuest(e.target.value)}
                className="select select-bordered select-sm w-full bg-white font-medium rounded-md"
                required={guestMode === "existing"}
              >
                <option value="" disabled>Select from {existingGuests.length} campers...</option>
                {existingGuests.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.firstName} {g.lastName} — {g.email} ({g.phone})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">First Name</label>
              <input
                type="text"
                placeholder="John"
                value={guestFirstName}
                onChange={(e) => setGuestFirstName(e.target.value)}
                className="input input-bordered input-sm w-full bg-white rounded-md"
                required
              />
            </div>
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Last Name</label>
              <input
                type="text"
                placeholder="Doe"
                value={guestLastName}
                onChange={(e) => setGuestLastName(e.target.value)}
                className="input input-bordered input-sm w-full bg-white rounded-md"
                required
              />
            </div>
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Email Address</label>
              <input
                type="email"
                placeholder="guest@example.com"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="input input-bordered input-sm w-full bg-white rounded-md"
                required
              />
            </div>
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Phone Number</label>
              <input
                type="tel"
                placeholder="(555) 000-0000"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="input input-bordered input-sm w-full font-mono bg-white rounded-md"
                required
              />
            </div>
          </div>

          {/* Rig info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-200/60">
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">RV / Rig Type</label>
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
              <label className="label text-xs font-bold text-slate-700 py-0.5">Length (ft)</label>
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
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">License Plate (opt)</label>
              <input
                type="text"
                placeholder="CO-123X"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                className="input input-bordered input-sm w-full uppercase bg-white font-mono rounded-md"
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
              {appliedAddOns.length > 0 && (
                <span className="badge badge-success badge-xs font-mono font-bold text-[10px] text-white">
                  +{formatCurrency(pricing.addOnsSubtotal)} Added
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {availableAddOns.map((addon) => {
                const qty = selectedAddOns[addon._id] || 0;
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
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {addon.name}
                        </span>
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
                            onClick={() => handleUpdateAddOnQty(addon._id, -1)}
                            className="btn btn-ghost btn-xs btn-circle h-6 w-6 text-slate-600 hover:text-slate-900"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center font-mono font-bold text-xs text-emerald-800">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateAddOnQty(addon._id, 1)}
                            className="btn btn-ghost btn-xs btn-circle h-6 w-6 text-slate-600 hover:text-slate-900"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleAddOn(addon._id)}
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

        {/* Section 4: Billing & Optional Offline Payment */}
        <div className="p-3 sm:p-4 rounded-lg border border-slate-200 bg-white space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700">
              <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              4. Rate & Offline Payment
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 font-mono">
                {pricing.numNights} Nights @ {formatCurrency(pricing.nightlyRate)}
                {pricing.addOnsSubtotal > 0 && ` + ${formatCurrency(pricing.addOnsSubtotal)} Services`} • Total:{" "}
              </span>
              <span className="text-base font-black text-emerald-700 font-mono">
                {formatCurrency(pricing.totalAmount)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Discount Code (optional)</label>
              <input
                type="text"
                placeholder="GOODSAM, MILITARY"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                className="input input-bordered input-sm w-full uppercase font-mono rounded-md"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="cursor-pointer label justify-start gap-2.5 py-1">
                <input
                  type="checkbox"
                  checked={collectPaymentNow}
                  onChange={(e) => setCollectPaymentNow(e.target.checked)}
                  className="checkbox checkbox-primary checkbox-sm rounded"
                />
                <span className="label-text font-bold text-xs text-slate-800">
                  Collect Payment Now ({formatCurrency(pricing.totalAmount)})
                </span>
              </label>
            </div>
          </div>

          {collectPaymentNow && (
            <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-700">Manual Method:</span>
              <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="pm"
                  value="cash"
                  checked={paymentMethod === "cash"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="radio radio-primary radio-xs"
                />
                Cash
              </label>
              <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="pm"
                  value="check"
                  checked={paymentMethod === "check"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="radio radio-primary radio-xs"
                />
                Check
              </label>
              <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="pm"
                  value="credit_card"
                  checked={paymentMethod === "credit_card"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="radio radio-primary radio-xs"
                />
                Card (POS Terminal)
              </label>
              <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="pm"
                  value="bank_transfer"
                  checked={paymentMethod === "bank_transfer"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="radio radio-primary radio-xs"
                />
                Bank Transfer
              </label>
            </div>
          )}
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Booking"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
