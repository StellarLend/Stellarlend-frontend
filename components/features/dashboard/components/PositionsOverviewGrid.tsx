"use client";

import React, { useMemo, useState } from "react";
import {
  usePositions,
  type BorrowPosition,
} from "@/hooks/usePositions";
import HealthFactorBadge from "@/components/shared/ui/HealthFactorBadge";
import { EmptyState } from "@/components/shared/common/EmptyState";

export type PositionsSortKey = "health" | "size";
export type PositionsSortDir = "asc" | "desc";

export interface PositionsOverviewGridProps {
  /** Optional override for tests — defaults to live usePositions(). */
  positions?: BorrowPosition[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

function sizeOf(position: BorrowPosition): number {
  if (typeof position.amount === "number" && Number.isFinite(position.amount)) {
    return position.amount;
  }
  return 0;
}

function healthOf(position: BorrowPosition): number {
  if (
    typeof position.healthFactor === "number" &&
    Number.isFinite(position.healthFactor)
  ) {
    return position.healthFactor;
  }
  // Missing health sorts as worst risk so it is never hidden at the bottom
  // when riskiest-first (asc by health).
  return Number.POSITIVE_INFINITY;
}

export function sortPositions(
  positions: BorrowPosition[],
  key: PositionsSortKey,
  dir: PositionsSortDir,
): BorrowPosition[] {
  const copy = [...positions];
  copy.sort((a, b) => {
    let cmp = 0;
    if (key === "health") {
      cmp = healthOf(a) - healthOf(b);
      // Riskiest first when ascending (lower HF = higher risk).
    } else {
      cmp = sizeOf(a) - sizeOf(b);
    }
    if (cmp === 0) {
      // Stable secondary key so ties are deterministic.
      cmp = a.asset.localeCompare(b.asset) || a.id.localeCompare(b.id);
    }
    return dir === "asc" ? cmp : -cmp;
  });
  return copy;
}

function ariaSortValue(
  column: PositionsSortKey,
  active: PositionsSortKey,
  dir: PositionsSortDir,
): "ascending" | "descending" | "none" {
  if (column !== active) return "none";
  return dir === "asc" ? "ascending" : "descending";
}

/**
 * Dashboard positions overview: all borrow positions from usePositions,
 * sortable by health factor (risk) or size.
 */
export default function PositionsOverviewGrid({
  positions: positionsProp,
  isLoading: loadingProp,
  error: errorProp,
  onRetry,
}: PositionsOverviewGridProps = {}) {
  const live = usePositions();
  const positions = positionsProp ?? live.positions;
  const isLoading = loadingProp ?? live.isLoading;
  const error = errorProp === undefined ? live.error : errorProp;
  const retry = onRetry ?? live.refetch;

  // Default: riskiest first (lowest health ascending).
  const [sortKey, setSortKey] = useState<PositionsSortKey>("health");
  const [sortDir, setSortDir] = useState<PositionsSortDir>("asc");

  const sorted = useMemo(
    () => sortPositions(positions, sortKey, sortDir),
    [positions, sortKey, sortDir],
  );

  const toggleSort = (key: PositionsSortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    // New column defaults: health → riskiest first; size → largest first.
    setSortDir(key === "health" ? "asc" : "desc");
  };

  if (isLoading) {
    return (
      <section
        aria-labelledby="positions-overview-heading"
        aria-busy="true"
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        data-testid="positions-overview-grid"
      >
        <h2
          id="positions-overview-heading"
          className="text-lg font-semibold text-gray-900 mb-4"
        >
          Positions overview
        </h2>
        <p role="status" className="text-sm text-gray-500">
          Loading positions…
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section
        aria-labelledby="positions-overview-heading"
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        data-testid="positions-overview-grid"
      >
        <h2
          id="positions-overview-heading"
          className="text-lg font-semibold text-gray-900 mb-4"
        >
          Positions overview
        </h2>
        <EmptyState
          tone="error"
          title="Couldn’t load positions"
          description={error.message || "Something went wrong fetching positions."}
          actionLabel="Try again"
          onAction={() => {
            void retry();
          }}
        />
      </section>
    );
  }

  if (sorted.length === 0) {
    return (
      <section
        aria-labelledby="positions-overview-heading"
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        data-testid="positions-overview-grid"
      >
        <h2
          id="positions-overview-heading"
          className="text-lg font-semibold text-gray-900 mb-4"
        >
          Positions overview
        </h2>
        <EmptyState
          title="No open positions"
          description="Borrow or lend to see positions here, sorted by risk and size."
        />
      </section>
    );
  }

  return (
    <section
      aria-labelledby="positions-overview-heading"
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      data-testid="positions-overview-grid"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2
          id="positions-overview-heading"
          className="text-lg font-semibold text-gray-900"
        >
          Positions overview
        </h2>
        <p className="text-sm text-gray-500" aria-live="polite">
          {sorted.length} position{sorted.length === 1 ? "" : "s"} · sorted by{" "}
          {sortKey === "health" ? "health" : "size"} (
          {sortDir === "asc" ? "ascending" : "descending"})
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Borrow positions">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-600">
              <th scope="col" className="py-2 pr-4 font-medium">
                Asset
              </th>
              <th
                scope="col"
                className="py-2 pr-4 font-medium"
                aria-sort={ariaSortValue("size", sortKey, sortDir)}
              >
                <button
                  type="button"
                  onClick={() => toggleSort("size")}
                  className="inline-flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350]"
                >
                  Size
                  <span aria-hidden="true" className="text-xs text-gray-400">
                    {sortKey === "size" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                  </span>
                </button>
              </th>
              <th
                scope="col"
                className="py-2 font-medium"
                aria-sort={ariaSortValue("health", sortKey, sortDir)}
              >
                <button
                  type="button"
                  onClick={() => toggleSort("health")}
                  className="inline-flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350]"
                >
                  Health
                  <span aria-hidden="true" className="text-xs text-gray-400">
                    {sortKey === "health"
                      ? sortDir === "asc"
                        ? "↑"
                        : "↓"
                      : "↕"}
                  </span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((position) => (
              <tr
                key={position.id}
                className="border-b border-gray-100 last:border-0"
                data-testid={`position-row-${position.id}`}
              >
                <td className="py-3 pr-4 font-medium text-gray-900">
                  {position.asset}
                </td>
                <td className="py-3 pr-4 text-gray-700 tabular-nums">
                  {sizeOf(position).toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
                </td>
                <td className="py-3">
                  {typeof position.healthFactor === "number" &&
                  Number.isFinite(position.healthFactor) ? (
                    <HealthFactorBadge healthFactor={position.healthFactor} />
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
