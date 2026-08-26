"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { RV_TYPES } from "@/lib/constants";
import { calculatePricing } from "@/lib/utils/pricing";
import { formatCurrency, formatRvType } from "@/lib/utils/format";
import { Loader2, Calendar, User, CreditCard, MapPin, Truck } from "lucide-react";

interface NewReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialSiteId?: string;
  initialDate?: string;
}

export function NewReservationModal({
  isOpen,
  onClose,
  onSuccess,
  initialSiteId,
  initialDate,
}: NewReservationModalProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState<any[]>([]);

  // Form State
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [siteId, setSiteId] = useState(initialSiteId || "");
  const [checkInDate, setCheckInDate] = useState(initialDate || today);
  const [checkOutDate, setCheckOutDate] = useState(tomorrow);
  const [adults, setAdults] = useState<number | string>(2);
  const [children, setChildren] = useState<number | string>(0);
  const [pets, setPets] = useState<number | string>(0);
  const [discountCode, setDiscountCode] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [notes, setNotes] = useState("");

  // Guest Details
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [rvType, setRvType] = useState<string>("travel_trailer");
  const [rvLengthFt, setRvLengthFt] = useState<number | string>(30);
  const [licensePlate, setLicensePlate] = useState("");

  // Payment details
  const [collectPaymentNow, setCollectPaymentNow] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("credit_card");

  // Load sites
  useEffect(() => {
    if (isOpen) {
      apiClient.get("/api/sites?status=available").then((res) => {
        if (res.data?.success) {
          setSites(res.data.data);
          if (!siteId && res.data.data.length > 0) {
            setSiteId(res.data.data[0]._id);
          }
        }
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialSiteId) setSiteId(initialSiteId);
    if (initialDate && !isNaN(new Date(initialDate + "T00:00:00Z").getTime())) {
      setCheckInDate(initialDate);
      const dOut = new Date(new Date(initialDate + "T00:00:00Z").getTime() + 2 * 24 * 60 * 60 * 1000);
      setCheckOutDate(dOut.toISOString().split("T")[0]);
    }
  }, [initialSiteId, initialDate]);

  // Selected site pricing estimate
  const selectedSite = sites.find((s) => s._id === siteId);
  const pricing = calculatePricing({
    nightlyRate: selectedSite?.currentBaseRate || 50,
    checkInDate,
    checkOutDate: checkOutDate > checkInDate ? checkOutDate : checkInDate,
    taxRatePercent: 7.5,
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
        discountCode: discountCode || undefined,
        specialRequests,
        notes,
        source: "admin",
        guest: {
          firstName: guestFirstName,
          lastName: guestLastName,
          email: guestEmail,
          phone: guestPhone,
          rvType,
          rvLengthFt: Number(rvLengthFt),
          licensePlate,
        },
      };

      if (collectPaymentNow) {
        payload.initialPayment = {
          amount: pricing.totalAmount,
          method: paymentMethod,
          notes: "Collected at reservation creation",
        };
      }

      const res = await apiClient.post("/api/reservations", payload);
      if (res.data?.success) {
        success(`Reservation ${res.data.data.confirmationCode} created!`);
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
      subtitle="Book a site and record camper details"
      maxWidth="max-w-2xl"
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
              className="select select-bordered select-sm w-full font-medium bg-white rounded-md text-xs sm:text-sm"
              required
            >
              <option value="" disabled>Select a site...</option>
              {sites.map((s) => (
                <option key={s._id} value={s._id}>
                  Site {s.siteNumber} — {s.siteTypeSnapshot?.name || "Standard"} ({formatCurrency(s.currentBaseRate)}/nt)
                </option>
              ))}
            </select>
          </div>

          {/* Check-In / Check-Out Grid */}
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
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-200/60">
            <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            2. Guest Profile & Rig Specs
          </div>

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

        {/* Section 3: Billing & Optional Payment */}
        <div className="p-3 sm:p-4 rounded-lg border border-slate-200 bg-white space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700">
              <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              3. Rate & Payment
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500">{pricing.numNights} Nights • Total: </span>
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
                  Collect Full Payment Now ({formatCurrency(pricing.totalAmount)})
                </span>
              </label>
            </div>
          </div>

          {collectPaymentNow && (
            <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-700">Method:</span>
              <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="pm"
                  value="credit_card"
                  checked={paymentMethod === "credit_card"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="radio radio-primary radio-xs"
                />
                Credit Card
              </label>
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
