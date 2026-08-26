"use client";

import React, { useEffect } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { ToastProvider } from "@/components/ui/Toast";
import Link from "next/link";
import { Trees, ArrowLeft } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <div
          className="min-h-screen flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative"
          style={{
            backgroundImage: `url('https://res.cloudinary.com/dipzpwbbk/image/upload/v1787729113/login_bg_kj8d6u.jpg')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

          {/* Content (above overlay) */}
          <div className="relative z-10 flex flex-col justify-between min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between max-w-5xl w-full mx-auto">
              <Link href="/" className="flex items-center gap-2.5 font-black text-xl tracking-tight">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg">
                  <Trees className="w-5 h-5" />
                </div>
                <span className="font-black text-white drop-shadow-md">CampFlow</span>
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white/80 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Home
              </Link>
            </div>

            {/* Centered Auth Card Container */}
            <div className="w-full max-w-md mx-auto my-6 sm:my-10 animate-fade-in">{children}</div>

            {/* Footer */}
            <div className="text-center text-xs text-white/60 py-2">
              © {new Date().getFullYear()} CampFlow SaaS • Independent Campground Operations
            </div>
          </div>
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
