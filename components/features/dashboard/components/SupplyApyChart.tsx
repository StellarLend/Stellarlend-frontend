"use client";

import { useMemo, useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { buildSvgPath } from "@/lib/utils/svg";
import {
  useChartHistory,
  isChartLoading,
  getSnapshots,
  type UseChartHistoryOptions,
} from "@/hooks/useChartHistory";

const HISTORY_URL = "/api/positions/history?interval=1d";

const CHART_WIDTH = 280;
const CHART_HEIGHT = 96;
const CHART_PADDING = 8;

interface SupplyApyChartProps {
  className?: string;
  /** Overrides `fetch` — used in tests. */
  fetcher?: UseChartHistoryOptions["fetcher"];
}

/**
 * Lightweight APY trend sparkline for the position summary dashboard.
 *
 * Data integrity guarantees (delegated to useChartHistory):
 * - State transitions are atomic: a single discriminated-union dispatch
 *   prevents torn intermediate states.
 * - Duplicate concurrent mounts share one in-flight HTTP request.
 * - Stale responses from superseded fetches are silently discarded.
 * - Up to 3 retries with exponential back-off; stale data is preserved
 *   and surfaced while retries are in progress.
 * - APY values are clamped to [0, 100] before rendering.
 */
export const SupplyApyChart: React.FC<SupplyApyChartProps> = ({
  className,
  fetcher,
}) => {
  const { state } = useChartHistory(HISTORY_URL, { fetcher });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [errorKind, setErrorKind] = useState<"network" | "forbidden" | "unavailable">("network");

  useEffect(() => {
    const media =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;

    if (media?.matches) setReducedMotion(true);

    const handleChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    media?.addEventListener?.("change", handleChange);
    return () => media?.removeEventListener?.("change", handleChange);
  }, []);

  const loading = isChartLoading(state);
  const isStale = state.status === "loading-stale" || state.status === "error";
  const points = getSnapshots(state);

  const chart = useMemo(() => {
    if (points.length === 0) return null;

    const values = points.map((p) => p.supplyApy);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;
    // Lower bound never goes below 0 (APY is non-negative after normalisation)
    const lowerBound = Math.max(0, minValue - range * 0.1);
    const upperBound = maxValue + range * 0.1;

    const mappedPoints = points.map((point, index) => {
      const x =
        CHART_PADDING +
        (points.length === 1 ? 0.5 : index / (points.length - 1)) *
          (CHART_WIDTH - CHART_PADDING * 2);
      const normalized =
        (point.supplyApy - lowerBound) / (upperBound - lowerBound || 1);
      const y =
        CHART_HEIGHT -
        CHART_PADDING -
        normalized * (CHART_HEIGHT - CHART_PADDING * 2);
      return { x, y };
    });

    const linePath = buildSvgPath(mappedPoints);
    const baselineY = CHART_HEIGHT - CHART_PADDING;
    const areaPath =
      mappedPoints.length === 1
        ? `${linePath} L ${mappedPoints[0].x.toFixed(2)} ${baselineY} Z`
        : `${linePath} L ${mappedPoints[mappedPoints.length - 1].x.toFixed(2)} ${baselineY} L ${mappedPoints[0].x.toFixed(2)} ${baselineY} Z`;

    const latest = points[points.length - 1];
    const first = points[0];
    const change = latest.supplyApy - first.supplyApy;
    const msPerDay = 24 * 60 * 60 * 1000;
    const elapsedDays = Math.round(
      (latest.timestamp - first.timestamp) / msPerDay,
    );
    const rangeText =
      elapsedDays <= 0
        ? `as of ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(latest.timestamp))}`
        : elapsedDays === 1
          ? "over the last day"
          : `over the last ${elapsedDays} days`;
    const changeText =
      change === 0
        ? "unchanged"
        : `trending ${change > 0 ? "up" : "down"} ${Math.abs(change).toFixed(2)}%`;
    const summary = `Supply APY is ${latest.supplyApy.toFixed(2)}%, ${changeText} ${rangeText}.`;

    return {
      linePath,
      areaPath,
      lastPoint: mappedPoints[mappedPoints.length - 1],
      latestApy: latest.supplyApy,
      latestNetValue: latest.netValue,
      summary,
    };
  }, [points]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading && state.status === "loading") {
    return (
      <div
        className={`rounded-xl border border-[#71B48D33] bg-[#072815] p-4 ${className ?? ""}`}
        role="status"
        aria-label="Loading trend data"
      >
        <div className="mb-2 h-3 w-24 rounded bg-[#71B48D33]" />
        <div className="h-20 animate-pulse rounded-lg bg-[#0A3D1E] motion-reduce:animate-none" />
      </div>
    );
  }

  // ── Empty ────────────────────────────────────────────────────────────────────
  if (state.status === "empty") {
    return (
      <div
        className={`rounded-xl border border-[#71B48D33] bg-[#072815] p-4 ${className ?? ""}`}
      >
        <p className="text-sm font-medium text-[#D4F3E6]">Supply APY trend</p>
        <p className="mt-2 text-sm text-[#AAABAB]">No trend history available</p>
      </div>
    );
  }

  // ── Hard error (no stale data to fall back on) ───────────────────────────────
  if (state.status === "error" && points.length === 0) {
    return (
      <div
        className={`rounded-xl border border-[#71B48D33] bg-[#072815] p-4 ${className ?? ""}`}
        role="alert"
      >
        <p className="text-sm font-medium text-[#D4F3E6]">Supply APY trend</p>
        <p className="mt-2 text-sm text-[#AAABAB]">{message}</p>
        <button
          type="button"
          onClick={() => setRetryCount((count) => count + 1)}
          className="mt-3 rounded-md bg-[#71B48D] px-3 py-1.5 text-xs font-semibold text-[#072815] transition-colors hover:bg-[#8FD0A8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F3E6] motion-reduce:transition-none"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── No chart geometry (shouldn't reach here, guards against bad state) ───────
  if (!chart) {
    return (
      <div
        className={`rounded-xl border border-[#71B48D33] bg-[#072815] p-4 ${className ?? ""}`}
        role="alert"
      >
        <p className="text-sm font-medium text-[#D4F3E6]">Supply APY trend</p>
        <p className="mt-2 text-sm text-[#AAABAB]">Trend data unavailable</p>
      </div>
    );
  }

  // ── Chart ────────────────────────────────────────────────────────────────────
  return (
    <div
      className={`rounded-xl border border-[#71B48D33] bg-[#072815] p-4 ${className ?? ""}`}
    >
      {/* Stale-data advisory (shown while retries are in-flight) */}
      {isStale && (
        <div
          className="mb-3 flex items-center gap-2 rounded-lg border border-amber-700 bg-amber-950 px-3 py-2"
          role="status"
          aria-label="Retrying to load latest trend data"
        >
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" aria-hidden="true" />
          <p className="text-xs text-amber-300">Displaying last known data</p>
        </div>
      )}

      {/* Loading overlay when retrying with stale data */}
      {loading && (
        <div
          className="mb-2 h-1 w-full overflow-hidden rounded-full bg-[#0A3D1E]"
          role="progressbar"
          aria-label="Refreshing trend data"
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[#71B48D] motion-reduce:animate-none" />
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#D4F3E6]">Supply APY trend</p>
          <p className="text-xs text-[#AAABAB]">Daily history</p>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold text-white">
            {chart.latestApy.toFixed(2)}%
          </p>
          <p className="text-xs text-[#AAABAB]">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }).format(chart.latestNetValue)}
          </p>
        </div>
      </div>

      <div className="sr-only">{chart.summary}</div>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label="Supply APY trend"
        className="h-24 w-full"
        style={reducedMotion ? { transition: "none" } : undefined}
      >
        <path d={chart.areaPath} fill="rgba(113, 180, 141, 0.22)" />
        <path
          d={chart.linePath}
          fill="none"
          stroke="#71B48D"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {chart.lastPoint && (
          <circle
            cx={chart.lastPoint.x}
            cy={chart.lastPoint.y}
            r="3.5"
            fill="#D4F3E6"
          />
        )}
      </svg>
    </div>
  );
};

export default SupplyApyChart;
