import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  colorClass?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  colorClass = "bg-emerald-500/10 text-emerald-600",
}: StatCardProps) {
  return (
    <div className="surface-card p-4 rounded-lg flex flex-col justify-between space-y-2 border border-slate-200">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
          {title}
        </span>
        {icon && (
          <div className={`p-1.5 rounded-md shrink-0 ${colorClass}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="space-y-0.5">
        <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900 truncate">
          {value}
        </div>
        {subtitle && (
          <p className="text-[11px] text-slate-500 font-medium truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
