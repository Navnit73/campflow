"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  BookmarkCheck,
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
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Tape Chart", href: "/tape-chart", icon: CalendarDays },
  { name: "Reservations", href: "/reservations", icon: BookmarkCheck },
  { name: "Sites & Hookups", href: "/sites", icon: MapPin },
  { name: "Guests CRM", href: "/guests", icon: Users },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-base-100 border-r border-base-200 flex flex-col justify-between h-[calc(100vh-4rem)] p-4 shrink-0">
      <div className="space-y-6">
        <div>
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-base-content/40 mb-2">
            Operations Desk
          </p>
          <ul className="menu p-0 w-full space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                      isActive
                        ? "bg-primary text-primary-content font-semibold shadow-xs"
                        : "text-base-content/70 hover:text-base-content hover:bg-base-200"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 rounded-xl bg-base-200/50 border border-base-200/60">
        <div className="flex items-center gap-2">
          <Trees className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold text-base-content">CampFlow SaaS</span>
        </div>
        <p className="text-[11px] text-base-content/50 mt-0.5">
          v1.0 • RV Park & Campground Management
        </p>
      </div>
    </aside>
  );
}
