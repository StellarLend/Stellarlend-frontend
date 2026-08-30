"use client";

import { useEffect, useMemo, useState } from "react";
import type { SnapshotHistoryResponse } from "@/lib/positions/snapshot";
import { buildSvgPath } from "@/lib/utils/svg";

interface SupplyApyChartPoint {
  timestamp: number;
  supplyApy: number;
  netValue: number;
}

interface SupplyApyChartProps {
  className?: string;
}

/**
 * Lightweight APY trend chart for the position summary dashboard.
 * Fetches the latest position history and renders a responsive sparkline with
 * accessible loading, empty, and error states.
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function getDateRangeText(firstTimestamp: number, lastTimestamp: number): string {
  const msPerDay = 24 * 60 * 60 * 1000;
  const elapsedDays = Math.round((lastTimestamp - firstTimestamp) / msPerDay);

  if (elapsedDays <= 0) {
    return `as of ${formatDate(lastTimestamp)}`;
  }

  if (elapsedDays === 1) {
    return "over the last day";
  }

  return `over the last ${elapsedDays} days`;
}

function formatTrendSummary(
  latestApy: number,
  firstApy: number,
  firstTimestamp: number,
  lastTimestamp: number,
): string {
  const change = latestApy - firstApy;
  const direction = change > 0 ? "up" : change < 0 ? "down" : "unchanged";
  const changeText = change === 0 ? "unchanged" : `trending ${direction} ${Math.abs(change).toFixed(2)}%`;
  const rangeText = getDateRangeText(firstTimestamp, lastTimestamp);

  return `Supply APY is ${latestApy.toFixed(2)}%, ${changeText} ${rangeText}.`;
}

function buildPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  return points.reduce((path, point, index) => {
    const prefix = index === 0 ? "M" : "L";
    return `${path} ${prefix} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }, "").trim();
}

function buildAreaPath(points: Array<{ x: number; y: number }>, width: number, height: number, padding: number): string {
  if (points.length === 0) {
    return "";
  }

  const linePath = buildSvgPath(points);
  if (!linePath) {
    return "";
  }

  const baselineY = height - padding;
  if (points.length === 1) {
    return `${linePath} L ${points[0].x.toFixed(2)} ${baselineY} Z`;
  }

  return `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${baselineY} L ${points[0].x.toFixed(2)} ${baselineY} Z`;
}

/**
 * Renders a responsive sparkline of supply APY from position history.
 *
 * Contract:
 * - All rendered points have finite numeric timestamp, supplyApy, and netValue.
 * - Points are sorted chronologically and de-duplicated by timestamp.
 * - Invalid or empty payloads render the empty state.
 * - Network and permission failures render an error state with retry.
 */
