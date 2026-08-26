"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { RV_TYPES } from "@/lib/constants";
import { calculatePricing } from "@/lib/utils/pricing";
import { formatCurrency, formatRvType } from "@/lib/utils/format";
import { Loader2 } from "lucide-react";

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
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [pets, setPets] = useState(0);
  const [discountCode, setDiscountCode] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [notes, setNotes] = useState("");

  // Guest Details
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [rvType, setRvType] = useState<string>("travel_trailer");
  const [rvLengthFt, setRvLengthFt] = useState<number>(30);
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
    if (initialDate) {
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
      maxWidth="max-w-4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Dates & Site Selection */}
        <div className="p-4 rounded-xl bg-base-200/50 border border-base-200 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/70">
            1. Site & Dates
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label text-xs font-semibold py-1">Site</label>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="select select-bordered select-sm w-full font-medium"
                required
              >
                <option value="" disabled>Select Site</option>
                {sites.map((s) => (
                  <option key={s._id} value={s._id}>
                    Site {s.siteNumber} - {s.siteTypeSnapshot?.name} ({formatCurrency(s.currentBaseRate)}/nt)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label text-xs font-semibold py-1">Check-In Date</label>
              <input
                type="date"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
                className="input input-bordered input-sm w-full font-medium"
                required
              />
            </div>

            <div>
              <label className="label text-xs font-semibold py-1">Check-Out Date</label>
              <input
                type="date"
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                className="input input-bordered input-sm w-full font-medium"
                min={checkInDate}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-1">
            <div>
              <label className="label text-xs font-semibold py-1">Adults</label>
              <input
                type="number"
                min={1}
                max={12}
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                className="input input-bordered input-sm w-full"
              />
            </div>
            <div>
              <label className="label text-xs font-semibold py-1">Children</label>
              <input
                type="number"
                min={0}
                max={10}
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
                className="input input-bordered input-sm w-full"
              />
            </div>
            <div>
              <label className="label text-xs font-semibold py-1">Pets</label>
              <input
                type="number"
                min={0}
                max={6}
                value={pets}
                onChange={(e) => setPets(Number(e.target.value))}
                className="input input-bordered input-sm w-full"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Guest Information */}
        <div className="p-4 rounded-xl bg-base-200/50 border border-base-200 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/70">
            2. Guest Profile & Rig Specs
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label text-xs font-semibold py-1">First Name</label>
              <input
                type="text"
                placeholder="John"
                value={guestFirstName}
                onChange={(e) => setGuestFirstName(e.target.value)}
                className="input input-bordered input-sm w-full"
                required
              />
            </div>
            <div>
              <label className="label text-xs font-semibold py-1">Last Name</label>
              <input
                type="text"
                placeholder="Doe"
                value={guestLastName}
                onChange={(e) => setGuestLastName(e.target.value)}
                className="input input-bordered input-sm w-full"
                required
              />
            </div>
            <div>
              <label className="label text-xs font-semibold py-1">Email Address</label>
              <input
                type="email"
                placeholder="guest@example.com"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="input input-bordered input-sm w-full"
                required
              />
            </div>
            <div>
              <label className="label text-xs font-semibold py-1">Phone Number</label>
              <input
                type="tel"
                placeholder="(555) 000-0000"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="input input-bordered input-sm w-full"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-base-200">
            <div>
              <label className="label text-xs font-semibold py-1">RV / Rig Type</label>
              <select
                value={rvType}
                onChange={(e) => setRvType(e.target.value)}
                className="select select-bordered select-sm w-full"
              >
                {RV_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {formatRvType(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs font-semibold py-1">Rig Length (ft)</label>
              <input
                type="number"
                min={0}
                max={60}
                value={rvLengthFt}
                onChange={(e) => setRvLengthFt(Number(e.target.value))}
                className="input input-bordered input-sm w-full font-mono"
              />
            </div>
            <div>
              <label className="label text-xs font-semibold py-1">License Plate (optional)</label>
              <input
                type="text"
                placeholder="CO-123X"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                className="input input-bordered input-sm w-full uppercase"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Billing & Optional Payment */}
        <div className="p-4 rounded-xl border border-base-200 bg-base-100 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/70">
              3. Rate & Payment
            </h4>
            <div className="text-right">
              <span className="text-xs text-base-content/60">{pricing.numNights} Nights • Total: </span>
              <span className="text-base font-bold text-emerald-600">
                {formatCurrency(pricing.totalAmount)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label text-xs font-semibold py-1">Discount Code (optional)</label>
              <input
                type="text"
                placeholder="GOODSAM, MILITARY"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                className="input input-bordered input-sm w-full uppercase"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="cursor-pointer label justify-start gap-3 py-1">
                <input
                  type="checkbox"
                  checked={collectPaymentNow}
                  onChange={(e) => setCollectPaymentNow(e.target.checked)}
                  className="checkbox checkbox-primary checkbox-sm"
                />
                <span className="label-text font-medium text-xs">
                  Collect Full Payment Now ({formatCurrency(pricing.totalAmount)})
                </span>
              </label>
            </div>
          </div>

          {collectPaymentNow && (
            <div className="p-3 rounded-lg bg-base-200/50 flex items-center gap-4">
              <span className="text-xs font-semibold">Payment Method:</span>
              <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
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
              <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
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
              <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
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
        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary btn-sm min-w-[140px] shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Booking"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
