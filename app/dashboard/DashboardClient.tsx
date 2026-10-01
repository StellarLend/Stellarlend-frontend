"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";

import MetricsCards from "@/components/features/dashboard/components/MetricsCards";
import LiquidationsPanel from "@/components/features/dashboard/components/LiquidationsPanel";
import NextPaymentDue from "@/components/features/dashboard/components/NextPaymentDue";
import NetWorthTrend from "@/components/features/dashboard/components/NetWorthTrend";
import { AlertBanner, PageHeader } from "@/components/shared/common";
import { RecentTransactions } from "@/components/shared/common/RecentTransactions";
import type { AlertBannerSeverity } from "@/components/shared/common/AlertBanner";

interface PositionMetrics {
  nextDue: string;
  healthFactor: number;
}

interface DashboardAlertData {
  title: string;
  message: string;
  severity: AlertBannerSeverity;
  dismissKey: string;
}

/**
 * Parse the number of days until the next payment is due.
 *
 * Invariants:
* - Returns a non-negative integer or `undefined` when the input is
 *   not a string, is empty, or does not contain a days token.
 * - Never throws. Malformed inputs degrade to `undefined` so the caller
 *   can decide whether to surface a fallback alert.
 */
export const parseNextDueDays = (nextDue: unknown): number | undefined => {
  if (typeof nextDue !== "string") {
    return undefined;
  }

  const match = nextDue.match(/(\d+)\s*days?/i);
  if (!match) {
    return undefined;
  }

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
};

/**
 * Derive the dashboard alert from position metrics.
 *
 * Invariants:
 * - Returns `null` when the health factor is not a finite number or is
 *   within the safe band and the due date is not within the alert window.
 * - Severity escalates to the highest of the due and health signals.
 * - Never throws on partial or malformed inputs.
 */
export const getDashboardAlertData = (
  position: PositionMetrics,
): DashboardAlertData | null => {
  const dueDays = parseNextDueDays(position.nextDue);
  const dueSeverity: AlertBannerSeverity | undefined =
    dueDays === undefined
      ? undefined
      : dueDays <= 1
      ? "critical"
      : dueDays <= 3
      ? "warning"
      : dueDays <= 7
      ? "info"
      : undefined;

  const healthFactor = position.healthFactor;
  const healthSeverity: AlertBannerSeverity | undefined =
    typeof healthFactor !== "number" || !Number.isFinite(healthFactor)
      ? undefined
      : healthFactor <= 1.15
      ? "critical"
      : healthFactor <= 1.25
      ? "warning"
      : healthFactor <= 1.35
      ? "info"
      : undefined;

  const severity: AlertBannerSeverity | undefined =
    dueSeverity === "critical" || healthSeverity === "critical"
      ? "critical"
      : dueSeverity === "warning" || healthSeverity === "warning"
      ? "warning"
      : dueSeverity === "info" || healthSeverity === "info"
      ? "info"
      : undefined;

  if (!severity) {
    return null;
  }

  if (severity === "critical") {
    if (dueSeverity === "critical") {
      return {
        title: "Immediate action required",
        message: `Your next payment of ${position.nextDue} is due very soon. Add collateral or repay now to avoid liquidation risk.`,
        severity,
        dismissKey: `dashboard-alert-banner-${severity}`,
      };
    }

    return {
      title: "Collateral is critically weak",
      message: `Your health factor is ${healthFactor.toFixed(2)}, which puts your position at high liquidation risk.`,
      severity,
      dismissKey: `dashboard-alert-banner-${severity}`,
    };
  }

  if (severity === "warning") {
    if (dueSeverity === "warning") {
      return {
        title: "Payment due soon",
        message: `Your next payment of ${position.nextDue} is approaching. Keep an eye on your collateral health.`,
        severity,
        dismissKey: `dashboard-alert-banner-${severity}`,
      };
    }

    return {
      title: "Collateral health warning",
      message: `Your health factor is ${healthFactor.toFixed(2)}. Consider rebalancing to avoid escalation.`,
      severity,
      dismissKey: `dashboard-alert-banner-${severity}`,
    };
  }

  return {
    title: "Upcoming payment",
    message: `Your next payment of ${position.nextDue} is due within the next week.`,
    severity,
    dismissKey: `dashboard-alert-banner-${severity}`,
  };
};

interface PositionsResponse {
  nextDue?: unknown;
  healthFactor?: unknown;
}

/**
 * Validate the shape of the /api/positions response.
  *
 * Invariants:
 * - Returns a normalized object with a string `nextDue` and a finite
 *   `healthFactor` number, or `null` if the payload is missing or malformed.
 * - Never throws on arbitrary JSON shapes.
 */
