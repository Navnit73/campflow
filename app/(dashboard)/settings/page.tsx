"use client";

import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import {
  Building2,
  Clock,
  User,
  Save,
  CheckCircle2,
} from "lucide-react";

export default function SettingsPage() {
  const { user, property } = useAuth();
  const { success } = useToast();

  const [propName, setPropName] = useState(property?.name || "CampFlow RV Resort");
  const [phone, setPhone] = useState(property?.phone || "(555) 234-5678");
  const [email, setEmail] = useState(property?.email || "admin@campflow.com");
  const [checkInTime, setCheckInTime] = useState(property?.checkInTime || "13:00");
  const [checkOutTime, setCheckOutTime] = useState(property?.checkOutTime || "11:00");
  const [taxRate, setTaxRate] = useState<number | string>(property?.taxRatePercent ?? 7.5);
  const [quietHours, setQuietHours] = useState(property?.quietHours || "10:00 PM - 7:00 AM");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    success("Campground settings updated successfully!");
  };

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
                value={property?.slug || "campflow-rv-resort"}
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
              className="input input-bordered input-sm w-full rounded-md"
            />
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

        <div className="flex items-center justify-end pt-1">
          <button
            type="submit"
            className="btn btn-primary btn-sm w-full sm:w-auto min-w-[140px] font-bold rounded-md"
          >
            <Save className="w-4 h-4" />
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
