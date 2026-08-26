"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import apiClient from "@/lib/axios/client";
import { HookupIcons } from "@/components/ui/HookupIcons";
import { RV_TYPES } from "@/lib/constants";
import { formatCurrency, formatDate, formatRvType, formatRigType } from "@/lib/utils/format";
import {
  Trees,
  Search,
  Calendar,
  Truck,
  MapPin,
  CheckCircle2,
  CreditCard,
  Zap,
  ArrowRight,
  ShieldCheck,
  Loader2,
  ChevronRight,
  Phone,
  Mail,
} from "lucide-react";

export default function PublicBookingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || "pine-ridge-rv";

  // Step state: 1 = Search, 2 = Select Site, 3 = Guest Info & Pay
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Search parameters
  const todayStr = new Date().toISOString().split("T")[0];
  const defaultOut = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [checkInDate, setCheckInDate] = useState(todayStr);
  const [checkOutDate, setCheckOutDate] = useState(defaultOut);
  const [rvType, setRvType] = useState("travel_trailer");
  const [rigLengthFt, setRigLengthFt] = useState<number>(30);
  const [hookupType, setHookupType] = useState<string>("any");
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);
  const [pets, setPets] = useState<number>(0);

  // Results & Selection
  const [property, setProperty] = useState<any | null>(null);
  const [availableSites, setAvailableSites] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState<any | null>(null);
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

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg("");
    setSearching(true);
    try {
      const res = await apiClient.get("/api/public/book/availability", {
        params: {
          slug,
          checkInDate,
          checkOutDate,
          rvType,
          rigLengthFt,
          hookupType: hookupType !== "any" ? hookupType : undefined,
          adults,
          children,
          pets,
        },
      });

      if (res.data?.success) {
        setProperty(res.data.data.property);
        setAvailableSites(res.data.data.availableSites);
        setStep(2);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to find available sites. Please check your dates.");
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    // Initial fetch to load property information
    apiClient
      .get("/api/public/book/availability", {
        params: { slug, checkInDate, checkOutDate, rvType, rigLengthFt },
      })
      .then((res) => {
        if (res.data?.success) {
          setProperty(res.data.data.property);
          setAvailableSites(res.data.data.availableSites);
        }
      })
      .catch(() => {});
  }, [slug]);

  const handleSelectSite = (site: any) => {
    setSelectedSite(site);
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
        adults,
        children,
        pets,
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
      setErrorMsg(err?.message || "Booking submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200/40 text-base-content flex flex-col justify-between">
      {/* Header */}
      <header className="bg-base-100 border-b border-base-200 sticky top-0 z-30 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <Trees className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight text-base-content">
                {property?.name || "Pine Ridge RV Haven & Campground"}
              </h1>
              <p className="text-xs text-base-content/60 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-600" />
                {property?.address?.city || "Buena Vista"}, {property?.address?.state || "CO"}
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs font-semibold text-base-content/70">
            {property?.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-primary" />
                {property.phone}
              </span>
            )}
            {property?.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-primary" />
                {property.email}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl w-full mx-auto px-4 py-8 flex-1 space-y-6">
        {/* Step Indicator */}
        <div className="steps steps-horizontal w-full text-xs">
          <button
            onClick={() => setStep(1)}
            className={`step ${step >= 1 ? "step-primary font-bold" : ""}`}
          >
            Dates & Rig
          </button>
          <button
            onClick={() => setStep(2)}
            disabled={!property}
            className={`step ${step >= 2 ? "step-primary font-bold" : ""}`}
          >
            Select Site
          </button>
          <button
            disabled={!selectedSite}
            className={`step ${step >= 3 ? "step-primary font-bold" : ""}`}
          >
            Guest Info & Confirm
          </button>
        </div>

        {errorMsg && (
          <div className="alert alert-error text-sm text-error-content shadow-sm rounded-xl">
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: Search Form */}
        {step === 1 && (
          <div className="card bg-base-100 shadow-lg border border-base-200 p-6 sm:p-8 space-y-6">
            <div className="border-b border-base-200 pb-3">
              <h2 className="text-xl font-bold tracking-tight text-base-content">
                Book Your RV Site or Campsite
              </h2>
              <p className="text-xs text-base-content/60 mt-0.5">
                Select your dates, rig dimensions, and hookup preferences to check live availability
              </p>
            </div>

            <form onSubmit={handleSearch} className="space-y-6">
              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label text-xs font-bold py-1">Check-In Date</label>
                  <input
                    type="date"
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    min={todayStr}
                    className="input input-bordered w-full font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="label text-xs font-bold py-1">Check-Out Date</label>
                  <input
                    type="date"
                    value={checkOutDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                    min={checkInDate}
                    className="input input-bordered w-full font-medium"
                    required
                  />
                </div>
              </div>

              {/* Rig Specifications */}
              <div className="p-4 rounded-xl bg-base-200/50 border border-base-200 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-emerald-600" />
                  Your RV & Camping Equipment
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="label text-xs font-semibold py-1">Equipment Type</label>
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
                    <label className="label text-xs font-semibold py-1">Length (Total Feet)</label>
                    <input
                      type="number"
                      min={0}
                      max={55}
                      value={rigLengthFt}
                      onChange={(e) => setRigLengthFt(Number(e.target.value))}
                      className="input input-bordered input-sm w-full font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="label text-xs font-semibold py-1">Hookup Preference</label>
                    <select
                      value={hookupType}
                      onChange={(e) => setHookupType(e.target.value)}
                      className="select select-bordered select-sm w-full"
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
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label text-xs font-semibold py-1">Adults</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
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
                    max={6}
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
                    max={4}
                    value={pets}
                    onChange={(e) => setPets(Number(e.target.value))}
                    className="input input-bordered input-sm w-full"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={searching}
                className="btn btn-primary w-full gap-2 font-bold shadow-md text-base"
              >
                {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                Find Available Sites
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: Site Selection */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-base-100 border border-base-200 shadow-xs">
              <div>
                <span className="text-xs text-base-content/60">Selected Dates:</span>
                <div className="font-bold text-sm text-base-content">
                  {formatDate(checkInDate)} → {formatDate(checkOutDate)}
                </div>
              </div>
              <button onClick={() => setStep(1)} className="btn btn-outline btn-xs font-semibold">
                Change Dates
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-lg text-base-content">
                Available Sites ({availableSites.length})
              </h3>

              {availableSites.length === 0 ? (
                <div className="card bg-base-100 p-12 text-center border border-base-200 space-y-3">
                  <p className="text-sm text-base-content/70">
                    No sites available matching your exact rig length or hookup criteria for these dates.
                  </p>
                  <button onClick={() => setStep(1)} className="btn btn-primary btn-sm mx-auto">
                    Try Different Dates
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableSites.map((site) => (
                    <div
                      key={site._id}
                      className="card bg-base-100 border border-base-200 hover:border-primary shadow-xs transition-all p-5 flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="badge badge-neutral font-mono font-bold text-xs">
                              Site {site.siteNumber}
                            </span>
                            <h4 className="font-bold text-base text-base-content mt-1">
                              {site.name || `Site ${site.siteNumber}`}
                            </h4>
                            <p className="text-xs text-base-content/60">
                              {site.siteTypeSnapshot?.name}
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="text-lg font-black text-emerald-600 font-mono">
                              {formatCurrency(site.currentBaseRate)}
                            </span>
                            <span className="text-[11px] text-base-content/60 block">/ night</span>
                          </div>
                        </div>

                        <div className="pt-2">
                          <HookupIcons
                            hookups={site.siteTypeSnapshot?.hookups}
                            rigType={site.rigType}
                            maxRigLength={site.siteTypeSnapshot?.maxRigLength}
                          />
                        </div>

                        {site.amenities && site.amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1 text-[11px] text-base-content/70 pt-1">
                            {site.amenities.slice(0, 3).map((a: string) => (
                              <span key={a} className="badge badge-xs badge-ghost">
                                {a}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-base-200 flex items-center justify-between">
                        <div className="text-xs">
                          <span className="text-base-content/60">Total with tax: </span>
                          <span className="font-bold text-base-content">
                            {formatCurrency(site.calculatedPricing?.totalAmount)}
                          </span>
                        </div>

                        <button
                          onClick={() => handleSelectSite(site)}
                          className="btn btn-primary btn-sm gap-1.5 font-bold shadow-xs"
                        >
                          Book Site <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Guest Details & Instant Checkout */}
        {step === 3 && selectedSite && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form */}
            <div className="lg:col-span-2 card bg-base-100 shadow-lg border border-base-200 p-6 sm:p-8 space-y-6">
              <div className="border-b border-base-200 pb-3">
                <h2 className="text-xl font-bold tracking-tight text-base-content">
                  Camper Contact Information
                </h2>
                <p className="text-xs text-base-content/60 mt-0.5">
                  Your reservation confirmation will be sent directly to this email
                </p>
              </div>

              <form onSubmit={handleCompleteBooking} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label text-xs font-semibold py-1">First Name</label>
                    <input
                      type="text"
                      placeholder="Marcus"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="input input-bordered input-sm w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="label text-xs font-semibold py-1">Last Name</label>
                    <input
                      type="text"
                      placeholder="Holloway"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="input input-bordered input-sm w-full"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label text-xs font-semibold py-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="marcus@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input input-bordered input-sm w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="label text-xs font-semibold py-1">Mobile Phone</label>
                    <input
                      type="tel"
                      placeholder="(555) 000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input input-bordered input-sm w-full font-mono"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label text-xs font-semibold py-1">License Plate (optional)</label>
                  <input
                    type="text"
                    placeholder="CO-849X"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                    className="input input-bordered input-sm w-full uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="label text-xs font-semibold py-1">Discount Promo Code</label>
                  <input
                    type="text"
                    placeholder="GOODSAM, MILITARY"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                    className="input input-bordered input-sm w-full uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="label text-xs font-semibold py-1">Special Requests or Arrival Notes</label>
                  <textarea
                    placeholder="Traveling with pets, arriving after 6 PM, etc..."
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    className="textarea textarea-bordered textarea-sm w-full"
                    rows={2}
                  />
                </div>

                {/* Instant Mock Payment Gateway */}
                <div className="p-4 rounded-xl bg-base-200/50 border border-base-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-base-content">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Instant Secure Checkout (Demo Mode)
                  </div>
                  <p className="text-xs text-base-content/70">
                    Payment is automatically authorized and confirmed upon submission.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="btn btn-ghost btn-sm"
                  >
                    ← Back to Sites
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary btn-md gap-2 font-bold shadow-md px-8"
                  >
                    {submitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                    Confirm & Book Now
                  </button>
                </div>
              </form>
            </div>

            {/* Summary Card */}
            <div className="card bg-base-100 shadow-md border border-base-200 p-6 space-y-4 h-fit sticky top-20">
              <h3 className="font-bold text-base text-base-content border-b border-base-200 pb-2">
                Booking Summary
              </h3>

              <div className="text-xs space-y-2 text-base-content/80">
                <div className="flex justify-between">
                  <span className="font-semibold text-base-content">Site:</span>
                  <span className="font-bold font-mono">Site {selectedSite.siteNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span>{selectedSite.siteTypeSnapshot?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Check-In:</span>
                  <span>{formatDate(checkInDate)} (1:00 PM)</span>
                </div>
                <div className="flex justify-between">
                  <span>Check-Out:</span>
                  <span>{formatDate(checkOutDate)} (11:00 AM)</span>
                </div>
                <div className="flex justify-between">
                  <span>Nights:</span>
                  <span>{selectedSite.calculatedPricing?.numNights} nights</span>
                </div>
                <div className="flex justify-between">
                  <span>Guests:</span>
                  <span>{adults} Adults, {children} Children</span>
                </div>
              </div>

              <div className="border-t border-base-200 pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-base-content/60">Nightly Rate:</span>
                  <span>{formatCurrency(selectedSite.currentBaseRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">Base Subtotal:</span>
                  <span>{formatCurrency(selectedSite.calculatedPricing?.baseSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">Taxes (7.5%):</span>
                  <span>{formatCurrency(selectedSite.calculatedPricing?.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-base-content pt-2 border-t border-base-200">
                  <span>Total Due:</span>
                  <span className="text-emerald-600 font-mono font-black">
                    {formatCurrency(selectedSite.calculatedPricing?.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-base-100 border-t border-base-200 py-6 text-center text-xs text-base-content/60">
        <p>Powered by CampFlow SaaS • Independent RV Park Management</p>
      </footer>
    </div>
  );
}