export const normalizePositionsResponse = (
  data: unknown,
): PositionMetrics | null => {
  if (!data || typeof data !== "object") {
    return null;
  }

  const { currencyNextDue, healthFactor } = data as PositionsResponse & {
    currencyNextDue?: unknown;
  };
  const nextDue = (data as PositionsResponse).nextDue ?? currencyNextDue;

  if (typeof nextDue !== "string" || nextDue.trim() === "") {
    return null;
  }

  if (typeof healthFactor !== "number" || !Number.isFinite(healthFactor)) {
    return null;
  }

  return { nextDue, healthFactor };
};

/**
 * Perform a single fetch of the positions endpoint with a hard timeout.
 *
 * Invariants:
 * - Resolves with a normalized `PositionMetrics` or throws a typed failure.
 * - Never leaves a pending request when the timeout fires.
 * - Never exposes raw server payloads to the caller.
 */
const FETCH_TIMEOUT_MS = 10_000;

const fetchPositionsOnce = async (
  signal: AbortSignal,
): Promise<PositionMetrics> => {
  const response = await fetch("/api/positions", { signal });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const json = await response.json().catch(() => null);
  const normalized = normalizePositionsResponse(json);

  if (!normalized) {
    throw new Error("Invalid positions payload");
  }

  return normalized;
};

const fetchPositionsWithTimeout = async (
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<PositionMetrics> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort);
    }
  }

  try {
    return await fetchPositionsOnce(controller.signal);
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
};

/**
 * Retry the positions fetch with exponential backoff.
 *
 * Invariants:
 * - Attempts are sequential, never concurrent.
 * - Aborts cleanly when the external signal is aborted.
 * - The final failure is surfaced as a typed error for the caller.
 */
const fetchPositionsWithRetry = async (
  signal: AbortSignal,
  attempts = 3,
): Promise<PositionMetrics> => {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    try {
      return await fetchPositionsWithTimeout(FETCH_TIMEOUT_MS, signal);
    } catch (error) {
      lastError = error;

      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      if (attempt < attempts - 1) {
        const backoffMs = 250 * 2**attempt;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unknown positions fetch failure");
};

export default function DashboardClient() {
  const [alertData, setAlertData] = useState<DashboardAlertData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    const controller = new AbortController();
    mountedRef.current = true;

    const load = async () => {
      try {
        const metrics = await fetchPositionsWithRetry(controller.signal);

        if (!mountedRef.current || controller.signal.aborted) {
          return;
        }

        setAlertData(getDashboardAlertData(metrics));
        setError(null);
      } catch (error) {
        if (!mountedRef.current || controller.signal.aborted) {
          return;
        }

        // Observability: log the failure without exposing sensitive data.
        console.error(
          "[DashboardClient] Failed to load positions after retries",
          error instanceof Error ? error.message : "Unknown error",
        );

        setAlertData(null);
        setError("Failed to load positions data. Please try again later.");
      }
    };

    void load();

    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, []);

  return (
    <div className="">
      <div className="md:pt-10 md:border-t px-6 md:px-12 flex-col-reverse md:flex-col flex">
        <PageHeader
          title="Dashboard"
          description="Track lending, borrowing, and collateral health at a glance."
          actions={
            <>
              <button className="bg-[#087734] hover:bg-[#0A3D1E] text-white border border-[#71B48D] rounded-lg flex items-center w-full sm:w-auto justify-center gap-2 py-3 px-6 transition-colors">
                <Image
                  src="/icons/coins-01.svg"
                  alt="Lend"
                  width={20}
                  height={20}
                />
                <span>Lend More</span>
              </button>

              <button className="bg-[#07c456] hover:bg-[#0A3D1E] text-white border border-[#71B48D] rounded-lg flex items-center w-full sm:w-auto justify-center gap-2 py-3 px-6 transition-colors">
                <Image
                  src="/icons/bank.svg"
                  alt="Borrow"
                  width={20}
                  height={20}
                />
                <span>Borrow Now</span>
              </button>
            </>
          }
        />

        {error ? (
          <div className="mb-6">
            <AlertBanner
              title="Error"
              message={error}
              severity="error"
            />
          </div>
        ) : alertData ? (
          <div className="mb-6">
            <AlertBanner
              title={alertData.title}
              message={alertData.message}
              severity={alertData.severity}
              dismissKey={alertData.dismissKey}
            />
          </div>
        ) : null}

         <NetWorthTrend />
         <MetricsCards />
        <NextPaymentDue />
        <div className="mt-6">
          <LiquidationsPanel />
        </div>
      </div>

      <div className="pt-8 ">
        <RecentTransactions />
      </div>
    </div>
  );
}
