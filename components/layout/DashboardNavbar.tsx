"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  ExternalLink,
  User,
  LogOut,
  Menu,
  Trees,
  PlusCircle,
} from "lucide-react";

interface NavbarProps {
  onOpenNewReservation?: () => void;
  onRefreshData?: () => void;
}

export function DashboardNavbar({ onOpenNewReservation }: NavbarProps) {
  const { user, property, logout } = useAuth();
  const bookingSlug = property?.slug || "campflow-rv-resort";

  return (
    <header className="navbar bg-base-100 border-b border-base-200 sticky top-0 z-30 px-4 lg:px-6 h-16">
      {/* Mobile Drawer Trigger */}
      <div className="flex-none lg:hidden">
        <label htmlFor="dashboard-drawer" className="btn btn-square btn-ghost">
          <Menu className="w-5 h-5" />
        </label>
      </div>

      {/* Brand & Property */}
      <div className="flex-1 flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-black text-lg tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <Trees className="w-5 h-5" />
          </div>
          <span className="hidden sm:inline font-bold">CampFlow</span>
        </Link>

        <div className="divider divider-horizontal my-3 mx-1 hidden sm:flex"></div>

        {property && (
          <div className="hidden md:flex flex-col">
            <span className="text-sm font-bold text-base-content leading-none">{property.name}</span>
            <span className="text-[11px] text-base-content/50 leading-tight">Campground Operations</span>
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex-none flex items-center gap-2 sm:gap-3">
        {/* Public Booking Link */}
        <Link
          href={`/book/${bookingSlug}`}
          target="_blank"
          className="btn btn-ghost btn-xs sm:btn-sm gap-1.5 text-base-content/70 hover:text-base-content"
          title="Open Public Guest Booking Engine"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Guest Portal</span>
        </Link>

        {/* Quick New Reservation */}
        {onOpenNewReservation && (
          <button
            onClick={onOpenNewReservation}
            className="btn btn-primary btn-xs sm:btn-sm gap-1.5 font-medium shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">New Booking</span>
          </button>
        )}

        {/* User Profile Menu */}
        <div className="dropdown dropdown-end">
          <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar placeholder btn-sm bg-base-200">
            <span className="text-xs font-bold text-primary">
              {user?.name?.charAt(0) || "U"}
            </span>
          </div>
          <ul
            tabIndex={0}
            className="dropdown-content menu menu-sm mt-3 z-50 p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-200"
          >
            <li className="menu-title px-4 py-2">
              <div className="font-semibold text-base-content">{user?.name}</div>
              <div className="text-xs text-base-content/50 truncate font-normal">{user?.email}</div>
              <div className="badge badge-xs badge-neutral mt-1 uppercase font-mono">{user?.role}</div>
            </li>
            <div className="divider my-1"></div>
            <li>
              <Link href="/settings">
                <User className="w-4 h-4" />
                Settings & Policies
              </Link>
            </li>
            <li>
              <button onClick={() => logout()} className="text-error">
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}
