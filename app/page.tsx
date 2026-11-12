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
  LogIn,
  UserPlus,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="border-b border-slate-200 sticky top-0 bg-white z-30 px-6 h-16 flex items-center justify-between max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold">
            <Trees className="w-4 h-4" />
          </div>
          <span className="font-black text-xl tracking-tight text-slate-900">CampFlow</span>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost btn-sm font-bold gap-1.5 text-xs text-slate-700 hover:text-slate-900 rounded-md">
            <LogIn className="w-4 h-4" />
            Sign In
          </Link>
          <Link href="/register" className="btn btn-primary btn-sm font-bold gap-1.5 text-xs rounded-md">
            <UserPlus className="w-4 h-4" />
            Register Park
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-14 md:py-20 px-6 max-w-5xl mx-auto text-center space-y-5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          Built Exclusively for 10–100 Site RV Parks
        </div>

        <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.15] max-w-4xl mx-auto text-slate-900">
          The simple, fast management app for{" "}
          <span className="text-emerald-600 underline decoration-emerald-300 decoration-2">independent RV parks</span>
        </h1>

        <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Say goodbye to clunky, outdated software. Manage site hookups, visual calendar bookings, guests, payments, and 1-click check-ins from one lightning-fast web app.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/login"
            className="btn btn-primary btn-md gap-2 font-bold px-6 text-sm rounded-md"
          >
            Sign In to Front Desk
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/register"
            className="btn btn-outline btn-md gap-2 font-bold text-sm text-slate-700 rounded-md"
          >
            Register Your Park
          </Link>
        </div>

        {/* Feature Highlights */}
        <div className="flex flex-wrap justify-center items-center gap-x-5 gap-y-2 pt-4 text-xs text-slate-600 font-bold">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Visual Tape Chart Matrix
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 50A/30A Hookup & Rig Matching
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Instant 1-Click Check-In Desk
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Mobile-Ready On Every Device
          </span>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-12 bg-white border-y border-slate-200 px-6">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Everything you need, nothing you don&apos;t.
            </h2>
            <p className="text-xs text-slate-500">
              Designed to be learned in under 5 minutes by owners, seasonal staff, and camp hosts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="surface-card p-5 rounded-lg space-y-2.5 border border-slate-200">
              <div className="w-9 h-9 rounded-md bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                <CalendarDays className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Interactive Tape Chart</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Color-coded timeline grid of all your sites. See arrivals, departures, and active stays. Click any empty date slot to instantly book a walk-in.
              </p>
            </div>

            <div className="surface-card p-5 rounded-lg space-y-2.5 border border-slate-200">
              <div className="w-9 h-9 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Rig Clearance & Hookup Specs</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Never double-book or assign a 45ft Fifth Wheel to a 30ft tent site. Strict validation on 50A/30A, water, sewer, and pull-through requirements.
              </p>
            </div>

            <div className="surface-card p-5 rounded-lg space-y-2.5 border border-slate-200">
              <div className="w-9 h-9 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Smartphone className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Self-Service Guest Portal</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                A clean, modern online booking engine for your campers. Real-time availability search, site details, instant checkout, and confirmation passes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-slate-200 bg-white text-center text-xs text-slate-500 space-y-1">
        <div className="flex items-center justify-center gap-1.5 font-bold text-slate-900">
          <Trees className="w-3.5 h-3.5 text-emerald-600" /> CampFlow SaaS
        </div>
        <p>© {new Date().getFullYear()} CampFlow. All rights reserved.</p>
      </footer>
    </div>
  );
}
