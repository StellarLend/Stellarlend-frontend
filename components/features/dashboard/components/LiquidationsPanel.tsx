"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  LiquidationPosition,
  LiquidationsResponse,
} from "@/lib/positions/liquidation";

interface LiquidationsPanelProps {
  initialPositions?: LiquidationPosition[];
  fetcher?: typeof fetch;
  walletAddress?: string;
}

interface LiquidationRow extends LiquidationPosition {
  distanceToLiquidation: number | null;
  originalIndex: number;
}

type Severity = {
  label: "Past liquidation" | "Critical" | "Warning" | "Buffer" | "Unavailable";
  className: string;
};

export function getDistanceToLiquidationPercent(
  position: Pick<LiquidationPosition, "healthFactor">,
): number | null {
  if (!Number.isFinite(position.healthFactor)) {
    return null;
  }

  return Math.round((position.healthFactor - 1) * 1000) / 10;
}

function formatAmount(amount: number, asset: string): string {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(amount)} ${asset}`;
}

function formatLiquidationPriceFactor(factor: number): string {
  if (!Number.isFinite(factor) || factor <= 0) {
    return "N/A";
  }

  return `${factor.toFixed(2)}x`;
}

function formatDistance(distance: number | null): string {
  if (distance === null) {
    return "Unavailable";
  }

  return `${distance.toFixed(1)}%`;
}

function getSeverity(distance: number | null): Severity {
  if (distance === null) {
    return {
      label: "Unavailable",
      className: "border-slate-600 bg-slate-900 text-slate-200",
    };
  }

  if (distance <= 0) {
    return {
      label: "Past liquidation",
      className: "border-red-500 bg-red-950 text-red-200",
    };
  }

  if (distance <= 10) {
    return {
      label: "Critical",
      className: "border-red-500 bg-red-950 text-red-200",
    };
  }

  if (distance <= 25) {
    return {
      label: "Warning",
      className: "border-amber-500 bg-amber-950 text-amber-100",
    };
  }

  return {
    label: "Buffer",
    className: "border-emerald-600 bg-emerald-950 text-emerald-100",
  };
}

function toSortedRows(positions: LiquidationPosition[]): LiquidationRow[] {
  return positions
    .map((position, originalIndex) => ({
      ...position,
      distanceToLiquidation: getDistanceToLiquidationPercent(position),
      originalIndex,
    }))
    .sort((a, b) => {
      if (a.distanceToLiquidation === null && b.distanceToLiquidation === null) {
        return a.originalIndex - b.originalIndex;
      }

      if (a.distanceToLiquidation === null) {
        return 1;
      }

      if (b.distanceToLiquidation === null) {
        return -1;
      }

      if (a.distanceToLiquidation === b.distanceToLiquidation) {
        return a.originalIndex - b.originalIndex;
      }

      return a.distanceToLiquidation - b.distanceToLiquidation;
    });
}

export default function LiquidationsPanel({
  initialPositions,
  fetcher = fetch,
  walletAddress,
}: LiquidationsPanelProps) {
  const [positions, setPositions] = useState<LiquidationPosition[]>(
    initialPositions ?? [],
  );
  const [isLoading, setIsLoading] = useState(initialPositions === undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialPositions !== undefined) {
      return;
    }

    const controller = new AbortController();
    const query = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : "";

    setIsLoading(true);
    fetcher(`/api/liquidations${query}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to load liquidation risk");
        }

        return response.json() as Promise<LiquidationsResponse>;
      })
      .then((data) => {
        setPositions(data.positions);
        setError(null);
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") {
          return;
        }

        setError("Unable to load liquidation risk");
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [fetcher, initialPositions, walletAddress]);

  const rows = useMemo(() => toSortedRows(positions), [positions]);

  if (isLoading) {
    return (
      <section
        className="rounded-xl border border-[#71B48D33] bg-[#0A3D1E] p-6 text-white"
        aria-label="Liquidation risk"
      >
        <div role="status" aria-label="Loading liquidation risk">
          Loading liquidation risk...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        className="rounded-xl border border-[#71B48D33] bg-[#0A3D1E] p-6 text-white"
        aria-label="Liquidation risk"
      >
        <p role="alert" className="text-sm font-medium text-red-200">
          {error}
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-[#71B48D33] bg-[#0A3D1E] p-6 text-white"
      aria-labelledby="liquidations-panel-title"
    >
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="liquidations-panel-title" className="text-xl font-bold">
            Liquidation Risk
          </h2>
          <p className="text-sm font-medium text-[#D4F3E6]">
            Most at-risk positions are sorted first.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-[#71B48D33] bg-[#072815] p-4 text-sm text-[#D4F3E6]">
          No liquidation risk positions found.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
            <caption className="sr-only">
              Liquidation positions sorted by distance to liquidation
            </caption>
            <thead className="text-xs uppercase tracking-normal text-[#AAABAB]">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Borrowed
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Collateral
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Health
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Liquidation price
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Distance
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((position) => {
                const severity = getSeverity(position.distanceToLiquidation);

                return (
                  <tr
                    key={`${position.asset}-${position.collateralAsset}-${position.originalIndex}`}
                    className="bg-[#072815]"
                  >
                    <td className="rounded-l-lg px-3 py-3 font-semibold">
                      {formatAmount(position.borrowedAmount, position.asset)}
                    </td>
                    <td className="px-3 py-3">
                      {formatAmount(
                        position.collateralAmount,
                        position.collateralAsset,
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono">
                      {Number.isFinite(position.healthFactor)
                        ? `${position.healthFactor.toFixed(2)}x`
                        : "N/A"}
                    </td>
                    <td className="px-3 py-3 font-mono">
                      {formatLiquidationPriceFactor(
                        position.liquidationPriceFactor,
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono">
                      {formatDistance(position.distanceToLiquidation)}
                    </td>
                    <td className="rounded-r-lg px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${severity.className}`}
                      >
                        {severity.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
