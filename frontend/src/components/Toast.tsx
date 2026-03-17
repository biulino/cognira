"use client";

import { createContext, useCallback, useContext, useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from "lucide-react";
import { registerGlobalToast } from "@/lib/globalToast";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => remove(id), 4500);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function remove(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  const value: ToastContextValue = {
    success: (t, m) => add("success", t, m),
    error:   (t, m) => add("error", t, m),
    info:    (t, m) => add("info", t, m),
    warning: (t, m) => add("warning", t, m),
  };

  // Register so non-React modules (api.ts, etc.) can fire toasts globally
  useEffect(() => { registerGlobalToast(value); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Portal — fixed bottom-right stack */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => remove(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Single toast item ────────────────────────────────────────────────────────

const STYLES: Record<ToastType, { bar: string; icon: string; bg: string; text: string }> = {
  success: {
    bar:  "bg-green-500",
    icon: "text-green-600",
    bg:   "bg-white dark:bg-slate-800",
    text: "text-slate-800 dark:text-slate-100",
  },
  error: {
    bar:  "bg-red-500",
    icon: "text-red-500",
    bg:   "bg-white dark:bg-slate-800",
    text: "text-slate-800 dark:text-slate-100",
  },
  info: {
    bar:  "bg-blue-500",
    icon: "text-blue-500",
    bg:   "bg-white dark:bg-slate-800",
    text: "text-slate-800 dark:text-slate-100",
  },
  warning: {
    bar:  "bg-amber-400",
    icon: "text-amber-500",
    bg:   "bg-white dark:bg-slate-800",
    text: "text-slate-800 dark:text-slate-100",
  },
};

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error:   AlertCircle,
  info:    Info,
  warning: AlertTriangle,
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // mount → fade in
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const s = STYLES[toast.type];
  const Icon = ICONS[toast.type];

  return (
    <div
      className={`
        pointer-events-auto w-80 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700
        overflow-hidden flex gap-0 transition-all duration-300
        ${s.bg}
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
      `}
      role="alert"
    >
      {/* Colour bar */}
      <div className={`w-1 shrink-0 ${s.bar}`} />
      {/* Content */}
      <div className="flex items-start gap-3 px-4 py-3 flex-1 min-w-0">
        <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${s.icon}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold leading-snug ${s.text}`}>{toast.title}</p>
          {toast.message && (
            <p className={`text-xs mt-0.5 opacity-70 ${s.text}`}>{toast.message}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 text-slate-400 hover:text-slate-600 transition mt-0.5"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
