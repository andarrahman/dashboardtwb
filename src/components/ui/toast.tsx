"use client";

import * as React from "react";
import { RiCheckLine, RiCloseLine } from "@remixicon/react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ToastData {
  id: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastData, "id">) => void;
  dismissToast: (id: string) => void;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

// ─── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const showToast = React.useCallback((toast: Omit<ToastData, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-2), { ...toast, id }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

// ─── Toaster ───────────────────────────────────────────────────────────────────

function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastData;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-gray-900 text-white px-4 py-3 shadow-xl min-w-[340px] max-w-md animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Green check icon */}
      <div className="shrink-0 size-7 rounded-full bg-primary flex items-center justify-center">
        <RiCheckLine size={14} className="text-white" />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">{toast.title}</p>
        {toast.subtitle && (
          <p className="text-xs text-gray-400 mt-0.5">{toast.subtitle}</p>
        )}
      </div>

      {/* Action */}
      {toast.action && (
        <button
          onClick={toast.action.onClick}
          className="shrink-0 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
        >
          {toast.action.label}
        </button>
      )}

      {/* Close */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 size-6 inline-flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Dismiss"
      >
        <RiCloseLine size={14} />
      </button>
    </div>
  );
}
