"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  CalendarCheck,
  MapPin,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  Trees,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: "Front Desk", href: "/dashboard", icon: LayoutDashboard },
  { name: "Tape Chart", href: "/tape-chart", icon: CalendarDays },
  { name: "Reservations", href: "/reservations", icon: CalendarCheck },
  { name: "Sites & Map", href: "/sites", icon: MapPin },
  { name: "Guests (CRM)", href: "/guests", icon: Users },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Park Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between h-full lg:h-[calc(100vh-4rem)] p-3 text-slate-800">
      {/* Navigation list */}
      <div className="space-y-4">
        {/* Brand header on mobile / small screen */}
        <div className="flex items-center gap-2.5 px-3 py-2 lg:hidden border-b border-slate-100 pb-3">
          <div className="w-8 h-8 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold shadow-2xs">
            <Trees className="w-4 h-4" />
          </div>
          <div>
            <span className="font-black text-base tracking-tight block leading-none text-slate-900">
              CampFlow
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Front Desk Operations</span>
          </div>
        </div>

        <div>
          <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Campground Operations
          </div>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-emerald-50 text-emerald-800 font-bold border-l-2 border-emerald-600"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? "text-emerald-700" : "text-slate-500"
                      }`}
                    />
                    <span>{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Quick Booking link */}
      <div className="pt-3 border-t border-slate-100">
        <Link
          href="/book/campflow-rv-resort"
          target="_blank"
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 transition-colors"
        >
          <span>Public Booking Page</span>
          <span className="text-xs">↗</span>
        </Link>
      </div>
    </aside>
  );
}
