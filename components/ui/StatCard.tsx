import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: string;
  trendPositive?: boolean;
  colorClass?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendPositive,
  colorClass = "text-primary",
}: StatCardProps) {
  return (
    <div className="card bg-base-100 shadow-sm border border-base-200/80 hover:border-base-300 transition-all p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-base-content/60">{title}</p>
          <h3 className="text-2xl lg:text-3xl font-bold mt-1 tracking-tight text-base-content">{value}</h3>
          {subtitle && <p className="text-xs text-base-content/60 mt-1">{subtitle}</p>}
          {trend && (
            <span
              className={`inline-flex items-center text-xs font-semibold mt-2 ${
                trendPositive ? "text-success" : "text-error"
              }`}
            >
              {trend}
            </span>
          )}
        </div>
        {icon && <div className={`p-3 rounded-xl bg-base-200/60 ${colorClass}`}>{icon}</div>}
      </div>
    </div>
  );
}
