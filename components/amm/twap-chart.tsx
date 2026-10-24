"use client";

import React, { useMemo } from "react";
import type { TwapPoint } from "@/lib/amm/twap";

interface TwapChartProps {
  points: TwapPoint[];
  windowSecs?: number;
  onWindowChange: (secs?: number) => void;
}

export function TwapChart({ points, windowSecs, onWindowChange }: TwapChartProps) {
  const chartData = useMemo(() => {
    if (points.length < 2) return null;

    const numericPoints = points.map((p) => ({
      x: p.timestamp,
      y: parseFloat(p.price) || 0,
      priceStr: p.price,
    }));

    const minX = Math.min(...numericPoints.map((p) => p.x));
    const maxX = Math.max(...numericPoints.map((p) => p.x));
    let minY = Math.min(...numericPoints.map((p) => p.y));
    let maxY = Math.max(...numericPoints.map((p) => p.y));

    if (minY === maxY) {
      minY = minY * 0.95;
      maxY = maxY * 1.05 || 1;
    }

    const paddingX = 40;
    const paddingY = 30;
    const width = 600;
    const height = 220;

    const scaleX = (val: number) =>
      maxX === minX ? paddingX : paddingX + ((val - minX) / (maxX - minX)) * (width - paddingX * 2);

    const scaleY = (val: number) =>
      maxY === minY ? height / 2 : height - paddingY - ((val - minY) / (maxY - minY)) * (height - paddingY * 2);

    const pathD = numericPoints
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${scaleX(p.x).toFixed(1)} ${scaleY(p.y).toFixed(1)}`)
      .join(" ");

    return {
      points: numericPoints,
      pathD,
      minY,
      maxY,
      minX,
      maxX,
      width,
      height,
      firstY: numericPoints[0].y,
      lastY: numericPoints[numericPoints.length - 1].y,
      latestPrice: numericPoints[numericPoints.length - 1].priceStr,
    };
  }, [points]);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
        <div>
          <h2 className="text-lg font-bold">TWAP Price History</h2>
          <p className="mut text-xs">Time-weighted average price reconstructed from on-chain buffer</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          {[
            { label: "1h", value: 3600 },
            { label: "24h", value: 86400 },
            { label: "All", value: undefined },
          ].map((option) => (
            <button
              key={option.label}
              className={`rounded-md px-3 py-1.5 transition ${
                windowSecs === option.value
                  ? "bg-white/10 text-[var(--acc)] font-bold"
                  : "mut hover:bg-white/5 hover:text-white"
              }`}
              onClick={() => onWindowChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {!chartData ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-xl bg-white/[0.02] text-sm text-[var(--muted)]">
            <svg
              className="mb-2 h-8 w-8 opacity-40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span>Insufficient TWAP observations to plot chart (needs at least 2 points).</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{chartData.latestPrice}</span>
              <span className="mut text-xs">Latest TWAP</span>
            </div>
            <div className="w-full overflow-hidden">
              <svg
                viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                className="w-full h-48 overflow-visible"
              >
                {/* Horizontal reference lines */}
                <line
                  x1="40"
                  y1="30"
                  x2={chartData.width - 40}
                  y2="30"
                  stroke="var(--line)"
                  strokeDasharray="4"
                  strokeWidth="0.8"
                />
                <line
                  x1="40"
                  y1={chartData.height - 30}
                  x2={chartData.width - 40}
                  y2={chartData.height - 30}
                  stroke="var(--line)"
                  strokeDasharray="4"
                  strokeWidth="0.8"
                />

                {/* Min / Max Labels */}
                <text x="35" y="34" textAnchor="end" className="text-[10px] fill-zinc-400">
                  {chartData.maxY.toFixed(4)}
                </text>
                <text x="35" y={chartData.height - 26} textAnchor="end" className="text-[10px] fill-zinc-400">
                  {chartData.minY.toFixed(4)}
                </text>

                {/* Price line path */}
                <path
                  d={chartData.pathD}
                  fill="none"
                  stroke="var(--acc)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
