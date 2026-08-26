"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  Trees,
  LogOut,
  User,
  Menu,
  PlusCircle,
} from "lucide-react";

interface DashboardNavbarProps {
  onOpenNewReservation?: () => void;
  onRefreshData?: () => void;
  onToggleMobileMenu?: () => void;
}

export function DashboardNavbar({
  onOpenNewReservation,
  onRefreshData,
  onToggleMobileMenu,
}: DashboardNavbarProps) {
  const { user, property, logout } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 h-16 flex items-center justify-between text-slate-800 shrink-0">
      {/* Left side: Mobile Menu Button + Brand */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="btn btn-ghost btn-sm btn-square lg:hidden text-slate-600 hover:text-slate-900 rounded-md"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-md bg-emerald-600 text-white flex items-center justify-center font-black transition-transform group-hover:scale-105 shadow-2xs">
            <Trees className="w-4 h-4" />
          </div>
          <div>
            <span className="font-black text-lg tracking-tight block leading-none text-slate-900">
              CampFlow
            </span>
            <span className="text-[10px] font-semibold text-slate-500 hidden sm:inline-block">
              {property?.name ? property.name : "Campground Operations"}
            </span>
          </div>
        </Link>
      </div>

      {/* Right side: User & Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick New Booking Button */}
        {onOpenNewReservation && (
          <button
            onClick={onOpenNewReservation}
            className="btn btn-primary btn-xs sm:btn-sm gap-1.5 font-bold rounded-md"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Booking</span>
            <span className="sm:hidden">Book</span>
          </button>
        )}

        {/* Property Badge */}
        {property?.name && (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 max-w-[200px] truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
            <span className="truncate">{property.name}</span>
          </div>
        )}

        {/* User profile dropdown */}
        <div className="dropdown dropdown-end">
          <label
            tabIndex={0}
            className="btn btn-ghost btn-sm gap-2 normal-case font-medium text-xs px-2 rounded-md hover:bg-slate-100 cursor-pointer"
          >
            <div className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs border border-emerald-300">
              {user?.name ? user.name[0].toUpperCase() : "U"}
            </div>
            <span className="hidden sm:inline-block font-semibold text-slate-800">
              {user?.name || "Staff Member"}
            </span>
          </label>

          <ul
            tabIndex={0}
            className="dropdown-content menu menu-sm p-1.5 shadow-md bg-white border border-slate-200 rounded-md w-52 text-xs mt-1 z-50 text-slate-800"
          >
            <li className="menu-title px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Signed in as {user?.email}
            </li>
            <li>
              <Link href="/settings" className="py-2 gap-2 font-medium rounded">
                <User className="w-3.5 h-3.5 text-slate-500" />
                Staff Settings
              </Link>
            </li>
            <li className="border-t border-slate-100 mt-1 pt-1">
              <button
                onClick={logout}
                className="text-rose-700 py-2 gap-2 font-semibold hover:bg-rose-50 rounded"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}
