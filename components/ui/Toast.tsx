"use client";

import React, { createContext, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, action?: ToastAction, durationMs?: number) => void;
  success: (message: string, action?: ToastAction, durationMs?: number) => void;
  error: (message: string, action?: ToastAction, durationMs?: number) => void;
  info: (message: string, action?: ToastAction, durationMs?: number) => void;
  warning: (message: string, action?: ToastAction, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (
    message: string,
    type: ToastType = "info",
    action?: ToastAction,
    durationMs = 4500
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, action }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationMs);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider
      value={{
        toast: addToast,
        success: (msg, act, dur) => addToast(msg, "success", act, dur),
        error: (msg, act, dur) => addToast(msg, "error", act, dur),
        info: (msg, act, dur) => addToast(msg, "info", act, dur),
        warning: (msg, act, dur) => addToast(msg, "warning", act, dur),
      }}
    >
      {children}
      <div className="toast toast-bottom toast-end z-50 p-4 space-y-2 max-w-md w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`shadow-xl flex items-center justify-between text-xs sm:text-sm py-3 px-4 rounded-xl border pointer-events-auto transition-all animate-scale-in gap-3 ${
              t.type === "success"
                ? "bg-emerald-900/95 text-white border-emerald-700 shadow-emerald-950/20"
                : t.type === "error"
                ? "bg-rose-900/95 text-white border-rose-700 shadow-rose-950/20"
                : t.type === "warning"
                ? "bg-amber-900/95 text-white border-amber-700 shadow-amber-950/20"
                : "bg-slate-900/95 text-white border-slate-700 shadow-slate-950/20"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-1">
              {t.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />}
              {t.type === "error" && <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />}
              {t.type === "warning" && <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />}
              {t.type === "info" && <Info className="w-4 h-4 text-sky-300 shrink-0" />}
              <span className="font-medium leading-snug">{t.message}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {t.action && (
                <button
                  onClick={() => {
                    t.action?.onClick();
                    removeToast(t.id);
                  }}
                  className="px-2.5 py-1 text-xs font-bold bg-white/20 hover:bg-white/30 text-white rounded-md transition-colors border border-white/20 shadow-xs"
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => removeToast(t.id)}
                className="btn btn-ghost btn-xs btn-circle text-white/80 hover:text-white shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
