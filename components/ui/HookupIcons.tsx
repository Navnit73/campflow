import React from "react";
import { Zap, Droplets, ArrowDownToLine, Flame, Tent, Truck } from "lucide-react";

interface HookupIconsProps {
  hookups?: {
    electric?: string;
    water?: boolean;
    sewer?: boolean;
  };
  rigType?: string;
  maxRigLength?: number;
  compact?: boolean;
}

export function HookupIcons({ hookups, rigType, maxRigLength, compact = false }: HookupIconsProps) {
  const electric = hookups?.electric || "30A";
  const water = hookups?.water ?? true;
  const sewer = hookups?.sewer ?? true;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {electric && (
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200"
            title={`Electric: ${electric}`}
          >
            <Zap className="w-2.5 h-2.5 text-amber-600" />
            {electric}
          </span>
        )}
        {water && (
          <span
            className="inline-flex items-center px-1 py-0.5 rounded text-[10px] bg-sky-50 text-sky-800 border border-sky-200"
            title="City Water Hookup"
          >
            <Droplets className="w-2.5 h-2.5 text-sky-600" />
          </span>
        )}
        {sewer && (
          <span
            className="inline-flex items-center px-1 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200"
            title="Sewer Hookup"
          >
            <ArrowDownToLine className="w-2.5 h-2.5 text-emerald-600" />
          </span>
        )}
        {maxRigLength ? (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200"
            title={`Max rig length: ${maxRigLength}ft`}
          >
            {maxRigLength}ft
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {electric && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200">
          <Zap className="w-3 h-3 text-amber-600" />
          {electric}
        </span>
      )}
      {water && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200">
          <Droplets className="w-3 h-3 text-sky-600" />
          Water
        </span>
      )}
      {sewer && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
          <ArrowDownToLine className="w-3 h-3 text-emerald-600" />
          Sewer
        </span>
      )}
      {rigType && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 capitalize">
          <Truck className="w-3 h-3 text-slate-600" />
          {rigType.replace("_", " ")}
        </span>
      )}
      {maxRigLength ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          Max {maxRigLength} ft
        </span>
      ) : null}
    </div>
  );
}
