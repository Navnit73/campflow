"use client";

import React from "react";
import Link from "next/link";
import {
  Trees,
  CalendarDays,
  CheckCircle2,
  Zap,
  ArrowRight,
  Sparkles,
  Smartphone,
  ShieldCheck,
  CreditCard,
  LogIn,
  UserPlus,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-base-100 text-base-content flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="border-b border-base-200 sticky top-0 bg-base-100/90 backdrop-blur-md z-30 px-6 h-16 flex items-center justify-between max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
            <Trees className="w-5 h-5" />
          </div>
          <span className="font-black text-xl tracking-tight">CampFlow</span>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login" className="btn btn-ghost btn-sm font-semibold gap-1.5">
            <LogIn className="w-4 h-4" />
            Sign In
          </Link>
          <Link href="/register" className="btn btn-primary btn-sm font-bold shadow-sm gap-1.5">
            <UserPlus className="w-4 h-4" />
            Register Park
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 md:py-24 px-6 max-w-6xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
          Built Exclusively for 10–100 Site RV Parks
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-none max-w-4xl mx-auto text-base-content">
          The simple, fast management app for{" "}
          <span className="text-emerald-600 underline decoration-emerald-400/40">independent RV parks</span>
        </h1>

        <p className="text-base sm:text-lg text-base-content/70 max-w-2xl mx-auto leading-relaxed">
          Say goodbye to clunky, 90s-era enterprise software. Manage site hookups, visual calendar bookings, guests, payments, and 1-click check-ins from one lightning-fast web app.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            href="/login"
            className="btn btn-primary btn-md gap-2 font-bold px-8 shadow-md text-base"
          >
            Sign In to Front Desk
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/book/campflow-rv-resort" className="btn btn-outline btn-md gap-2 font-semibold">
            View Online Booking Engine ↗
          </Link>
        </div>

        {/* Feature Highlights */}
        <div className="flex flex-wrap justify-center items-center gap-6 pt-8 text-xs text-base-content/60 font-semibold">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Visual Tape Chart Matrix
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 50A/30A Hookup & Rig Matching
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Instant 1-Click Check-In Desk
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Mobile-Ready On Every Device
          </span>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-12 bg-base-200/40 border-y border-base-200 px-6">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Everything you need, nothing you don&apos;t.
            </h2>
            <p className="text-xs text-base-content/60">
              Designed to be learned in under 5 minutes by owners, seasonal staff, and camp hosts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card bg-base-100 p-6 rounded-2xl border border-base-200 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold">
                <CalendarDays className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-base-content">Interactive Tape Chart</h3>
              <p className="text-xs text-base-content/70 leading-relaxed">
                Color-coded timeline grid of all your sites. See arrivals, departures, and active stays. Click any empty date slot to instantly book a walk-in.
              </p>
            </div>

            <div className="card bg-base-100 p-6 rounded-2xl border border-base-200 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-base-content">Rig Clearance & Hookup Specs</h3>
              <p className="text-xs text-base-content/70 leading-relaxed">
                Never double-book or assign a 45ft Fifth Wheel to a 30ft tent site. Strict validation on 50A/30A, water, sewer, and pull-through requirements.
              </p>
            </div>

            <div className="card bg-base-100 p-6 rounded-2xl border border-base-200 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-base-content">Self-Service Guest Portal</h3>
              <p className="text-xs text-base-content/70 leading-relaxed">
                A clean, modern online booking engine for your campers. Real-time availability search, site photos, instant checkout, and confirmation passes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-base-200 bg-base-100 text-center text-xs text-base-content/60 space-y-2">
        <div className="flex items-center justify-center gap-2 font-bold text-base-content">
          <Trees className="w-4 h-4 text-emerald-600" /> CampFlow SaaS
        </div>
        <p>© {new Date().getFullYear()} CampFlow. All rights reserved.</p>
      </footer>
    </div>
  );
}
