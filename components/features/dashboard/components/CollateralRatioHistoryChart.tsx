"use client";

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { SnapshotHistoryResponse } from "@/lib/positions/snapshot";

interface CollateralRatioPoint {
  timestamp: number;
  ratio: number;
}

interface CollateralRatioHistoryChartProps {
  className?: string;
  liquidationThreshold?: number;
}

const CHART_WIDTH = 280;
const CHART_HEIGHT = 108;
const CHART_PADDING = 10;
const DEFAULT_LIQUIDATION_THRESHOLD = 1;

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
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

function buildPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  }

  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ");
}

function toCollateralRatioPoints(
  snapshots: SnapshotHistoryResponse["snapshots"],
): CollateralRatioPoint[] {
  return snapshots
    .map((snapshot) => {
      if (
        !isFinitePositive(snapshot.supplied) ||
        !isFinitePositive(snapshot.borrowed)
      ) {
        return null;
      }

      return {
        timestamp: snapshot.timestamp,
        ratio: snapshot.supplied / snapshot.borrowed,
      };
    })
    .filter((point): point is CollateralRatioPoint => point !== null);
}

export function CollateralRatioHistoryChart({
  className,
  liquidationThreshold = DEFAULT_LIQUIDATION_THRESHOLD,
}: CollateralRatioHistoryChartProps) {
  const shouldReduceMotion = useReducedMotion();
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">(
    "loading",
  );
  const [points, setPoints] = useState<CollateralRatioPoint[]>([]);

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
          throw new Error("Position history request failed");
        }

        const payload = (await response.json()) as SnapshotHistoryResponse;
        const snapshots = Array.isArray(payload?.snapshots)
          ? payload.snapshots
          : [];
        const ratioPoints = toCollateralRatioPoints(snapshots);

        if (ratioPoints.length === 0) {
          setPoints([]);
          setStatus("empty");
          return;
        }

        setPoints(ratioPoints);
        setStatus("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setPoints([]);
        setStatus("error");
      }
    }

    loadHistory();

    return () => controller.abort();
  }, []);

  const chart = useMemo(() => {
    if (points.length === 0) {
      return null;
    }

    const ratioValues = points.map((point) => point.ratio);
    const minValue = Math.min(...ratioValues, liquidationThreshold);
    const maxValue = Math.max(...ratioValues, liquidationThreshold);
    const range = maxValue - minValue || 1;
    const lowerBound = Math.max(0, minValue - range * 0.18);
    const upperBound = maxValue + range * 0.18;
    const yForRatio = (ratio: number) => {
      const normalized = (ratio - lowerBound) / (upperBound - lowerBound || 1);
      return (
        CHART_HEIGHT -
        CHART_PADDING -
        normalized * (CHART_HEIGHT - CHART_PADDING * 2)
      );
    };

    const mappedPoints = points.map((point, index) => ({
      x:
        CHART_PADDING +
        (points.length === 1 ? 0.5 : index / (points.length - 1)) *
          (CHART_WIDTH - CHART_PADDING * 2),
      y: yForRatio(point.ratio),
    }));
    const latestPoint = points[points.length - 1];

    return {
      linePath: buildPath(mappedPoints),
      thresholdY: yForRatio(liquidationThreshold),
      latestPoint,
      latestSvgPoint: mappedPoints[mappedPoints.length - 1],
      firstLabel: formatDate(points[0].timestamp),
      lastLabel: formatDate(latestPoint.timestamp),
      isBelowThreshold: latestPoint.ratio <= liquidationThreshold,
    };
  }, [liquidationThreshold, points]);

  if (status === "loading") {
    return (
      <div
        className={`rounded-xl border border-[#71B48D33] bg-[#072815] p-4 ${className ?? ""}`}
        role="status"
        aria-label="Loading collateral ratio history"
      >
        <div className="mb-2 h-3 w-36 rounded bg-[#71B48D33]" />
        <div className="h-24 rounded-lg bg-[#0A3D1E] motion-reduce:animate-none" />
      </div>
    );
  }

  if (status === "empty") {
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
      </div>
    );
  }

  if (status === "error" || !chart) {
    return (
      <div
        className={`rounded-xl border border-[#71B48D33] bg-[#072815] p-4 ${className ?? ""}`}
        role="alert"
      >
        <p className="text-sm font-medium text-[#D4F3E6]">
          Collateral ratio history
        </p>
        <p className="mt-2 text-sm text-[#AAABAB]">
          Collateral ratio history unavailable
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-[#71B48D33] bg-[#072815] p-4 ${className ?? ""}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#D4F3E6]">
            Collateral ratio history
          </p>
          <p className="text-xs text-[#AAABAB]">
            Threshold reference: {formatRatio(liquidationThreshold)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold text-white">
            {formatRatio(chart.latestPoint.ratio)}
          </p>
          <p
            className={
              chart.isBelowThreshold
                ? "text-xs text-red-300"
                : "text-xs text-[#AAABAB]"
            }
          >
            {chart.isBelowThreshold
              ? "At liquidation threshold"
              : "Latest ratio"}
          </p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={`Collateral ratio history chart. Latest ratio ${formatRatio(
          chart.latestPoint.ratio,
        )}; liquidation threshold ${formatRatio(liquidationThreshold)}.`}
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
