"use client";

import React, { createContext, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider
      value={{
        toast: addToast,
        success: (msg) => addToast(msg, "success"),
        error: (msg) => addToast(msg, "error"),
      }}
    >
      {children}
      <div className="toast toast-bottom toast-end z-50 p-4 space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`shadow-xl flex items-center justify-between text-xs sm:text-sm py-3 px-4 rounded-xl border pointer-events-auto transition-all animate-scale-in ${
              t.type === "success"
                ? "bg-emerald-800 text-white border-emerald-900"
                : t.type === "error"
                ? "bg-rose-800 text-white border-rose-900"
                : t.type === "warning"
                ? "bg-amber-800 text-white border-amber-900"
                : "bg-slate-800 text-white border-slate-900"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              {t.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />}
              {t.type === "error" && <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />}
              {t.type === "warning" && <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />}
              {t.type === "info" && <Info className="w-4 h-4 text-sky-300 shrink-0" />}
              <span className="font-medium leading-snug">{t.message}</span>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="btn btn-ghost btn-xs btn-circle text-white/80 hover:text-white shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
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
