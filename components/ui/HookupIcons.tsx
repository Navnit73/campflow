import React from "react";
import { Zap, Droplets, ArrowRightLeft, CornerDownLeft, Tent, ShieldCheck } from "lucide-react";
import { ElectricHookup, RigType } from "@/lib/constants";

interface HookupIconsProps {
  hookups?: {
    electric?: ElectricHookup | string;
    water?: boolean;
    sewer?: boolean;
  };
  rigType?: RigType | string;
  maxRigLength?: number;
  compact?: boolean;
}

export function HookupIcons({ hookups, rigType, maxRigLength, compact = false }: HookupIconsProps) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "text-xs" : "text-xs"}`}>
      {/* Electric */}
      {hookups?.electric && hookups.electric !== "none" && (
        <span
          className="badge badge-sm badge-outline gap-1 font-semibold border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30"
          title={`${hookups.electric} Electric Service`}
        >
          <Zap className="w-3 h-3 text-amber-500" />
          {hookups.electric}
        </span>
      )}

      {/* Water */}
      {hookups?.water && (
        <span
          className="badge badge-sm badge-outline gap-1 font-semibold border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30"
          title="Potable Water Hookup"
        >
          <Droplets className="w-3 h-3 text-blue-500" />
          Water
        </span>
      )}

      {/* Sewer */}
      {hookups?.sewer && (
        <span
          className="badge badge-sm badge-outline gap-1 font-semibold border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30"
          title="Direct Sewer Hookup"
        >
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          Sewer
        </span>
      )}

      {/* Rig Type */}
      {rigType === "pull_through" && (
        <span
          className="badge badge-sm badge-ghost gap-1 text-slate-600 dark:text-slate-300 font-medium"
          title="Pull-Through Access"
        >
          <ArrowRightLeft className="w-3 h-3 text-primary" />
          Pull-Thru
        </span>
      )}
      {rigType === "back_in" && (
        <span
          className="badge badge-sm badge-ghost gap-1 text-slate-600 dark:text-slate-300 font-medium"
          title="Back-In Access"
        >
          <CornerDownLeft className="w-3 h-3 text-slate-500" />
          Back-In
        </span>
      )}
      {rigType === "tent" && (
        <span
          className="badge badge-sm badge-ghost gap-1 text-slate-600 dark:text-slate-300 font-medium"
          title="Tent / Pop-Up Site"
        >
          <Tent className="w-3 h-3 text-amber-600" />
          Tent
        </span>
      )}

      {/* Max Length */}
      {maxRigLength !== undefined && maxRigLength > 0 && (
        <span className="badge badge-sm badge-ghost text-slate-500 font-mono text-[11px]">
          Max {maxRigLength}ft
        </span>
      )}
    </div>
  );
}
