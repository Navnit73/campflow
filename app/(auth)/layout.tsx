"use client";

import React from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { ToastProvider } from "@/components/ui/Toast";
import Link from "next/link";
import { Trees } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="min-h-screen bg-base-200/40 flex flex-col justify-between p-4 sm:p-6">
          <div className="flex items-center justify-between max-w-6xl w-full mx-auto">
            <Link href="/" className="flex items-center gap-2 font-black text-xl tracking-tight">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                <Trees className="w-5 h-5" />
              </div>
              <span className="font-bold text-base-content">CampFlow</span>
            </Link>
            <Link href="/" className="text-xs font-semibold text-primary hover:underline">
              ← Back to Homepage
            </Link>
          </div>

          <div className="w-full max-w-md mx-auto my-8">{children}</div>

          <div className="text-center text-xs text-base-content/50">
            © {new Date().getFullYear()} CampFlow SaaS • Simple RV Park & Campground Management
          </div>
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
