"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  LiquidationPosition,
  LiquidationsResponse,
} from "@/lib/positions/liquidation";

const LIQUIDATION_ALERT_EVENT = "liquidation_warning";

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

interface NotificationPreferencesResponse {
  subscriptions?: string[];
}

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
      if (
        a.distanceToLiquidation === null &&
        b.distanceToLiquidation === null
      ) {
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

function getLiquidationAlertId(position: LiquidationRow): string {
  return [
    position.asset,
    position.collateralAsset,
    position.borrowedAmount,
    position.collateralAmount,
    position.originalIndex,
  ].join(":");
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
  const [alertSubscriptions, setAlertSubscriptions] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingAlertIds, setPendingAlertIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [alertError, setAlertError] = useState<string | null>(null);

  useEffect(() => {
    if (initialPositions !== undefined) {
      return;
    }

    const controller = new AbortController();
    const query = walletAddress
      ? `?wallet=${encodeURIComponent(walletAddress)}`
      : "";

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
  const rowAlertIds = useMemo(
    () => rows.map((position) => getLiquidationAlertId(position)),
    [rows],
  );

  useEffect(() => {
    if (rowAlertIds.length === 0) {
      setAlertSubscriptions(new Set());
      return;
    }

    const controller = new AbortController();

    fetcher(
      `/api/account/notification-preferences?eventType=${LIQUIDATION_ALERT_EVENT}`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      },
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to load alert preferences");
        }

        return response.json() as Promise<NotificationPreferencesResponse>;
      })
      .then((data) => {
        const knownAlertIds = new Set(rowAlertIds);
        const subscriptions = Array.isArray(data.subscriptions)
          ? data.subscriptions.filter((id) => knownAlertIds.has(id))
          : [];

        setAlertSubscriptions(new Set(subscriptions));
        setAlertError(null);
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") {
          return;
        }

        setAlertError("Unable to load alert preferences");
      });

    return () => controller.abort();
  }, [fetcher, rowAlertIds]);

  async function toggleLiquidationAlert(alertId: string, enabled: boolean) {
    setAlertError(null);
    setPendingAlertIds((current) => new Set(current).add(alertId));
    setAlertSubscriptions((current) => {
      const next = new Set(current);
      if (enabled) {
        next.add(alertId);
      } else {
        next.delete(alertId);
      }
      return next;
    });

    try {
      const response = await fetcher("/api/account/notification-preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          eventType: LIQUIDATION_ALERT_EVENT,
          positionId: alertId,
          enabled,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to save alert preference");
      }
    } catch {
      setAlertSubscriptions((current) => {
        const next = new Set(current);
        if (enabled) {
          next.delete(alertId);
        } else {
          next.add(alertId);
        }
        return next;
      });
      setAlertError("Unable to save alert preference");
    } finally {
      setPendingAlertIds((current) => {
        const next = new Set(current);
        next.delete(alertId);
        return next;
      });
    }
  }

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
                <th scope="col" className="px-3 py-2 font-semibold">
                  Alerts
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((position) => {
                const severity = getSeverity(position.distanceToLiquidation);
                const alertId = getLiquidationAlertId(position);
                const isSubscribed = alertSubscriptions.has(alertId);
                const isPending = pendingAlertIds.has(alertId);

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
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${severity.className}`}
                      >
                        {severity.label}
                      </span>
                    </td>
                    <td className="rounded-r-lg px-3 py-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isSubscribed}
                        aria-label={`${isSubscribed ? "Disable" : "Enable"} liquidation alerts for ${position.asset} borrowed against ${position.collateralAsset}`}
                        disabled={isPending}
                        onClick={() =>
                          toggleLiquidationAlert(alertId, !isSubscribed)
                        }
                        className={`inline-flex min-w-20 items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${
                          isSubscribed
                            ? "border-emerald-500 bg-emerald-950 text-emerald-100"
                            : "border-[#71B48D66] bg-[#0A3D1E] text-[#D4F3E6]"
                        }`}
                      >
                        {isSubscribed ? "On" : "Off"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {alertError ? (
            <p role="alert" className="mt-3 text-sm font-medium text-red-200">
              {alertError}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
