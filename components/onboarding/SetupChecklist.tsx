"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import apiClient from "@/lib/axios/client";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, Circle, ExternalLink, Copy, X } from "lucide-react";

interface SetupStep {
  key: string;
  title: string;
  detail: string;
  done: boolean;
  optional: boolean;
  href: string;
}
interface SetupStatus {
  slug: string;
  readyForBookings: boolean;
  completed: number;
  total: number;
  requiredRemaining: number;
  steps: SetupStep[];
}

const DISMISS_KEY = (slug: string) => `campflow_setup_dismissed_${slug}`;

/**
 * Owner onboarding checklist: what's left before guests can book, computed from real park data.
 * Shown to owners/managers; collapses to a booking-link bar once the required steps are done.
 */
export function SetupChecklist() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const canManage = user?.role === "owner" || user?.role === "manager";

  useEffect(() => {
    if (!canManage) return;
    apiClient
      .get("/api/property/setup")
      .then((res) => {
        const s: SetupStatus = res.data?.data;
        setStatus(s);
        try {
          setDismissed(localStorage.getItem(DISMISS_KEY(s.slug)) === "1");
        } catch {
          /* storage unavailable */
        }
      })
      .catch(() => setStatus(null));
  }, [canManage]);

  if (!canManage || !status) return null;

  const bookingUrl = typeof window !== "undefined" ? `${window.location.origin}/book/${status.slug}` : `/book/${status.slug}`;

  if (status.requiredRemaining === 0) {
    if (dismissed) return null;
    return (
      <div className="surface-card p-3 rounded-lg border border-emerald-200 bg-emerald-50/60 flex flex-wrap items-center gap-2 text-xs">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        <span className="font-semibold text-emerald-900">Your park is set up and taking online bookings:</span>
        <a href={`/book/${status.slug}`} target="_blank" rel="noreferrer" className="font-mono text-emerald-800 underline break-all">
          {bookingUrl}
        </a>
        <button
          type="button"
          className="btn btn-ghost btn-xs gap-1"
          onClick={() => {
            navigator.clipboard?.writeText(bookingUrl).then(() => setCopied(true)).catch(() => {});
          }}
        >
          <Copy className="w-3 h-3" /> {copied ? "Copied" : "Copy link"}
        </button>
        <button
          type="button"
          aria-label="Hide"
          className="btn btn-ghost btn-xs btn-circle ml-auto"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(DISMISS_KEY(status.slug), "1");
            } catch {
              /* ignore */
            }
          }}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  const pct = Math.round((status.completed / status.total) * 100);
  return (
    <section aria-labelledby="setup-title" className="surface-card p-4 sm:p-5 rounded-lg border border-amber-200 bg-amber-50/40 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="setup-title" className="font-bold text-sm text-slate-900">
            Finish setting up your park
          </h2>
          <p className="text-xs text-slate-600">
            {status.requiredRemaining} required step{status.requiredRemaining === 1 ? "" : "s"} left before guests can book online.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <progress className="progress progress-success w-32" value={pct} max={100} aria-label={`${pct}% complete`} />
          {status.completed}/{status.total}
        </div>
      </div>
      <ol className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {status.steps.map((step) => {
          const isBookingLink = step.key === "booking";
          const content = (
            <>
              {step.done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              )}
              <span className="min-w-0">
                <span className={`block text-xs font-semibold ${step.done ? "text-slate-500 line-through" : "text-slate-900"}`}>
                  {step.title}
                  {step.optional && <span className="ml-1 font-normal text-slate-400 no-underline">(optional)</span>}
                </span>
                <span className="block text-[11px] text-slate-500 break-words">{step.detail}</span>
              </span>
              {isBookingLink && step.done && <ExternalLink className="w-3 h-3 text-slate-400 ml-auto shrink-0" />}
            </>
          );
          const cls = "flex items-start gap-2 p-2 rounded-md bg-white border border-slate-200 hover:border-slate-300";
          return (
            <li key={step.key}>
              {isBookingLink ? (
                step.done ? (
                  <a href={step.href} target="_blank" rel="noreferrer" className={cls}>
                    {content}
                  </a>
                ) : (
                  <div className={`${cls} opacity-70`}>{content}</div>
                )
              ) : (
                <Link href={step.href} className={cls}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
