"use client";

import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import {
  Building2,
  MapPin,
  Clock,
  DollarSign,
  Shield,
  User,
  CheckCircle2,
} from "lucide-react";

export default function SettingsPage() {
  const { user, property, organization } = useAuth();
  const { success } = useToast();

  const [propName, setPropName] = useState(property?.name || "CampFlow RV Resort");
  const [phone, setPhone] = useState(property?.phone || "(555) 234-5678");
  const [email, setEmail] = useState(property?.email || "admin@campflow.com");
  const [checkInTime, setCheckInTime] = useState(property?.checkInTime || "13:00");
  const [checkOutTime, setCheckOutTime] = useState(property?.checkOutTime || "11:00");
  const [taxRate, setTaxRate] = useState(property?.taxRatePercent ?? 7.5);
  const [quietHours, setQuietHours] = useState(property?.quietHours || "10:00 PM - 7:00 AM");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    success("Campground settings updated successfully!");
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-base-content">
          Campground Settings & Policies
        </h1>
        <p className="text-xs text-base-content/60 mt-0.5">
          Configure park details, operating hours, tax rates, and staff profiles
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Park Details */}
        <div className="card bg-base-100 shadow-sm border border-base-200 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-base-200">
            <Building2 className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-base-content">Property Profile</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label text-xs font-semibold py-1">Park Name</label>
              <input
                type="text"
                value={propName}
                onChange={(e) => setPropName(e.target.value)}
                className="input input-bordered input-sm w-full"
                required
              />
            </div>

            <div>
              <label className="label text-xs font-semibold py-1">Public URL Slug</label>
              <input
                type="text"
                value={property?.slug || "campflow-rv-resort"}
                disabled
                className="input input-bordered input-sm w-full font-mono bg-base-200/50"
              />
            </div>

            <div>
              <label className="label text-xs font-semibold py-1">Front Desk Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input input-bordered input-sm w-full"
                required
              />
            </div>

            <div>
              <label className="label text-xs font-semibold py-1">Campground Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input input-bordered input-sm w-full"
                required
              />
            </div>
          </div>
        </div>

        {/* Operating Hours & Taxes */}
        <div className="card bg-base-100 shadow-sm border border-base-200 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-base-200">
            <Clock className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-base-content">
              Hours, Taxes & Quiet Times
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label text-xs font-semibold py-1">Check-In Time</label>
              <input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="input input-bordered input-sm w-full"
              />
            </div>

            <div>
              <label className="label text-xs font-semibold py-1">Check-Out Time</label>
              <input
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="input input-bordered input-sm w-full"
              />
            </div>

            <div>
              <label className="label text-xs font-semibold py-1">Lodging Tax Rate (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="30"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="input input-bordered input-sm w-full font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="label text-xs font-semibold py-1">Quiet Hours Policy</label>
            <input
              type="text"
              value={quietHours}
              onChange={(e) => setQuietHours(e.target.value)}
              className="input input-bordered input-sm w-full"
            />
          </div>
        </div>

        {/* Account Info */}
        <div className="card bg-base-100 shadow-sm border border-base-200 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-base-200">
            <User className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-base-content">Staff Account</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-base-content/60">Signed In As:</span>
              <div className="font-bold text-sm text-base-content mt-0.5">{user?.name}</div>
            </div>
            <div>
              <span className="text-base-content/60">Email:</span>
              <div className="font-medium text-base-content mt-0.5">{user?.email}</div>
            </div>
            <div>
              <span className="text-base-content/60">Role:</span>
              <div className="mt-0.5">
                <span className="badge badge-sm badge-neutral uppercase font-mono">{user?.role}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary btn-sm min-w-[140px] shadow-sm">
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
