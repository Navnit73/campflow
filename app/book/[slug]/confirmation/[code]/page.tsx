"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import apiClient from "@/lib/axios/client";
import { HookupIcons } from "@/components/ui/HookupIcons";
import { formatCurrency, formatDate, formatRvType } from "@/lib/utils/format";
import Link from "next/link";
import {
  Trees,
  CheckCircle2,
  Calendar,
  MapPin,
  Clock,
  Printer,
  Phone,
  Mail,
  Loader2,
  AlertCircle,
} from "lucide-react";

export default function ConfirmationPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "campflow-rv-resort";
  const code = (params?.code as string) || "";

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (code) {
      apiClient
        .get(`/api/public/book/confirmation/${code}`)
        .then((res) => {
          if (res.data?.success) {
            setData(res.data.data);
          } else {
            setErrorMsg("Reservation details not found.");
          }
        })
        .catch((err) => {
          setErrorMsg(err?.message || "Failed to load booking confirmation");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [code]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="surface-card p-8 rounded-lg text-center space-y-3 max-w-sm w-full border border-slate-200">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
          <p className="text-sm font-semibold text-slate-700">Loading your reservation pass...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="surface-card p-8 rounded-lg text-center space-y-3 max-w-sm w-full border border-slate-200">
          <AlertCircle className="w-8 h-8 mx-auto text-rose-600" />
          <h2 className="text-base font-bold text-slate-900">Reservation Not Found</h2>
          <p className="text-xs text-slate-500">{errorMsg || "Invalid confirmation code"}</p>
          <Link href={`/book/${slug}`} className="btn btn-primary btn-sm font-bold rounded-md">
            Return to Booking Page
          </Link>
        </div>
      </div>
    );
  }

  const { reservation, property } = data;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Top Banner */}
        <div className="surface-card p-5 sm:p-6 rounded-lg text-center space-y-2 border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Booking Confirmed!
          </h1>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            We have confirmed your reservation at <strong className="text-slate-900">{property?.name}</strong>. A confirmation pass has been recorded for your arrival.
          </p>

          <div className="pt-2">
            <div className="inline-block p-3 rounded-md bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 block">
                Confirmation Code
              </span>
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-emerald-800">
                {reservation.confirmationCode}
              </span>
            </div>
          </div>
        </div>

        {/* Stay & Site Details Card */}
        <div className="surface-card p-5 sm:p-6 rounded-lg space-y-4 border border-slate-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs text-slate-500 font-semibold">Assigned Site:</span>
              <h2 className="text-lg font-black font-mono text-slate-900">
                Site {reservation.siteSnapshot?.siteNumber}
              </h2>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 font-semibold">Category:</span>
              <div className="text-xs font-bold text-slate-800">
                {reservation.siteSnapshot?.siteTypeName}
              </div>
            </div>
          </div>

          {/* Schedule Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                Check-In Date
              </div>
              <div className="text-sm font-bold text-slate-900">{formatDate(reservation.checkInDate)}</div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" /> After 1:00 PM
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                Check-Out Date
              </div>
              <div className="text-sm font-bold text-slate-900">{formatDate(reservation.checkOutDate)}</div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" /> Before 11:00 AM
              </div>
            </div>
          </div>

          {/* Hookups */}
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Hookups at your site:
            </span>
            <HookupIcons
              hookups={reservation.siteSnapshot?.hookups}
              rigType={reservation.guestSnapshot?.rvType}
              maxRigLength={reservation.siteSnapshot?.maxRigLength}
            />
          </div>

          {/* Add-On Services & Extras if any */}
          {reservation.addOns && reservation.addOns.length > 0 && (
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Included Add-On Services & Extras:
              </span>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                {reservation.addOns.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-slate-700">
                    <span className="font-semibold">
                      {item.name} <span className="font-mono text-slate-500">(x{item.quantity})</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-800">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Guest & Payment Summary */}
          <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Primary Guest:</span>
              <span className="font-bold text-slate-900">{reservation.guestSnapshot?.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Email:</span>
              <span>{reservation.guestSnapshot?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Rig Type:</span>
              <span>{formatRvType(reservation.guestSnapshot?.rvType || "travel_trailer")}</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-slate-900 pt-2 border-t border-slate-100">
              <span>Total Paid:</span>
              <span className="text-emerald-700 font-mono font-black">
                {formatCurrency(reservation.pricing?.paidAmount || reservation.pricing?.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Park Location & Rules Card */}
        <div className="surface-card p-4 sm:p-5 rounded-lg space-y-2 text-xs text-slate-600 border border-slate-200">
          <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-emerald-600" />
            Park Location & Important Information
          </div>
          <p>
            {property?.name} • {property?.address?.street || "100 Pine Creek Rd"}, {property?.address?.city || "Mountain View"}, {property?.address?.state || "CO"} {property?.address?.zip || "80401"}
          </p>
          <div className="pt-1 text-slate-500 space-y-0.5">
            <p>• Quiet hours are strictly enforced between 10:00 PM and 7:00 AM.</p>
            <p>• Please keep pets on a 6-foot leash at all times.</p>
            <p>• Speed limit within campground is 5 MPH.</p>
          </div>
        </div>

        {/* Print & Return Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 no-print">
          <Link
            href={`/book/${slug}`}
            className="btn btn-outline btn-sm font-bold text-xs text-slate-700 rounded-md"
          >
            ← Book Another Site
          </Link>
          <button
            onClick={handlePrint}
            className="btn btn-primary btn-sm gap-1.5 font-bold text-xs rounded-md"
          >
            <Printer className="w-4 h-4" />
            Print Confirmation Pass
          </button>
        </div>
      </div>
    </div>
  );
}
