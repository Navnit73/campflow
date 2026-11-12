"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import apiClient from "@/lib/axios/client";
import {
  Building2,
  Clock,
  User,
  Save,
  CheckCircle2,
  MapPin,
  Loader2,
} from "lucide-react";

type Address = { street: string; city: string; state: string; zip: string; country: string };

export default function SettingsPage() {
  const { user, property, refreshSession } = useAuth();
  const { success, error } = useToast();
  const canEdit = user?.role === "owner";

  // Loaded from the API (no hardcoded demo defaults — those used to masquerade as real settings).
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [propName, setPropName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [checkInTime, setCheckInTime] = useState("13:00");
  const [checkOutTime, setCheckOutTime] = useState("11:00");
  const [taxRate, setTaxRate] = useState<number | string>(0);
  const [quietHours, setQuietHours] = useState("");
  const [timezone, setTimezone] = useState("");
  const [bookingPolicy, setBookingPolicy] = useState("");
  const [settingsConfirmed, setSettingsConfirmed] = useState(true);
  const [address, setAddress] = useState<Address>({ street: "", city: "", state: "", zip: "", country: "USA" });

  useEffect(() => {
    apiClient
      .get("/api/property")
      .then((res) => {
        const p = res.data?.data;
        if (!p) return;
        setPropName(p.name || "");
        setPhone(p.phone || "");
        setEmail(p.email || "");
        setCheckInTime(p.checkInTime || "13:00");
        setCheckOutTime(p.checkOutTime || "11:00");
        setTaxRate(p.taxRatePercent ?? 0);
        setQuietHours(p.quietHours || "");
        setTimezone(p.timezone || "UTC");
        setBookingPolicy(p.bookingPolicy || "");
        setSettingsConfirmed(Boolean(p.settingsConfirmedAt));
        setAddress({ street: "", city: "", state: "", zip: "", country: "USA", ...(p.address || {}) });
      })
      .catch((err) => error(err?.message || "Failed to load settings"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Previously this only showed a success toast and saved nothing.
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      await apiClient.patch("/api/property", {
        name: propName,
        phone,
        email,
        checkInTime,
        checkOutTime,
        taxRatePercent: taxRate === "" ? 0 : Number(taxRate),
        quietHours,
        timezone,
        address,
        bookingPolicy,
      });
      setSettingsConfirmed(true);
      await refreshSession();
      success("Campground settings saved.");
    } catch (err: unknown) {
      error((err as Error)?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const setAddr = (key: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddress((prev) => ({ ...prev, [key]: e.target.value }));

  if (loading) {
    return (
      <div className="max-w-4xl w-full mx-auto py-10 text-center text-sm text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="max-w-4xl w-full mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
          Campground Settings & Policies
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Configure park profile, operating hours, tax rates, and staff profiles
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <fieldset disabled={!canEdit || saving} className="space-y-4">
        {!canEdit && (
          <p className="text-xs text-slate-500">Only the park owner can change these settings.</p>
        )}
        {!settingsConfirmed && (
          <div role="status" className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-900">
            <strong>Please review and save.</strong> Check-in {checkInTime}, check-out {checkOutTime} and a {taxRate || 0}% tax
            rate are starting defaults, not your park&apos;s confirmed settings. Saving this page confirms them.
          </div>
        )}
        {/* Park Details */}
        <div className="surface-card p-4 sm:p-5 space-y-3.5 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <h3 className="font-bold text-sm text-slate-900">Property Profile</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Park Name</label>
              <input
                type="text"
                value={propName}
                onChange={(e) => setPropName(e.target.value)}
                className="input input-bordered input-sm w-full font-medium rounded-md"
                required
              />
            </div>

            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Public URL Slug</label>
              <input
                type="text"
                value={property?.slug || ""}
                disabled
                className="input input-bordered input-sm w-full font-mono bg-slate-100 text-slate-500 cursor-not-allowed rounded-md truncate"
              />
            </div>

            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Front Desk Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input input-bordered input-sm w-full font-mono rounded-md"
                required
              />
            </div>

            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Campground Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input input-bordered input-sm w-full rounded-md"
                required
              />
            </div>
          </div>
        </div>

        {/* Address & timezone (shown to guests on booking pages and confirmations) */}
        <div className="surface-card p-4 sm:p-5 space-y-3.5 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            <h3 className="font-bold text-sm text-slate-900">Address & Timezone</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="w-full sm:col-span-2">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Street Address</label>
              <input type="text" value={address.street} onChange={setAddr("street")} className="input input-bordered input-sm w-full rounded-md" />
            </div>
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">City</label>
              <input type="text" value={address.city} onChange={setAddr("city")} className="input input-bordered input-sm w-full rounded-md" />
            </div>
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">State / Province</label>
              <input type="text" value={address.state} onChange={setAddr("state")} className="input input-bordered input-sm w-full rounded-md" />
            </div>
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">ZIP / Postal Code</label>
              <input type="text" value={address.zip} onChange={setAddr("zip")} className="input input-bordered input-sm w-full rounded-md" />
            </div>
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Timezone (IANA)</label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="America/Denver"
                className="input input-bordered input-sm w-full font-mono rounded-md"
              />
            </div>
          </div>
        </div>

        {/* Operating Hours & Taxes */}
        <div className="surface-card p-4 sm:p-5 space-y-3.5 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
            <h3 className="font-bold text-sm text-slate-900">
              Hours, Taxes & Quiet Times
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Check-In Time</label>
              <input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="input input-bordered input-sm w-full font-mono rounded-md"
              />
            </div>

            <div className="w-full">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Check-Out Time</label>
              <input
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="input input-bordered input-sm w-full font-mono rounded-md"
              />
            </div>

            <div className="w-full sm:col-span-2 lg:col-span-1">
              <label className="label text-xs font-bold text-slate-700 py-0.5">Lodging Tax Rate (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="30"
                value={taxRate}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setTaxRate(e.target.value === "" ? "" : Number(e.target.value))}
                className="input input-bordered input-sm w-full font-mono font-bold text-emerald-700 rounded-md"
              />
            </div>
          </div>

          <div className="w-full">
            <label className="label text-xs font-bold text-slate-700 py-0.5">Quiet Hours Policy</label>
            <input
              type="text"
              value={quietHours}
              onChange={(e) => setQuietHours(e.target.value)}
              placeholder="e.g. 10:00 PM – 7:00 AM"
              className="input input-bordered input-sm w-full rounded-md"
            />
          </div>

          <div className="w-full">
            <label className="label text-xs font-bold text-slate-700 py-0.5">Cancellation Policy</label>
            <textarea
              value={bookingPolicy}
              onChange={(e) => setBookingPolicy(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="e.g. Full refund up to 7 days before arrival; first night is non-refundable after that."
              className="textarea textarea-bordered textarea-sm w-full rounded-md"
            />
            <p className="text-[11px] text-slate-500 mt-1">Shown to guests on the booking page before they reserve.</p>
          </div>
        </div>

        {/* Staff Account Info */}
        <div className="surface-card p-4 sm:p-5 space-y-3.5 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <User className="w-4 h-4 text-emerald-600 shrink-0" />
            <h3 className="font-bold text-sm text-slate-900">Staff Profile</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
            <div className="min-w-0">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Signed In As:</span>
              <div className="font-bold text-sm text-slate-900 mt-0.5 truncate">{user?.name}</div>
            </div>
            <div className="min-w-0">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Email:</span>
              <div className="font-medium text-slate-700 mt-0.5 truncate break-all">{user?.email}</div>
            </div>
            <div className="min-w-0">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Staff Role:</span>
              <div className="mt-1">
                <span className="badge badge-sm uppercase font-mono font-bold bg-slate-100 text-slate-700 border-slate-200 rounded-sm">
                  {user?.role}
                </span>
              </div>
            </div>
          </div>
        </div>

        </fieldset>
        <div className="flex items-center justify-end pt-1">
          <button
            type="submit"
            disabled={!canEdit || saving}
            className="btn btn-primary btn-sm w-full sm:w-auto min-w-[140px] font-bold rounded-md"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
