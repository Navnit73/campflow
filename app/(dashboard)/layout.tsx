"use client";

import React, { useState } from "react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ToastProvider } from "@/components/ui/Toast";
import { DashboardNavbar } from "@/components/layout/DashboardNavbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { NewReservationModal } from "@/components/reservations/NewReservationModal";
import { ReservationDetailModal } from "@/components/reservations/ReservationDetailModal";
import { PaymentModal } from "@/components/payments/PaymentModal";
import { Trees, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);
  const [selectedResId, setSelectedResId] = useState<string | null>(null);
  const [paymentRes, setPaymentRes] = useState<any | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg animate-pulse">
          <Trees className="w-7 h-7" />
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-base-content/70">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Loading CampFlow Dashboard...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md p-8 rounded-2xl border border-base-200 bg-base-50 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
            <Trees className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold">Authentication Required</h2>
          <p className="text-sm text-base-content/70">
            Please sign in to access the campground operations dashboard.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Link href="/login" className="btn btn-primary btn-sm">
              Sign In
            </Link>
            <Link href="/register" className="btn btn-outline btn-sm">
              Register Park
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="drawer lg:drawer-open min-h-screen bg-base-200/30">
      <input id="dashboard-drawer" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col min-h-screen">
        <DashboardNavbar
          onOpenNewReservation={() => setIsNewBookingOpen(true)}
          onRefreshData={() => setRefreshKey((k) => k + 1)}
        />
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
      <div className="drawer-side z-40">
        <label htmlFor="dashboard-drawer" aria-label="close sidebar" className="drawer-overlay"></label>
        <Sidebar />
      </div>

      {/* Global Modals */}
      <NewReservationModal
        isOpen={isNewBookingOpen}
        onClose={() => setIsNewBookingOpen(false)}
        onSuccess={() => {
          setIsNewBookingOpen(false);
          setRefreshKey((k) => k + 1);
        }}
      />

      <ReservationDetailModal
        reservationId={selectedResId}
        isOpen={!!selectedResId}
        onClose={() => setSelectedResId(null)}
        onUpdated={() => setRefreshKey((k) => k + 1)}
        onOpenPayment={(res) => {
          setSelectedResId(null);
          setPaymentRes(res);
        }}
      />

      <PaymentModal
        reservation={paymentRes}
        isOpen={!!paymentRes}
        onClose={() => setPaymentRes(null)}
        onSuccess={() => {
          setPaymentRes(null);
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <DashboardContent>{children}</DashboardContent>
      </ToastProvider>
    </AuthProvider>
  );
}
