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

interface LiquidationNotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  loanAlerts: boolean;
  marketingEmails: boolean;
  liquidationAlerts: string[];
}

interface PreferencesPayload {
  userId: string;
  locale: string;
  displayCurrency: string;
  notifications: LiquidationNotificationSettings;
}

const DEFAULT_NOTIFICATION_SETTINGS: LiquidationNotificationSettings = {
  emailNotifications: true,
  pushNotifications: true,
  loanAlerts: true,
  marketingEmails: false,
  liquidationAlerts: [],
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

function getLiquidationAlertKey(
  position: Pick<LiquidationPosition, "asset" | "collateralAsset">,
): string {
  return `liquidation:${position.asset}:${position.collateralAsset}`;
}

function normalizeAlertKeys(alertKeys: unknown): string[] {
  if (!Array.isArray(alertKeys)) {
    return [];
  }

  return Array.from(
    new Set(
      alertKeys.filter(
        (alertKey): alertKey is string => typeof alertKey === "string",
      ),
    ),
  ).sort();
}

function normalizePreferences(
  raw: unknown,
  userId: string,
): PreferencesPayload {
  const data =
    raw && typeof raw === "object" ? (raw as Partial<PreferencesPayload>) : {};
  const notifications =
    data.notifications && typeof data.notifications === "object"
      ? data.notifications
      : DEFAULT_NOTIFICATION_SETTINGS;

  return {
    userId: data.userId ?? userId,
    locale: data.locale ?? "en-US",
    displayCurrency: data.displayCurrency ?? "USD",
    notifications: {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...notifications,
      liquidationAlerts: normalizeAlertKeys(notifications.liquidationAlerts),
    },
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
  const [preferences, setPreferences] = useState<PreferencesPayload | null>(
    null,
  );
  const [alertSubscriptions, setAlertSubscriptions] = useState<Set<string>>(
    () => new Set(),
  );
  const [isPreferencesLoading, setIsPreferencesLoading] = useState(
    Boolean(walletAddress),
  );
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [pendingAlertKeys, setPendingAlertKeys] = useState<Set<string>>(
    () => new Set(),
  );

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

  useEffect(() => {
    if (!walletAddress) {
      setPreferences(null);
      setAlertSubscriptions(new Set());
      setIsPreferencesLoading(false);
      setPreferencesError(null);
      setPendingAlertKeys(new Set());
      return;
    }

    const controller = new AbortController();

    setIsPreferencesLoading(true);
    setPreferencesError(null);

    fetcher(
      `/api/account/preferences?userId=${encodeURIComponent(walletAddress)}`,
      {
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (response.status === 404) {
          return normalizePreferences(null, walletAddress);
        }

        if (!response.ok) {
          throw new Error("Unable to load alert subscriptions");
        }

        return normalizePreferences(await response.json(), walletAddress);
      })
      .then((nextPreferences) => {
        setPreferences(nextPreferences);
        setAlertSubscriptions(
          new Set(nextPreferences.notifications.liquidationAlerts),
        );
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") {
          return;
        }

        setPreferencesError("Unable to load liquidation alert preferences.");
      })
      .finally(() => {
        setIsPreferencesLoading(false);
      });

    return () => controller.abort();
  }, [fetcher, walletAddress]);

  const rows = useMemo(() => toSortedRows(positions), [positions]);

  async function handleAlertToggle(position: LiquidationRow) {
    if (!walletAddress) {
      return;
    }

    const alertKey = getLiquidationAlertKey(position);
    const previousSubscriptions = alertSubscriptions;
    const nextSubscriptions = new Set(previousSubscriptions);

    if (nextSubscriptions.has(alertKey)) {
      nextSubscriptions.delete(alertKey);
    } else {
      nextSubscriptions.add(alertKey);
    }

    const basePreferences =
      preferences ?? normalizePreferences(null, walletAddress);
    const payload: PreferencesPayload = {
      ...basePreferences,
      userId: walletAddress,
      notifications: {
        ...basePreferences.notifications,
        liquidationAlerts: Array.from(nextSubscriptions).sort(),
      },
    };

    setAlertSubscriptions(nextSubscriptions);
    setPendingAlertKeys((current) => new Set(current).add(alertKey));

    try {
      const response = await fetcher("/api/account/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Unable to save alert subscription");
      }

      let saved: unknown = payload;

      try {
        saved = await response.json();
      } catch {
        saved = payload;
      }

      const nextPreferences = normalizePreferences(saved, walletAddress);
      setPreferences(nextPreferences);
      setAlertSubscriptions(
        new Set(nextPreferences.notifications.liquidationAlerts),
      );
      setPreferencesError(null);
    } catch {
      setAlertSubscriptions(new Set(previousSubscriptions));
      setPreferencesError("Unable to save liquidation alert preference.");
    } finally {
      setPendingAlertKeys((current) => {
        const next = new Set(current);
        next.delete(alertKey);
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

      {isPreferencesLoading ? (
        <p role="status" className="mb-3 text-xs font-medium text-[#D4F3E6]">
          Loading alert subscriptions...
        </p>
      ) : null}

      {preferencesError ? (
        <p role="alert" className="mb-3 text-xs font-medium text-red-200">
          {preferencesError}
        </p>
      ) : null}

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
                const alertKey = getLiquidationAlertKey(position);
                const isSubscribed = alertSubscriptions.has(alertKey);
                const isPending = pendingAlertKeys.has(alertKey);
                const isAlertToggleDisabled =
                  !walletAddress ||
                  isPreferencesLoading ||
                  Boolean(walletAddress && !preferences) ||
                  pendingAlertKeys.size > 0 ||
                  isPending;
                const alertLabel = walletAddress
                  ? `${isSubscribed ? "Disable" : "Enable"} liquidation alerts for ${position.asset} borrowed against ${position.collateralAsset}`
                  : `Connect a wallet to manage liquidation alerts for ${position.asset} borrowed against ${position.collateralAsset}`;

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
                        aria-label={alertLabel}
                        title={alertLabel}
                        disabled={isAlertToggleDisabled}
                        onClick={() => void handleAlertToggle(position)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full border border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[#71B48D] focus:ring-offset-2 focus:ring-offset-[#072815] disabled:cursor-not-allowed disabled:opacity-50 ${
                          isSubscribed ? "bg-[#71B48D]" : "bg-[#1F5A36]"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            isSubscribed ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
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