export const SupplyApyChart: React.FC<SupplyApyChartProps> = ({ className }) => {
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [points, setPoints] = useState<SupplyApyChartPoint[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [errorKind, setErrorKind] = useState<"network" | "forbidden" | "unavailable">("network");

  useEffect(() => {
    const media = typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;

    if (media?.matches) {
      setReducedMotion(true);
    }

    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    media?.addEventListener?.("change", handleChange);

    return () => {
      media?.removeEventListener?.("change", handleChange);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      setStatus("loading");
      setErrorKind("network");
      try {
        const response = await fetch("/api/positions/history?interval=1d", {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        if (response.status === 401 || response.status === 403) {
          setErrorKind("forbidden");
          throw new Error("Forbidden");
        }

        if (!response.ok) {
          setErrorKind("unavailable");
          throw new Error("Request failed");
        }

        const payload = (await response.json()) as SnapshotHistoryResponse;
        const snapshots = Array.isArray(payload?.snapshots) ? payload.snapshots : [];

        const chartPoints = snapshots
          .filter((snapshot) =>
            snapshot &&
            snapshot.timestamp != null &&
            snapshot.effectiveSupplyApy != null &&
            snapshot.supplied != null &&
            snapshot.borrowed != null &&
            Number.isFinite(Number(snapshot.timestamp)) &&
            Number.isFinite(Number(snapshot.effectiveSupplyApy)) &&
            Number.isFinite(Number(snapshot.supplied)) &&
            Number.isFinite(Number(snapshot.borrowed))
          )
          .map((snapshot) => ({
            timestamp: Number(snapshot.timestamp),
            supplyApy: Number(snapshot.effectiveSupplyApy),
            netValue: Number(snapshot.supplied) - Number(snapshot.borrowed),
          }))
          .sort((a, b) => a.timestamp - b.timestamp)
          .filter((point, index, array) => index === 0 || point.timestamp !== array[index - 1].timestamp);

        if (chartPoints.length === 0) {
          setPoints([]);
          setStatus("empty");
          return;
        }

        setPoints(chartPoints);
        setStatus("ready");
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        setPoints([]);
        setStatus("error");
      }
    }

    loadHistory();

    return () => controller.abort();
  }, [retryCount]);

  const chart = useMemo(() => {
    const width = 280;
    const height = 96;
    const padding = 8;

    if (points.length === 0) {
      return null;
    }

    const values = points.map((point) => point.supplyApy);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;
    const lowerBound = Math.min(minValue - range * 0.1, 0);
    const upperBound = maxValue + range * 0.1;

    const mappedPoints = points.map((point, index) => {
      const x = padding + (points.length === 1 ? 0.5 : index / (points.length - 1)) * (width - padding * 2);
      const normalized = (point.supplyApy - lowerBound) / (upperBound - lowerBound || 1);
      const y = height - padding - normalized * (height - padding * 2);

      return { x, y };
    });

    return {
      width,
      height,
      padding,
      linePath: buildSvgPath(mappedPoints),
      areaPath: buildAreaPath(mappedPoints, width, height, padding),
      lastPoint: mappedPoints[mappedPoints.length - 1],
      firstPoint: mappedPoints[0],
      latestApy: points[points.length - 1].supplyApy,
      latestNetValue: points[points.length - 1].netValue,
      firstApy: points[0].supplyApy,
      firstTimestamp: points[0].timestamp,
      latestTimestamp: points[points.length - 1].timestamp,
      summary: formatTrendSummary(
        points[points.length - 1].supplyApy,
        points[0].supplyApy,
        points[0].timestamp,
        points[points.length - 1].timestamp,
      ),
    };
  }, [points]);

  if (status === "loading") {
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

  if (status === "empty") {
    return (
      <div className={`rounded-xl border border-[#71B48D33] bg-[#072815] p-4 ${className ?? ""}`} role="status" aria-label="No trend history available">
        <p className="text-sm font-medium text-[#D4F3E6]">Supply APY trend</p>
        <p className="mt-2 text-sm text-[#AAABAB]">No trend history available</p>
      </div>
    );
  }

  if (status === "error" || !chart) {
    const message =
      errorKind === "forbidden"
        ? "You do not have access to trend data"
        : errorKind === "network"
          ? "Trend data is temporarily unavailable"
          : "Trend data unavailable";

    return (
      <div className={`rounded-xl border border-[#71B48D33] bg-[#072815] p-4 ${className ?? ""}`} role="alert">
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

  return (
    <div className={`rounded-xl border border-[#71B48D33] bg-[#072815] p-4 ${className ?? ""}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#D4F3E6]">Supply APY trend</p>
          <p className="text-xs text-[#AAABAB]">Responsive history</p>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold text-white">{chart.latestApy.toFixed(2)}%</p>
          <p className="text-xs text-[#AAABAB]">{formatCurrency(chart.latestNetValue)}</p>
        </div>
      </div>

      <div className="sr-only">{chart.summary}</div>

      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        role="img"
        aria-label="Supply APY trend"
        className="h-24 w-full"
        style={reducedMotion ? { transition: "none" } : undefined}
      >
        <path d={chart.areaPath} fill="rgba(113, 180, 141, 0.22)" />
        <path d={chart.linePath} fill="none" stroke="#71B48D" strokeWidth="2.5" strokeLinecap="round" />
        {chart.lastPoint ? (
          <circle cx={chart.lastPoint.x} cy={chart.lastPoint.y} r="3.5" fill="#D4F3E6" />
        ) : null}
      </svg>
    </div>
  );
};

export default SupplyApyChart;
