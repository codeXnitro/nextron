"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

type ToastListener = (toast: ToastItem) => void;
const listeners = new Set<ToastListener>();

export const toast = {
  success(title: string, description?: string) {
    const item: ToastItem = { id: Math.random().toString(36).slice(2, 9), type: "success", title, description };
    listeners.forEach((fn) => fn(item));
  },
  error(title: string, description?: string) {
    const item: ToastItem = { id: Math.random().toString(36).slice(2, 9), type: "error", title, description };
    listeners.forEach((fn) => fn(item));
  },
  info(title: string, description?: string) {
    const item: ToastItem = { id: Math.random().toString(36).slice(2, 9), type: "info", title, description };
    listeners.forEach((fn) => fn(item));
  },
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleToast = (item: ToastItem) => {
      setToasts((prev) => [...prev, item]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== item.id));
      }, 4000);
    };

    listeners.add(handleToast);
    return () => {
      listeners.delete(handleToast);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border/80 bg-card/95 backdrop-blur-md p-3.5 shadow-xl transition-all animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="shrink-0 mt-0.5">
            {t.type === "success" && <CheckCircle2 className="size-4 text-emerald-500" />}
            {t.type === "error" && <AlertCircle className="size-4 text-rose-500" />}
            {t.type === "info" && <Info className="size-4 text-sky-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">{t.title}</p>
            {t.description && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{t.description}</p>}
          </div>
          <button
            type="button"
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
