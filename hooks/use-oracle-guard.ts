"use client";

import { useCallback, useContext, useMemo, useState } from "react";
import { QueryClientContext, useQuery } from "@tanstack/react-query";
import { createQueryClient } from "@/components/query-provider";
import { config } from "@/lib/config";
import {
  classifyPriceAge,
  fetchOracleAssetPrices,
  getMaxOracleAgeSeconds,
  type OracleAssetPrice,
  type PriceBounds,
} from "@/lib/oracle";

export const ORACLE_REFETCH_INTERVAL_MS = 30_000;

export type OracleGuardMode = "supply" | "borrow" | "withdraw" | "repay";

export type OracleGuardStatus =
  | "fresh"
  | "stale"
  | "future"
  | "missing"
  | "out_of_bounds";

export type OracleGuardReasonKey =
  | "stale"
  | "future"
  | "missing"
  | "outOfBounds";

export type AssetOracleGuard = {
  status: OracleGuardStatus;
  reason: OracleGuardReasonKey | null;
};

export type TradeOracleGuard = {
  status: OracleGuardStatus;
  reason: OracleGuardReasonKey | null;
  blocked: boolean;
  warning: boolean;
  affectedAssetId: string | null;
};

export type OracleGuardEvaluation = TradeOracleGuard & {
  byAsset: Record<string, AssetOracleGuard>;
};

const BLOCKING_MODES: ReadonlySet<OracleGuardMode> = new Set([
  "borrow",
  "withdraw",
]);

/**
 * Returns true when a non-null price falls outside configured min/max bounds.
 */
export function isPriceOutOfBounds(
  price: bigint | null,
  bounds: PriceBounds | undefined
): boolean {
  if (price === null || !bounds) return false;
  if (bounds.min !== null && price < bounds.min) return true;
  if (bounds.max !== null && price > bounds.max) return true;
  return false;
}

/**
 * Evaluates oracle health for a single asset record at the given reference time.
 */
export function evaluateAssetOracleGuard(
  entry: OracleAssetPrice | undefined,
  nowSeconds: number,
  maxAgeSeconds = getMaxOracleAgeSeconds()
): AssetOracleGuard {
  if (!entry || entry.price === null || entry.timestamp === null) {
    return { status: "missing", reason: "missing" };
  }

  const { status: ageStatus } = classifyPriceAge(
    entry.timestamp,
    nowSeconds,
    maxAgeSeconds
  );

  if (ageStatus === "stale") {
    return { status: "stale", reason: "stale" };
  }
  if (ageStatus === "future") {
    return { status: "future", reason: "future" };
  }
  if (ageStatus === "missing") {
    return { status: "missing", reason: "missing" };
  }

  if (isPriceOutOfBounds(entry.price, entry.bounds)) {
    return { status: "out_of_bounds", reason: "outOfBounds" };
  }

  return { status: "fresh", reason: null };
}

/**
 * Pure function that evaluates per-asset and aggregate oracle guard state for a trade mode.
 *
 * - Borrow and withdraw are blocked when any relevant asset price is stale, future-dated,
 *   missing, or outside configured PriceBounds.
 * - Supply and repay remain enabled and surface a warning only.
 */
export function evaluateOracleGuard(
  prices: Record<string, OracleAssetPrice>,
  nowSeconds: number,
  mode: OracleGuardMode,
  options?: {
    assetIds?: string[];
    maxAgeSeconds?: number;
  }
): OracleGuardEvaluation {
  const maxAgeSeconds = options?.maxAgeSeconds ?? getMaxOracleAgeSeconds();
  const byAsset: Record<string, AssetOracleGuard> = {};

  for (const [assetId, entry] of Object.entries(prices)) {
    byAsset[assetId] = evaluateAssetOracleGuard(entry, nowSeconds, maxAgeSeconds);
  }

  const targetAssetIds =
    options?.assetIds && options.assetIds.length > 0
      ? options.assetIds
      : Object.keys(prices);

  for (const assetId of targetAssetIds) {
    if (!byAsset[assetId]) {
      byAsset[assetId] = { status: "missing", reason: "missing" };
    }
  }

  let firstUnhealthyId: string | null = null;
  let firstUnhealthy: AssetOracleGuard | null = null;

  for (const assetId of targetAssetIds) {
    const guard = byAsset[assetId];
    if (guard && guard.status !== "fresh") {
      firstUnhealthyId = assetId;
      firstUnhealthy = guard;
      break;
    }
  }

  if (!firstUnhealthy) {
    return {
      byAsset,
      status: "fresh",
      reason: null,
      blocked: false,
      warning: false,
      affectedAssetId: null,
    };
  }

  const isBlockingMode = BLOCKING_MODES.has(mode);

  return {
    byAsset,
    status: firstUnhealthy.status,
    reason: firstUnhealthy.reason,
    blocked: isBlockingMode,
    warning: !isBlockingMode,
    affectedAssetId: firstUnhealthyId,
  };
}

export type UseOracleGuardOptions = {
  contractId?: string;
  rpcUrl?: string;
  additionalAssetIds?: string[];
  maxAgeSeconds?: number;
};

export function useOracleGuard(options?: UseOracleGuardOptions) {
  const existingClient = useContext(QueryClientContext);
  const [fallbackClient] = useState(() =>
    existingClient ? null : createQueryClient()
  );
  const queryClient = existingClient ?? fallbackClient ?? undefined;

  const contractId = options?.contractId ?? config.lendingId;
  const rpcUrl = options?.rpcUrl ?? config.rpc;
  const additionalAssetIds = options?.additionalAssetIds;
  const maxAgeSeconds = options?.maxAgeSeconds;

  const query = useQuery(
    {
      queryKey: [
        "oracle-asset-prices",
        contractId,
        rpcUrl,
        ...(additionalAssetIds ?? []),
      ],
      queryFn: () =>
        fetchOracleAssetPrices({
          contractId,
          rpcUrl,
          additionalAssetIds,
        }),
      refetchInterval: ORACLE_REFETCH_INTERVAL_MS,
    },
    queryClient
  );

  const prices = useMemo(() => query.data?.prices ?? {}, [query.data]);
  const timeSource = query.data?.timeSource ?? "ledger";
  const referenceTimeSeconds =
    query.data?.referenceTimeSeconds ?? Math.floor(Date.now() / 1000);

  const byAsset = useMemo(() => {
    const result: Record<string, AssetOracleGuard> = {};
    for (const [assetId, entry] of Object.entries(prices)) {
      result[assetId] = evaluateAssetOracleGuard(
        entry,
        referenceTimeSeconds,
        maxAgeSeconds
      );
    }
    return result;
  }, [prices, referenceTimeSeconds, maxAgeSeconds]);

  const evaluate = useCallback(
    (mode: OracleGuardMode, assetIds?: string[]): TradeOracleGuard => {
      const { status, reason, blocked, warning, affectedAssetId } =
        evaluateOracleGuard(prices, referenceTimeSeconds, mode, {
          assetIds,
          maxAgeSeconds,
        });
      return { status, reason, blocked, warning, affectedAssetId };
    },
    [prices, referenceTimeSeconds, maxAgeSeconds]
  );

  return {
    prices,
    timeSource,
    referenceTimeSeconds,
    byAsset,
    evaluate,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
