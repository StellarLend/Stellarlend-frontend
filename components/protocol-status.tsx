"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  getProtocolStatus,
  allowedActions,
  type ProtocolStatus,
  type ActionName,
} from "@/lib/protocol-status";

interface ProtocolStatusContextType {
  status: ProtocolStatus | null;
  allowed: Set<ActionName>;
  isActionAllowed: (action: ActionName) => boolean;
}

const ProtocolStatusContext = createContext<ProtocolStatusContextType>({
  status: null,
  allowed: new Set<ActionName>(["supply", "withdraw", "borrow", "repay", "liquidate"]),
  isActionAllowed: () => true,
});

export const useProtocolStatus = () => useContext(ProtocolStatusContext);

export function ProtocolStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ProtocolStatus | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const fetchStatus = async () => {
      // If document is hidden, don't poll
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      const res = await getProtocolStatus();
      if (!isCancelled) {
        setStatus(res);
      }
    };

    // First fetch immediately
    fetchStatus();

    // Schedule polling every 30 seconds
    const interval = setInterval(() => {
      fetchStatus();
    }, 30000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchStatus();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      isCancelled = true;
      if (interval) clearInterval(interval);
      if (timer) clearTimeout(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, []);

  const allowed = status
    ? allowedActions(status)
    : new Set<ActionName>(["supply", "withdraw", "borrow", "repay", "liquidate"]);

  const isActionAllowed = (action: ActionName) => allowed.has(action);

  return (
    <ProtocolStatusContext.Provider value={{ status, allowed, isActionAllowed }}>
      {children}
    </ProtocolStatusContext.Provider>
  );
}

export function ProtocolStatusBanner() {
  const { status } = useProtocolStatus();
  const t = useTranslations("protocolStatus");

  // Avoid flashing banner on first paint: render nothing until first read resolves
  if (!status) {
    return null;
  }

  // RPC failure / unknown state
  if (status.kind === "unknown") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full bg-slate-800/80 border-b border-slate-700 px-4 py-2 text-xs sm:text-sm text-slate-300 flex items-center justify-center gap-2"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-slate-400" />
        <span>{t("unknown")}</span>
      </div>
    );
  }

  // Emergency State: Shutdown
  if (status.emergency === "Shutdown") {
    return (
      <div
        role="alert"
        className="w-full bg-red-950/90 border-b border-red-800 px-4 py-2.5 text-xs sm:text-sm text-red-200 flex items-center justify-center gap-2 font-medium"
      >
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
        <span>{t("shutdown")}</span>
      </div>
    );
  }

  // Emergency State: Recovery
  if (status.emergency === "Recovery") {
    return (
      <div
        role="alert"
        className="w-full bg-amber-950/90 border-b border-amber-800 px-4 py-2.5 text-xs sm:text-sm text-amber-200 flex items-center justify-center gap-2 font-medium"
      >
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
        <span>{t("recovery")}</span>
      </div>
    );
  }

  // Pause flag: All
  if (status.paused.All) {
    return (
      <div
        role="alert"
        className="w-full bg-amber-950/90 border-b border-amber-800 px-4 py-2.5 text-xs sm:text-sm text-amber-200 flex items-center justify-center gap-2 font-medium"
      >
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
        <span>{t("pausedAll")}</span>
      </div>
    );
  }

  // Granular pause flags
  const pausedOps: string[] = [];
  if (status.paused.Supply) pausedOps.push(t("ops.supply"));
  if (status.paused.Borrow) pausedOps.push(t("ops.borrow"));
  if (status.paused.Withdraw) pausedOps.push(t("ops.withdraw"));
  if (status.paused.Repay) pausedOps.push(t("ops.repay"));
  if (status.paused.Liquidate) pausedOps.push(t("ops.liquidate"));

  if (pausedOps.length > 0) {
    return (
      <div
        role="alert"
        className="w-full bg-amber-950/90 border-b border-amber-800 px-4 py-2.5 text-xs sm:text-sm text-amber-200 flex items-center justify-center gap-2 font-medium"
      >
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
        <span>{t("pausedSpecific", { ops: pausedOps.join(", ") })}</span>
      </div>
    );
  }

  // Normal, no pauses: nothing to render
  return null;
}
