"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import apiClient from "@/lib/axios/client";
import { HookupIcons } from "@/components/ui/HookupIcons";
import { formatCurrency, formatDate, formatRvType } from "@/lib/utils/format";
import {
  CheckCircle2,
  Trees,
  Printer,
  MapPin,
  Calendar,
  Truck,
  ShieldCheck,
  Phone,
  Mail,
  RefreshCw,
} from "lucide-react";

export default function BookingConfirmationPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const code = params?.code as string;

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (code) {
      apiClient
        .get(`/api/public/book/confirmation/${code}`)
        .then((res) => {
          if (res.data?.success) {
            setData(res.data.data);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [code]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center p-6 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-base-content/70">
          Loading your confirmation pass...
        </p>
      </div>
    );
  }

  if (!data || !data.reservation) {
    return (
      <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h2 className="text-xl font-bold">Confirmation Not Found</h2>
        <p className="text-sm text-base-content/70">
          Could not locate a booking with confirmation code &quot;{code}&quot;.
        </p>
        <Link href={`/book/${slug}`} className="btn btn-primary btn-sm">
          Return to Booking Page
        </Link>
      </div>
    );
  }

  const { reservation: res, property: prop, site, guest } = data;

  return (
    <div className="min-h-screen bg-base-200/40 text-base-content p-4 sm:p-8 flex flex-col justify-between">
      <div className="max-w-3xl w-full mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="card bg-base-100 shadow-xl border border-base-200 p-6 sm:p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <span className="badge badge-success badge-sm font-bold text-white uppercase tracking-wider mb-2">
              Booking Confirmed & Paid
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-base-content">
              You&apos;re All Set for Camping!
            </h1>
            <p className="text-xs sm:text-sm text-base-content/70 mt-1">
              Thank you for booking with {prop?.name || "our campground"}. A confirmation receipt has been sent to{" "}
              <strong className="text-base-content">{guest?.email}</strong>.
            </p>
          </div>

          {/* Confirmation Code Banner */}
          <div className="p-4 rounded-xl bg-base-200/70 border border-base-300 max-w-sm mx-auto">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-base-content/60">
              Confirmation Code
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-primary mt-0.5">
              {res.confirmationCode}
            </div>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={handlePrint}
              className="btn btn-outline btn-sm gap-2 font-semibold"
            >
              <Printer className="w-4 h-4" />
              Print Confirmation Pass
            </button>
          </div>
        </div>

        {/* Stay & Site Details Card */}
        <div className="card bg-base-100 shadow-md border border-base-200 p-6 space-y-6">
          <h3 className="font-bold text-base text-base-content border-b border-base-200 pb-3">
            Reservation Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Site Info */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">
                Assigned Site
              </span>
              <div className="p-4 rounded-xl bg-base-200/50 border border-base-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-lg font-mono text-base-content">
                    Site {res.siteSnapshot?.siteNumber}
                  </span>
                  <span className="badge badge-sm badge-outline">
                    {res.siteSnapshot?.rigType?.replace("_", " ")}
                  </span>
                </div>
                <div className="text-xs text-base-content/70">
                  {res.siteSnapshot?.siteTypeName}
                </div>
                <div className="pt-1">
                  <HookupIcons hookups={res.siteSnapshot?.hookups} compact />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">
                Check-In & Out Schedule
              </span>
              <div className="p-4 rounded-xl bg-base-200/50 border border-base-200 space-y-3 text-xs">
                <div>
                  <span className="text-base-content/60 font-medium">Check-In: </span>
                  <span className="font-bold text-base-content">
                    {formatDate(res.checkInDate)} (After 1:00 PM)
                  </span>
                </div>
                <div>
                  <span className="text-base-content/60 font-medium">Check-Out: </span>
                  <span className="font-bold text-base-content">
                    {formatDate(res.checkOutDate)} (Before 11:00 AM)
                  </span>
                </div>
                <div className="pt-1 border-t border-base-200 font-semibold text-base-content/80">
                  Stay: {res.numNights} Nights • {res.adults} Adults, {res.children} Children
                </div>
              </div>
            </div>
          </div>

          {/* Payment & Billing */}
          <div className="p-4 rounded-xl border border-base-200 bg-base-100 flex items-center justify-between text-sm">
            <div>
              <div className="font-bold text-base-content">Total Paid: {formatCurrency(res.pricing?.paidAmount)}</div>
              <div className="text-[11px] text-base-content/60">
                Paid in full via online checkout
              </div>
            </div>
            <div className="badge badge-success text-white font-bold gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Paid
            </div>
          </div>

          {/* Park Address & Rules */}
          {prop && (
            <div className="p-4 rounded-xl bg-base-200/40 border border-base-200 text-xs space-y-3">
              <div className="flex items-center gap-2 font-bold text-base-content">
                <MapPin className="w-4 h-4 text-emerald-600" />
                Park Location & Contact
              </div>
              <p className="text-base-content/80">
                {prop.address?.street}, {prop.address?.city}, {prop.address?.state} {prop.address?.zip}
              </p>
              <div className="flex flex-wrap gap-4 text-base-content/70">
                <span>Phone: {prop.phone}</span>
                <span>Email: {prop.email}</span>
              </div>

              {prop.rules && prop.rules.length > 0 && (
                <div className="pt-2 border-t border-base-200 space-y-1">
                  <span className="font-bold text-base-content">Important Park Rules:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-base-content/70 pl-1">
                    {prop.rules.slice(0, 3).map((r: string, idx: number) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="text-center text-xs text-base-content/50 py-6">
        © {new Date().getFullYear()} {prop?.name || "Campground"}. Powered by CampFlow SaaS.
      </footer>
    </div>
  );
}
