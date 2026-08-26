"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import apiClient from "@/lib/axios/client";
import { HookupIcons } from "@/components/ui/HookupIcons";
import { RV_TYPES } from "@/lib/constants";
import { formatCurrency, formatDate, formatRvType } from "@/lib/utils/format";
import { formatDateKey, addDaysStr } from "@/lib/utils/date";
import { calculatePricing } from "@/lib/utils/pricing";
import {
  Trees,
  Search,
  Calendar,
  Truck,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  ChevronRight,
  Phone,
  Mail,
  Inbox,
  AlertCircle,
  Sparkles,
  Plus,
  Minus,
  Flame,
  Zap,
  Wifi,
  Package,
  Clock,
  Coffee,
  Shield,
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  sparkles: Sparkles,
  flame: Flame,
  truck: Truck,
  zap: Zap,
  wifi: Wifi,
  package: Package,
  clock: Clock,
  coffee: Coffee,
  shield: Shield,
  map: MapPin,
};

export default function PublicBookingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || "campflow-rv-resort";

  // Step state: 1 = Search, 2 = Select Site, 3 = Guest Info & Pay
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Search parameters
  const todayStr = formatDateKey(new Date());
  const defaultOut = addDaysStr(todayStr, 2);

  const [checkInDate, setCheckInDate] = useState(todayStr);
  const [checkOutDate, setCheckOutDate] = useState(defaultOut);
  const [rvType, setRvType] = useState("travel_trailer");
  const [rigLengthFt, setRigLengthFt] = useState<number | string>(30);
  const [hookupType, setHookupType] = useState<string>("any");
  const [adults, setAdults] = useState<number | string>(2);
  const [children, setChildren] = useState<number | string>(0);
  const [pets, setPets] = useState<number | string>(0);

  // Results & Selection
  const [property, setProperty] = useState<any | null>(null);
  const [availableSites, setAvailableSites] = useState<any[]>([]);
  const [availableAddOns, setAvailableAddOns] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState<any | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Guest details form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");

  const handleCheckInChange = (newInDate: string) => {
    setCheckInDate(newInDate);
    if (!checkOutDate || checkOutDate <= newInDate) {
      setCheckOutDate(addDaysStr(newInDate, 1));
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (checkOutDate <= checkInDate) {
      setErrorMsg("Check-out date must be after check-in date.");
      return;
    }

    setErrorMsg("");
    setSearching(true);
    try {
      const res = await apiClient.get("/api/public/book/availability", {
        params: {
          slug,
          checkInDate,
          checkOutDate,
          rvType,
          rigLengthFt: Number(rigLengthFt || 30),
          hookupType: hookupType !== "any" ? hookupType : undefined,
          adults: Number(adults || 2),
          children: Number(children || 0),
          pets: Number(pets || 0),
        },
      });

      if (res.data?.success) {
        setProperty(res.data.data.property);
        setAvailableSites(res.data.data.availableSites || []);
        setAvailableAddOns(res.data.data.availableAddOns || []);
        setStep(2);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to find available sites. Please check your dates.");
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    apiClient
      .get("/api/public/book/availability", {
        params: {
          slug,
          checkInDate,
          checkOutDate,
          rvType,
          rigLengthFt: Number(rigLengthFt || 30),
        },
      })
      .then((res) => {
        if (res.data?.success) {
          setProperty(res.data.data.property);
          setAvailableSites(res.data.data.availableSites || []);
          setAvailableAddOns(res.data.data.availableAddOns || []);
        }
      })
      .catch(() => {});
  }, [slug]);

  const handleSelectSite = (site: any) => {
    setSelectedSite(site);
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleAddOn = (addonId: string) => {
    setSelectedAddOns((prev) => {
      const cur = prev[addonId] || 0;
      if (cur > 0) {
        const next = { ...prev };
        delete next[addonId];
        return next;
      }
      return { ...prev, [addonId]: 1 };
    });
  };

  const handleUpdateAddOnQty = (addonId: string, delta: number) => {
    setSelectedAddOns((prev) => {
      const cur = prev[addonId] || 0;
      const nextVal = Math.max(0, cur + delta);
      if (nextVal === 0) {
        const next = { ...prev };
        delete next[addonId];
        return next;
      }
      return { ...prev, [addonId]: nextVal };
    });
  };

  // Build applied add-ons
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

  // Dynamic calculated pricing with Add-Ons
  const dynamicPricing = selectedSite
    ? calculatePricing({
        nightlyRate: selectedSite.currentBaseRate,
        checkInDate,
        checkOutDate,
        adults: Number(adults || 2),
        taxRatePercent: property?.taxRatePercent || 7.5,
        addOns: appliedAddOns,
      })
    : null;

  const handleCompleteBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSite) return;

    setErrorMsg("");
    setSubmitting(true);
    try {
      const payload = {
        slug,
        siteId: selectedSite._id,
        checkInDate,
        checkOutDate,
        adults: Number(adults || 2),
        children: Number(children || 0),
        pets: Number(pets || 0),
        addOns: appliedAddOns,
        discountCode: discountCode || undefined,
        guest: {
          firstName,
          lastName,
          email,
          phone,
          rvType,
          rvLengthFt: Number(rigLengthFt),
          licensePlate,
        },
        specialRequests,
        paymentMethod: "credit_card",
      };

      const res = await apiClient.post("/api/public/book/create", payload);
      if (res.data?.success) {
        const code = res.data.data.confirmationCode;
        router.push(`/book/${slug}/confirmation/${code}`);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Booking submission failed. Please try again.";
      setErrorMsg(msg);
      if (
        err?.response?.status === 409 ||
        msg.includes("booked") ||
        msg.includes("available")
      ) {
        handleSearch();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold">
              <Trees className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-black text-base leading-tight text-slate-900">
                {property?.name || "CampFlow RV Resort"}
              </h1>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-emerald-600" />
                {property?.address?.city || "Mountain View"}, {property?.address?.state || "CO"}
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3.5 text-xs font-bold text-slate-600">
            {property?.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-emerald-600" />
                {property.phone}
              </span>
            )}
            {property?.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3 text-emerald-600" />
                {property.email}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl w-full mx-auto px-4 py-6 flex-1 space-y-5">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold">
          <button
            onClick={() => setStep(1)}
            className={`px-3 py-1.5 rounded-md transition-all ${
              step === 1
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            1. Dates & Rig
          </button>
          <span className="text-slate-300">→</span>
          <button
            onClick={() => setStep(2)}
            disabled={!property}
            className={`px-3 py-1.5 rounded-md transition-all ${
              step === 2
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
            }`}
          >
            2. Select Site
          </button>
          <span className="text-slate-300">→</span>
          <button
            disabled={!selectedSite}
            className={`px-3 py-1.5 rounded-md transition-all ${
              step === 3
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
            }`}
          >
            3. Extras & Checkout
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: Search Form */}
        {step === 1 && (
          <div className="surface-card p-5 sm:p-6 rounded-lg space-y-5 border border-slate-200">
            <div className="border-b border-slate-100 pb-2.5">
              <h2 className="text-lg font-black tracking-tight text-slate-900">
                Book Your RV Site or Campsite
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select your dates, rig dimensions, and hookup preferences to check live availability
              </p>
            </div>

            <form onSubmit={handleSearch} className="space-y-4">
              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs font-bold text-slate-700 py-0.5">Check-In Date</label>
                  <input
                    type="date"
                    value={checkInDate}
                    onChange={(e) => handleCheckInChange(e.target.value)}
                    min={todayStr}
                    className="input input-bordered input-sm w-full font-medium rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="label text-xs font-bold text-slate-700 py-0.5">Check-Out Date</label>
                  <input
                    type="date"
                    value={checkOutDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                    min={addDaysStr(checkInDate, 1)}
                    className="input input-bordered input-sm w-full font-medium rounded-md"
                    required
                  />
                </div>
              </div>

              {/* Rig Specifications */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-emerald-600" />
                  Your RV & Camping Equipment
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label text-xs font-bold text-slate-700 py-0.5">Equipment Type</label>
                    <select
                      value={rvType}
                      onChange={(e) => setRvType(e.target.value)}
                      className="select select-bordered select-sm w-full bg-white font-medium rounded-md"
                    >
                      {RV_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {formatRvType(t)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label text-xs font-bold text-slate-700 py-0.5">Length (Total Feet)</label>
                    <input
                      type="number"
                      min={0}
                      max={55}
                      value={rigLengthFt}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setRigLengthFt(e.target.value === "" ? "" : Number(e.target.value))}
                      className="input input-bordered input-sm w-full font-mono font-bold bg-white rounded-md"
                    />
                  </div>

                  <div>
                    <label className="label text-xs font-bold text-slate-700 py-0.5">Hookup Preference</label>
                    <select
                      value={hookupType}
                      onChange={(e) => setHookupType(e.target.value)}
                      className="select select-bordered select-sm w-full bg-white font-medium rounded-md"
                    >
                      <option value="any">Any Available Hookup</option>
                      <option value="50A">50 Amp Service</option>
                      <option value="30A">30 Amp Service</option>
                      <option value="full">Full Hookup (Water + Sewer + Power)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Guests Count */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label text-xs font-bold text-slate-700 py-0.5">Adults</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={adults}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setAdults(e.target.value === "" ? "" : Number(e.target.value))}
                    className="input input-bordered input-sm w-full rounded-md"
                  />
                </div>
                <div>
                  <label className="label text-xs font-bold text-slate-700 py-0.5">Children</label>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={children}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setChildren(e.target.value === "" ? "" : Number(e.target.value))}
                    className="input input-bordered input-sm w-full rounded-md"
                  />
                </div>
                <div>
                  <label className="label text-xs font-bold text-slate-700 py-0.5">Pets</label>
                  <input
                    type="number"
                    min={0}
                    max={4}
                    value={pets}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setPets(e.target.value === "" ? "" : Number(e.target.value))}
                    className="input input-bordered input-sm w-full rounded-md"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={searching}
                className="btn btn-primary w-full gap-2 font-bold text-xs rounded-md mt-1"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Find Available Sites
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: Site Selection */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-lg surface-card border border-slate-200">
              <div>
                <span className="text-xs text-slate-500 font-semibold">Selected Dates:</span>
                <div className="font-bold text-sm text-slate-900">
                  {formatDate(checkInDate)} → {formatDate(checkOutDate)}
                </div>
              </div>
              <button onClick={() => setStep(1)} className="btn btn-outline btn-xs font-bold text-xs rounded-md">
                Change Dates
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-base text-slate-900">
                Available Sites ({availableSites.length})
              </h3>

              {availableSites.length === 0 ? (
                <div className="surface-card p-10 rounded-lg text-center space-y-2.5 border border-slate-200">
                  <div className="w-10 h-10 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Inbox className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    No sites available matching your criteria for these dates.
                  </p>
                  <button onClick={() => setStep(1)} className="btn btn-primary btn-sm mx-auto font-bold rounded-md">
                    Try Different Dates
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {availableSites.map((site) => (
                    <div
                      key={site._id}
                      className="surface-card rounded-lg hover:border-emerald-500 transition-all p-4 flex flex-col justify-between space-y-3 border border-slate-200"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="badge badge-xs font-mono font-bold bg-slate-100 text-slate-800 border-slate-200 rounded">
                              Site {site.siteNumber}
                            </span>
                            <h4 className="font-bold text-sm text-slate-900 mt-1">
                              {site.name || `Site ${site.siteNumber}`}
                            </h4>
                            <p className="text-xs text-slate-500 font-medium">
                              {site.siteTypeSnapshot?.name}
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="text-base font-black text-emerald-700 font-mono">
                              {formatCurrency(site.currentBaseRate)}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-medium">/ nt</span>
                          </div>
                        </div>

                        <div className="pt-1">
                          <HookupIcons
                            hookups={site.siteTypeSnapshot?.hookups}
                            rigType={site.rigType}
                            maxRigLength={site.siteTypeSnapshot?.maxRigLength}
                            compact
                          />
                        </div>

                        {site.amenities && site.amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1 text-[10px] text-slate-600 pt-0.5">
                            {site.amenities.slice(0, 3).map((a: string) => (
                              <span key={a} className="badge badge-xs badge-ghost text-[9px] rounded">
                                {a}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-xs">
                          <span className="text-slate-500">Base lodging: </span>
                          <span className="font-black text-slate-900 font-mono">
                            {formatCurrency(site.calculatedPricing?.totalAmount)}
                          </span>
                        </div>

                        <button
                          onClick={() => handleSelectSite(site)}
                          className="btn btn-primary btn-xs sm:btn-sm gap-1 font-bold rounded-md"
                        >
                          Book Site <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Add-Ons, Guest Details & Instant Checkout */}
        {step === 3 && selectedSite && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main Form Column */}
            <div className="lg:col-span-2 space-y-4">
              {/* Optional Add-on Services Section */}
              {availableAddOns.length > 0 && (
                <div className="surface-card p-4 sm:p-5 rounded-lg space-y-3.5 border border-slate-200">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        Enhance Your Stay with Add-On Services
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Select firewood, rentals, early/late check-in, or VIP amenities
                      </p>
                    </div>
                    {appliedAddOns.length > 0 && (
                      <span className="badge badge-success badge-sm font-mono font-bold text-white text-[11px]">
                        +{formatCurrency(dynamicPricing?.addOnsSubtotal || 0)} Added
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {availableAddOns.map((addon) => {
                      const IconComp = ICON_MAP[addon.icon] || Sparkles;
                      const qty = selectedAddOns[addon._id] || 0;
                      const isSelected = qty > 0;

                      return (
                        <div
                          key={addon._id}
                          className={`p-3 rounded-lg border transition-all flex flex-col justify-between space-y-2 ${
                            isSelected
                              ? "bg-emerald-50/50 border-emerald-400 shadow-2xs"
                              : "bg-white border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                              <IconComp className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-xs text-slate-900 leading-snug truncate">
                                {addon.name}
                              </h4>
                              {addon.description && (
                                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                  {addon.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <div className="text-xs font-mono font-bold text-emerald-800">
                              {formatCurrency(addon.price)}{" "}
                              <span className="text-[10px] text-slate-400 font-normal">
                                {addon.pricingType === "per_night"
                                  ? "/ night"
                                  : addon.pricingType === "per_person"
                                  ? "/ person"
                                  : addon.pricingType === "per_unit"
                                  ? "/ item"
                                  : "flat"}
                              </span>
                            </div>

                            {/* Stepper */}
                            <div>
                              {isSelected ? (
                                <div className="flex items-center gap-1 bg-white rounded-md border border-emerald-300 p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateAddOnQty(addon._id, -1)}
                                    className="btn btn-ghost btn-xs btn-circle h-5 w-5 text-slate-600 hover:text-slate-900"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="w-4 text-center font-mono font-bold text-xs text-emerald-800">
                                    {qty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateAddOnQty(addon._id, 1)}
                                    className="btn btn-ghost btn-xs btn-circle h-5 w-5 text-slate-600 hover:text-slate-900"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleAddOn(addon._id)}
                                  className="btn btn-outline btn-xs font-bold text-[11px] text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                                >
                                  + Add
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Guest Form */}
              <div className="surface-card p-5 rounded-lg space-y-4 border border-slate-200">
                <div className="border-b border-slate-100 pb-2.5">
                  <h2 className="text-base font-black tracking-tight text-slate-900">
                    Camper Contact Information
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your reservation confirmation will be sent directly to this email
                  </p>
                </div>

                <form onSubmit={handleCompleteBooking} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs font-bold text-slate-700 py-0.5">First Name</label>
                      <input
                        type="text"
                        placeholder="Marcus"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="input input-bordered input-sm w-full font-medium rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <label className="label text-xs font-bold text-slate-700 py-0.5">Last Name</label>
                      <input
                        type="text"
                        placeholder="Holloway"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="input input-bordered input-sm w-full font-medium rounded-md"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs font-bold text-slate-700 py-0.5">Email Address</label>
                      <input
                        type="email"
                        placeholder="marcus@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input input-bordered input-sm w-full rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <label className="label text-xs font-bold text-slate-700 py-0.5">Mobile Phone</label>
                      <input
                        type="tel"
                        placeholder="(555) 000-0000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="input input-bordered input-sm w-full font-mono rounded-md"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs font-bold text-slate-700 py-0.5">License Plate (optional)</label>
                      <input
                        type="text"
                        placeholder="CO-849X"
                        value={licensePlate}
                        onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                        className="input input-bordered input-sm w-full uppercase font-mono rounded-md"
                      />
                    </div>
                    <div>
                      <label className="label text-xs font-bold text-slate-700 py-0.5">Discount Promo Code</label>
                      <input
                        type="text"
                        placeholder="GOODSAM, MILITARY"
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                        className="input input-bordered input-sm w-full uppercase font-mono rounded-md"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label text-xs font-bold text-slate-700 py-0.5">Special Requests or Arrival Notes</label>
                    <textarea
                      placeholder="Traveling with pets, arriving after 6 PM, etc..."
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                      className="textarea textarea-bordered textarea-sm w-full rounded-md"
                      rows={2}
                    />
                  </div>

                  {/* Instant Mock Payment Gateway */}
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-slate-800">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Instant Secure Checkout (Demo Mode)
                    </div>
                    <p className="text-xs text-slate-600">
                      Payment is automatically authorized and confirmed upon submission.
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="btn btn-ghost btn-xs sm:btn-sm font-semibold text-xs rounded-md"
                    >
                      ← Back to Sites
                    </button>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn btn-primary btn-sm gap-1.5 font-bold px-6 text-xs rounded-md"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Confirm & Book Now ({formatCurrency(dynamicPricing?.totalAmount || 0)})
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Summary Sticky Card */}
            <div className="surface-card p-4 rounded-lg space-y-3 h-fit sticky top-20 border border-slate-200">
              <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
                Booking Summary
              </h3>

              <div className="text-xs space-y-1.5 text-slate-700">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Site:</span>
                  <span className="font-bold font-mono text-slate-900">Site {selectedSite.siteNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Type:</span>
                  <span>{selectedSite.siteTypeSnapshot?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Check-In:</span>
                  <span>{formatDate(checkInDate)} (1:00 PM)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Check-Out:</span>
                  <span>{formatDate(checkOutDate)} (11:00 AM)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Nights:</span>
                  <span className="font-mono">{dynamicPricing?.numNights || 1} nights</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Guests:</span>
                  <span>{adults} Adults, {children} Children</span>
                </div>
              </div>

              {/* Itemized Services in Summary */}
              {appliedAddOns.length > 0 && (
                <div className="border-t border-slate-100 pt-2 text-xs space-y-1">
                  <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                    Selected Extras:
                  </span>
                  {dynamicPricing?.calculatedAddOns.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-slate-600 text-[11px]">
                      <span>
                        {item.name} {item.quantity > 1 ? `(x${item.quantity})` : ""}
                      </span>
                      <span className="font-mono">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Price Totals */}
              <div className="border-t border-slate-100 pt-2.5 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Lodging Subtotal:</span>
                  <span className="font-mono">{formatCurrency(dynamicPricing?.baseSubtotal || 0)}</span>
                </div>

                {dynamicPricing && dynamicPricing.addOnsSubtotal > 0 && (
                  <div className="flex justify-between text-emerald-800 font-semibold">
                    <span>Add-On Services:</span>
                    <span className="font-mono">+{formatCurrency(dynamicPricing.addOnsSubtotal)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-slate-500">Taxes (7.5%):</span>
                  <span className="font-mono">+{formatCurrency(dynamicPricing?.taxAmount || 0)}</span>
                </div>

                <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-100">
                  <span>Total Due:</span>
                  <span className="text-emerald-700 font-mono font-black">
                    {formatCurrency(dynamicPricing?.totalAmount || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-5 text-center text-xs text-slate-500">
        <p>Powered by CampFlow SaaS • Independent RV Park Management</p>
      </footer>
    </div>
  );
}
