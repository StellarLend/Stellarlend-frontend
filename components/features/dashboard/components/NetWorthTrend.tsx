"use client";

import React, { useMemo, useState } from "react";
import { formatCurrency, formatPercentage } from "@/lib/utils/format";
import { usePositionHistory, TimeWindow } from "@/hooks/usePositionHistory";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

export interface NetWorthTrendProps {
  window?: TimeWindow;
  onWindowChange?: (window: TimeWindow) => void;
}

interface CalculatedTrend {
  currentValue: number;
  delta: number;
  percentChange: number;
  trendDirection: "up" | "down" | "flat";
}

export function NetWorthTrend({ window: initialWindow = "7d", onWindowChange }: NetWorthTrendProps) {
  const [window, setWindow] = useState<TimeWindow>(initialWindow);

  const { data, isLoading, error } = usePositionHistory(window);

  const trend: CalculatedTrend | null = useMemo(() => {
    if (!data || data.snapshots.length === 0) return null;

    const sortedSnapshots = [...data.snapshots].sort((a, b) => a.timestamp - b.timestamp);
    const firstSnapshot = sortedSnapshots[0];
    const latestSnapshot = sortedSnapshots[sortedSnapshots.length - 1];

    const currentValue = latestSnapshot.netWorth;
    const delta = latestSnapshot.netWorth - firstSnapshot.netWorth;
    const percentChange =
      firstSnapshot.netWorth !== 0
        ? ((latestSnapshot.netWorth - firstSnapshot.netWorth) / firstSnapshot.netWorth) * 100
        : 0;

    const trendDirection = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

    return {
      currentValue,
      delta,
      percentChange,
      trendDirection,
    };
  }, [data]);

  const handleWindowChange = (newWindow: TimeWindow) => {
    setWindow(newWindow);
    if (onWindowChange) {
      onWindowChange(newWindow);
    }
  };

  if (isLoading) {
    return (
      <section
        className="rounded-xl border border-[#71B48D33] bg-[#0A3D1E] p-6 text-white mb-6"
        aria-label="Net worth trend"
        role="status"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 bg-[#072815] rounded w-32" />
          <div className="flex gap-2">
            {(["24h", "7d", "30d"] as TimeWindow[]).map((w) => (
              <div key={w} className="h-8 w-12 bg-[#072815] rounded" />
            ))}
          </div>
        </div>
        <div className="h-10 bg-[#072815] rounded w-48 mb-2" />
        <div className="h-5 bg-[#072815] rounded w-24" />
      </section>
    );
  }

  if (error) {
    return (
      <section
        className="rounded-xl border border-[#71B48D33] bg-[#0A3D1E] p-6 text-white mb-6"
        aria-label="Net worth trend"
        role="alert"
      >
        <p className="text-sm font-medium text-red-200">
          Failed to load net worth trend. Please try again later.
        </p>
      </section>
    );
  }

  if (!data || data.snapshots.length === 0) {
    return (
      <section
        className="rounded-xl border border-[#71B48D33] bg-[#0A3D1E] p-6 text-white mb-6"
        aria-label="Net worth trend"
      >
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-bold">Net Worth Trend</h2>
        </div>
        <p className="text-sm text-[#D4F3E6]">
          No historical portfolio data available yet. Your trend will appear once snapshots have been recorded.
        </p>
      </section>
    );
  }

  if (data.snapshots.length === 1) {
    const value = data.snapshots[0].netWorth;
    return (
      <section
        className="rounded-xl border border-[#71B48D33] bg-[#0A3D1E] p-6 text-white mb-6"
        aria-labelledby="networth-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="networth-title" className="text-lg font-bold">
            Net Worth Trend
          </h2>
          <div className="flex gap-1" role="group" aria-label="Time window selector">
            {(["24h", "7d", "30d"] as TimeWindow[]).map((w) => (
              <button
                key={w}
                onClick={() => handleWindowChange(w)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  window === w
                    ? "bg-[#097C4C] text-white"
                    : "bg-[#072815] text-[#AAABAB] hover:bg-[#097C4C]/20"
                }`}
                aria-pressed={window === w}
                aria-label={`Select ${w} time window`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold font-mono">
            ${formatCurrency(value)}
          </span>
          <span className="text-sm text-[#AAABAB]">
            Single snapshot — trend will appear after more data
          </span>
        </div>
      </section>
    );
  }

  const TrendIcon = trend
    ? trend.trendDirection === "up"
      ? TrendingUp
      : trend.trendDirection === "down"
      ? TrendingDown
      : ArrowRight
    : ArrowRight;

  const trendColorClass = trend
    ? trend.trendDirection === "up"
      ? "text-[#097C4C]"
      : trend.trendDirection === "down"
      ? "text-red-400"
      : "text-[#AAABAB]"
    : "text-[#AAABAB]";

  return (
    <section
      className="rounded-xl border border-[#71B48D33] bg-[#0A3D1E] p-6 text-white mb-6"
      aria-labelledby="networth-title"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 id="networth-title" className="text-lg font-bold">
          Net Worth Trend
        </h2>
        <div className="flex gap-1" role="group" aria-label="Time window selector">
          {(["24h", "7d", "30d"] as TimeWindow[]).map((w) => (
            <button
              key={w}
              onClick={() => handleWindowChange(w)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                window === w
                  ? "bg-[#097C4C] text-white"
                  : "bg-[#072815] text-[#AAABAB] hover:bg-[#097C4C]/20"
              }`}
              aria-pressed={window === w}
              aria-label={`Select ${w} time window`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-3xl font-bold font-mono" aria-label="Current net worth">
          ${formatCurrency(trend!.currentValue)}
        </span>
        <span
          className={`flex items-center gap-1 text-sm font-medium ${trendColorClass}`}
          aria-label={`Change: ${trend!.delta >= 0 ? "+" : ""}${formatCurrency(trend!.delta)} (${formatPercentage(trend!.percentChange)})`}
        >
          <TrendIcon className="w-4 h-4" aria-hidden="true" />
          {trend!.delta >= 0 ? "+" : "-"}{" "}
          {formatCurrency(Math.abs(trend!.delta))}
          {" · "}
          {formatPercentage(trend!.percentChange)}
        </span>
      </div>
    </section>
  );
}

export default NetWorthTrend;