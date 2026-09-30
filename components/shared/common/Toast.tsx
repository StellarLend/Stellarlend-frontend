"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export type ToastVariant = "processing" | "success" | "error" | "info";

export interface ToastProps {
  id?: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  className?: string;
  position?: "fixed" | "inline";
  shouldReduceMotion?: boolean;
}

export default function Toast({
  title,
  description,
  variant = "info",
  className = "",
  position = "fixed",
  shouldReduceMotion = false,
}: ToastProps) {
  const variantClasses =
    variant === "success"
      ? "bg-green-50 text-green-800 border border-green-200"
      : variant === "error"
        ? "bg-red-50 text-red-800 border border-red-200"
        : variant === "processing"
          ? "bg-yellow-50 text-yellow-800 border border-yellow-200"
          : "bg-blue-50 text-blue-800 border border-blue-200";
  const positionClasses =
    position === "fixed" ? "fixed right-4 top-6 z-50" : "";
  const motionClass = shouldReduceMotion ? "" : "toast-enter";

  return (
    <div
      className={`${positionClasses} max-w-sm p-3 rounded-lg shadow-lg ${variantClasses} ${motionClass} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      {title && <div className="font-medium mb-1">{title}</div>}
      {description && <div className="text-sm">{description}</div>}
    </div>
  );
}

export interface ToastMessage {
  id?: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (toast: ToastMessage) => string;
  dismissToast: (id: string) => void;
}

type ActiveToast = ToastMessage & {
  id: string;
  durationMs: number;
};

interface ToastProviderProps {
  children: React.ReactNode;
  defaultDurationMs?: number;
  maxToasts?: number;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({
  children,
  defaultDurationMs = 5000,
  maxToasts = 3,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const idCounter = useRef(0);
  const shouldReduceMotion = useReducedMotion();

  const dismissToast = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: ToastMessage) => {
      const id = toast.id ?? `toast-${Date.now()}-${idCounter.current++}`;
      const durationMs = toast.durationMs ?? defaultDurationMs;

      setToasts((current) => {
        const next = current.filter((item) => item.id !== id);
        next.push({ ...toast, id, durationMs });
        return next.slice(-maxToasts);
      });

      const existingTimer = timers.current.get(id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      timers.current.set(
        id,
        setTimeout(() => dismissToast(id), durationMs),
      );

      return id;
    },
    [defaultDurationMs, dismissToast, maxToasts],
  );

  useEffect(() => {
    const activeTimers = timers.current;

    return () => {
      for (const timer of activeTimers.values()) {
        clearTimeout(timer);
      }
      activeTimers.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-6 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            title={toast.title}
            description={toast.description}
            variant={toast.variant}
            position="inline"
            className="pointer-events-auto w-full"
            shouldReduceMotion={shouldReduceMotion}
          />
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
