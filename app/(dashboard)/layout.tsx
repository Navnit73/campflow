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

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);
  const [selectedResId, setSelectedResId] = useState<string | null>(null);
  const [paymentRes, setPaymentRes] = useState<any | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 rounded-md bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
          <Trees className="w-5 h-5" />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
          Loading CampFlow Dashboard...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full p-6 rounded-lg border border-slate-200 bg-white shadow-xs space-y-4">
          <div className="w-10 h-10 rounded-md bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-2xs">
            <Trees className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-black tracking-tight text-slate-900">Authentication Required</h2>
          <p className="text-xs text-slate-500">
            Please sign in to access the campground operations dashboard.
          </p>
          <div className="flex gap-2 justify-center pt-1">
            <Link href="/login" className="btn btn-primary btn-sm font-bold rounded-md">
              Sign In
            </Link>
            <Link href="/register" className="btn btn-outline btn-sm font-bold rounded-md">
              Register Park
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Top Full-Width Navbar */}
      <DashboardNavbar
        onOpenNewReservation={() => setIsNewBookingOpen(true)}
        onRefreshData={() => setRefreshKey((k) => k + 1)}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      {/* Main Body Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar (Pinned, 100% full height of remaining viewport) */}
        <div className="hidden lg:flex shrink-0 h-full border-r border-slate-200 bg-white">
          <Sidebar />
        </div>

        {/* Mobile Slide-out Drawer Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 lg:hidden flex bg-slate-900/50 backdrop-blur-xs animate-fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <div
              className="relative w-64 max-w-[80vw] h-full bg-white shadow-xl animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <Sidebar onCloseMobile={() => setIsMobileMenuOpen(false)} />
            </div>
          </div>
        )}

        {/* Scrollable Main Content Area */}
        <main className="flex-1 h-full overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-7 custom-scrollbar">
          <div className="max-w-[1600px] w-full mx-auto space-y-5 pb-10">
            {children}
          </div>
        </main>
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
