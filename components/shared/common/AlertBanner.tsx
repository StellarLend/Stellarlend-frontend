"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info, ShieldAlert, X, XCircle, CheckCircle } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export type AlertBannerSeverity = "info" | "warning" | "critical" | "error" | "success";


const bannerStyles: Record<AlertBannerSeverity, string> = {
  info: "bg-slate-100 border-slate-200 text-slate-900",
  warning: "bg-amber-100 border-amber-200 text-amber-950",
  critical: "bg-red-100 border-red-200 text-red-950",
  error: "bg-red-200 border-red-300 text-red-950",
  success: "bg-green-100 border-green-200 text-green-950",
};

const iconStyles: Record<AlertBannerSeverity, string> = {
  info: "bg-slate-200 text-slate-900",
  warning: "bg-amber-200 text-amber-950",
  critical: "bg-red-200 text-red-950",
  error: "bg-red-300 text-red-950",
  success: "bg-green-200 text-green-950",
};

const severityLabels: Record<AlertBannerSeverity, string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
  error: "Error",
  success: "Success",
};

const iconMap = {
  info: Info,
  warning: AlertTriangle,
  critical: ShieldAlert,
  error: XCircle,
  success: CheckCircle,
};

export interface AlertBannerProps {
  title: string;
  message: string;
  severity?: AlertBannerSeverity;
  dismissKey?: string;
  onDismiss?: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  title,
  message,
  severity = "info",
  dismissKey,
  onDismiss,
}) => {
  const [isReady, setIsReady] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!dismissKey) {
      setIsReady(true);
      return;
    }

    const dismissed = window.localStorage.getItem(dismissKey) === "dismissed";
    setIsDismissed(dismissed);
    setIsReady(true);
  }, [dismissKey]);

  const handleDismiss = () => {
    if (dismissKey) {
      window.localStorage.setItem(dismissKey, "dismissed");
    }
    setIsDismissed(true);
    onDismiss?.();
  };

  if (!isReady || isDismissed) {
    return null;
  }

  const BannerIcon = iconMap[severity];
  const titleId = `alert-banner-${severity}-title`;
  const messageId = `alert-banner-${severity}-message`;

  return (
    <section
      role={severity === "critical" || severity === "error" ? "alert" : "status"}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      aria-live={severity === "critical" || severity === "error" ? "assertive" : "polite"}
      className={`rounded-2xl border px-4 py-4 shadow-sm ${bannerStyles[severity]}`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${iconStyles[severity]}`}
            aria-hidden="true"
          >
            <BannerIcon size={20} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em]">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold tracking-wide text-slate-700">
                {severityLabels[severity]}
              </span>
              <span id={titleId} className="text-base font-semibold leading-tight">
                {title}
              </span>
            </div>
            <p id={messageId} className="mt-2 text-sm leading-6 text-slate-700">
              {message}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-current/15 bg-white/80 text-slate-700 hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 ${
            shouldReduceMotion ? "" : "transition"
          }`}
          aria-label="Dismiss alert"
        >
          <X size={18} />
        </button>
      </div>
    </section>
  );
};

export default AlertBanner;
