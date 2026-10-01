"use client";

import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { buildSvgPath } from "@/lib/utils/svg";
import {
  useChartHistory,
  isChartLoading,
  getSnapshots,
  type NormalizedSnapshot,
  type UseChartHistoryOptions,
} from "@/hooks/useChartHistory";

const HISTORY_URL = "/api/positions/history?interval=1d";

const CHART_WIDTH = 280;
const CHART_HEIGHT = 108;
const CHART_PADDING = 10;
const DEFAULT_LIQUIDATION_THRESHOLD = 1;

interface CollateralRatioPoint {
  timestamp: number;
  /** supplied / borrowed — only present when borrowed > 0 */
  ratio: number;
}

interface CollateralRatioHistoryChartProps {
  className?: string;
  liquidationThreshold?: number;
  /** Overrides `fetch` — used in tests. */
  fetcher?: UseChartHistoryOptions["fetcher"];
}

function formatRatio(value: number): string {
  return `${value.toFixed(2)}x`;
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function getDateRangeText(first: number, last: number): string {
  const days = Math.round((last - first) / (24 * 60 * 60 * 1000));
  if (days <= 0) return `as of ${formatDate(last)}`;
  if (days === 1) return "over the last day";
  return `over the last ${days} days`;
}

function formatCollateralRatioSummary(
  latestRatio: number,
  firstRatio: number,
  firstTimestamp: number,
  lastTimestamp: number,
): string {
  const change = latestRatio - firstRatio;
  const changeText =
    change === 0
      ? "unchanged"
      : `trending ${change > 0 ? "up" : "down"} ${Math.abs(change).toFixed(2)}x`;
  return `Collateral ratio is ${formatRatio(latestRatio)}, ${changeText} ${getDateRangeText(firstTimestamp, lastTimestamp)}.`;
}

/**
 * Converts normalised snapshots → collateral ratio points.
 *
 * Invariant: only snapshots with a finite positive collateralRatio are
 * included (NormalizedSnapshot already guarantees borrowed > 0 when
 * collateralRatio is non-null).  Points are pre-sorted by timestamp by
 * the shared normalisation layer.
 */
function toRatioPoints(snapshots: NormalizedSnapshot[]): CollateralRatioPoint[] {
  return snapshots
    .filter((s) => s.collateralRatio !== null && s.collateralRatio > 0)
    .map((s) => ({ timestamp: s.timestamp, ratio: s.collateralRatio as number }));
}

export function CollateralRatioHistoryChart({
  className,
  liquidationThreshold = DEFAULT_LIQUIDATION_THRESHOLD,
  fetcher,
}: CollateralRatioHistoryChartProps) {
  const shouldReduceMotion = useReducedMotion();
  const { state } = useChartHistory(HISTORY_URL, { fetcher });

  const loading = isChartLoading(state);
  const isStale = state.status === "loading-stale" || state.status === "error";

  // Derive ratio points from whatever snapshots are available (may be stale)
  const ratioPoints: CollateralRatioPoint[] = useMemo(
    () => toRatioPoints(getSnapshots(state)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state],
  );

  const chart = useMemo(() => {
    if (ratioPoints.length === 0) return null;

    const ratioValues = ratioPoints.map((p) => p.ratio);
    const minValue = Math.min(...ratioValues, liquidationThreshold);
    const maxValue = Math.max(...ratioValues, liquidationThreshold);
    const range = maxValue - minValue || 1;
    // Lower bound never goes below 0 (ratios are non-negative)
    const lowerBound = Math.max(0, minValue - range * 0.18);
    const upperBound = maxValue + range * 0.18;

    const yForRatio = (ratio: number): number => {
      const normalized = (ratio - lowerBound) / (upperBound - lowerBound || 1);
      return CHART_HEIGHT - CHART_PADDING - normalized * (CHART_HEIGHT - CHART_PADDING * 2);
    };

    const mappedPoints = ratioPoints.map((point, index) => ({
      x:
        CHART_PADDING +
        (ratioPoints.length === 1 ? 0.5 : index / (ratioPoints.length - 1)) *
          (CHART_WIDTH - CHART_PADDING * 2),
      y: yForRatio(point.ratio),
    }));

    const latestPoint = ratioPoints[ratioPoints.length - 1];

    return {
      linePath: buildSvgPath(mappedPoints),
      thresholdY: yForRatio(threshold),
      latestPoint,
      latestSvgPoint: mappedPoints[mappedPoints.length - 1],
      firstLabel: formatDate(ratioPoints[0].timestamp),
      lastLabel: formatDate(latestPoint.timestamp),
      isBelowThreshold: latestPoint.ratio <= threshold,
      summary: formatCollateralRatioSummary(
        latestPoint.ratio,
        ratioPoints[0].ratio,
        ratioPoints[0].timestamp,
        latestPoint.timestamp,
      ),
    };
  }, [ratioPoints, liquidationThreshold]);

  // ── Loading (no stale data yet) ──────────────────────────────────────────────
  if (loading && state.status === "loading") {
    return (
      <div
        className={`rounded-xl border border-[#71B48D33] bg-[#072815] p-4 ${className ?? ""}`}
        role="status"
        aria-label="Loading collateral ratio history"
      >
        <div className="mb-2 h-3 w-36 rounded bg-[#71B48D33]" />
        <div className="h-24 animate-pulse rounded-lg bg-[#0A3D1E] motion-reduce:animate-none" />
      </div>
    );
  }

  // ── Empty (data arrived but no usable ratio points) ──────────────────────────
  if (state.status === "empty" || (ratioPoints.length === 0 && !loading && !isStale)) {
    return (
      <div
        className={`rounded-xl border border-[#71B48D33] bg-[#072815] p-4 ${className ?? ""}`}
      >
        <p className="text-sm font-medium text-[#D4F3E6]">
          Collateral ratio history
        </p>
        <p className="mt-2 text-sm text-[#AAABAB]">
          No collateral ratio history available
        </p>
        <button
          type="button"
          onClick={() => setRetryCount((count) => count + 1)}
          className="mt-3 text-sm font-medium text-[#71B48D] underline underline-offset-2 hover:text-[#D4F3E6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71B48D]"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Hard error with no stale data to fall back on ───────────────────────────
  if ((state.status === "error" || !chart) && ratioPoints.length === 0) {
    return (
      <div
        className={`rounded-xl border border-[#71B48D33] bg-[#072815] p-4 ${className ?? ""}`}
        role="alert"
      >
        <p className="text-sm font-medium text-[#D4F3E6]">
          Collateral ratio history
        </p>
        <p className="mt-2 text-sm text-[#AAABAB]">
          {isPermissionDenied
            ? "You don't have permission to view collateral ratio history"
            : "Collateral ratio history unavailable"}
        </p>
        <button
          type="button"
          onClick={() => setRetryCount((count) => count + 1)}
          className="mt-3 text-sm font-medium text-[#71B48D] underline underline-offset-2 hover:text-[#D4F3E6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71B48D]"
        >
          Retry
        </button>
      </div>
    );
  }

  // Defensive guard — keeps TypeScript happy; should not be reachable
  if (!chart) return null;

  // ── Chart (ready, loading-stale, or error-with-stale-data) ──────────────────
  return (
    <div
      className={`rounded-xl border border-[#71B48D33] bg-[#072815] p-4 ${className ?? ""}`}
    >
      {/* Stale-data advisory shown while retries are in-flight */}
      {isStale && (
        <div
          className="mb-3 flex items-center gap-2 rounded-lg border border-amber-700 bg-amber-950 px-3 py-2"
          role="status"
          aria-label="Retrying to load latest collateral ratio data"
        >
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" aria-hidden="true" />
          <p className="text-xs text-amber-300">Displaying last known data</p>
        </div>
      )}

      {/* Thin progress bar while re-fetching with stale data visible */}
      {loading && (
        <div
          className="mb-2 h-1 w-full overflow-hidden rounded-full bg-[#0A3D1E]"
          role="progressbar"
          aria-label="Refreshing collateral ratio data"
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[#71B48D] motion-reduce:animate-none" />
        </div>
      )}

      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#D4F3E6]">
            Collateral ratio history
          </p>
          <p className="text-xs text-[#AAABAB]">
            Threshold reference: {formatRatio(threshold)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold text-white">
            {formatRatio(chart.latestPoint.ratio)}
          </p>
          <p
            className={
              chart.isBelowThreshold ? "text-xs text-red-300" : "text-xs text-[#AAABAB]"
            }
          >
            {chart.isBelowThreshold ? "At liquidation threshold" : "Latest ratio"}
          </p>
        </div>
      </div>

      <div className="sr-only">{chart.summary}</div>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={`Collateral ratio history chart. Latest ratio ${formatRatio(
          chart.latestPoint.ratio,
        )}; liquidation threshold ${formatRatio(threshold)}.`}
        className="h-28 w-full"
        style={shouldReduceMotion ? { transition: "none" } : undefined}
      >
        <line
          x1={CHART_PADDING}
          x2={CHART_WIDTH - CHART_PADDING}
          y1={chart.thresholdY}
          y2={chart.thresholdY}
          stroke="#F59E0B"
          strokeDasharray="5 5"
          strokeWidth="1.5"
        />
        <path
          d={chart.linePath}
          fill="none"
          stroke={chart.isBelowThreshold ? "#FCA5A5" : "#71B48D"}
          strokeLinecap="round"
          strokeWidth="2.5"
        />
        <circle
          cx={chart.latestSvgPoint.x}
          cy={chart.latestSvgPoint.y}
          r="3.5"
          fill="#D4F3E6"
        />
      </svg>

      <div className="mt-2 flex items-center justify-between text-xs text-[#AAABAB]">
        <span>{chart.firstLabel}</span>
        <span>{chart.lastLabel}</span>
      </div>
    </div>
  );
}

export default CollateralRatioHistoryChart;
