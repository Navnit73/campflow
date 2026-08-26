"use client";

import React from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { ToastProvider } from "@/components/ui/Toast";
import Link from "next/link";
import { Trees, ArrowLeft } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center justify-between max-w-5xl w-full mx-auto">
            <Link href="/" className="flex items-center gap-2.5 font-black text-xl tracking-tight">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <Trees className="w-5 h-5" />
              </div>
              <span className="font-black text-slate-900">CampFlow</span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-emerald-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Home
            </Link>
          </div>

          {/* Centered Auth Card Container */}
          <div className="w-full max-w-md mx-auto my-6 sm:my-10 animate-fade-in">{children}</div>

          {/* Footer */}
          <div className="text-center text-xs text-slate-500 py-2">
            © {new Date().getFullYear()} CampFlow SaaS • Independent Campground Operations
          </div>
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
