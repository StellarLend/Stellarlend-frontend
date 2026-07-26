"use client";

import { useEffect, useMemo, useState } from "react";
import type { SnapshotHistoryResponse } from "@/lib/positions/snapshot";

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

  const linePath = buildPath(points);
  if (!linePath) {
    return "";
  }

  const baselineY = height - padding;
  if (points.length === 1) {
    return `${linePath} L ${points[0].x.toFixed(2)} ${baselineY} Z`;
  }

  return `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${baselineY} L ${points[0].x.toFixed(2)} ${baselineY} Z`;
}

export const SupplyApyChart: React.FC<SupplyApyChartProps> = ({ className }) => {
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [points, setPoints] = useState<SupplyApyChartPoint[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);

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
      try {
        const response = await fetch("/api/positions/history?interval=1d", {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Request failed");
        }

        const payload = (await response.json()) as SnapshotHistoryResponse;
        const snapshots = Array.isArray(payload?.snapshots) ? payload.snapshots : [];

        if (snapshots.length === 0) {
          setPoints([]);
          setStatus("empty");
          return;
        }

        const chartPoints = snapshots.map((snapshot) => ({
          timestamp: snapshot.timestamp,
          supplyApy: snapshot.effectiveSupplyApy,
          netValue: snapshot.supplied - snapshot.borrowed,
        }));

        setPoints(chartPoints);
        setStatus("ready");
      } catch {
        setPoints([]);
        setStatus("error");
      }
    }

    loadHistory();

    return () => controller.abort();
  }, []);

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
      linePath: buildPath(mappedPoints),
      areaPath: buildAreaPath(mappedPoints, width, height, padding),
      lastPoint: mappedPoints[mappedPoints.length - 1],
      firstPoint: mappedPoints[0],
      latestApy: points[points.length - 1].supplyApy,
      latestNetValue: points[points.length - 1].netValue,
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
      <div className={`rounded-xl border border-[#71B48D33] bg-[#072815] p-4 ${className ?? ""}`}>
        <p className="text-sm font-medium text-[#D4F3E6]">Supply APY trend</p>
        <p className="mt-2 text-sm text-[#AAABAB]">No trend history available</p>
      </div>
    );
  }

  if (status === "error" || !chart) {
    return (
      <div className={`rounded-xl border border-[#71B48D33] bg-[#072815] p-4 ${className ?? ""}`} role="alert">
        <p className="text-sm font-medium text-[#D4F3E6]">Supply APY trend</p>
        <p className="mt-2 text-sm text-[#AAABAB]">Trend data unavailable</p>
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
