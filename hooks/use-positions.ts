"use client";
/**
 * usePositions
 *
 * Manages the user's lending position and the demo-ledger fallback.
 *
 * On-chain mode (address set + isOnChainConfigured()):
 *   React Query polls readPosition(address) every 30 s and on window refocus.
 *   The returned `position` is a LendingPosition; `ledger` is kept in sync for
 *   the risk helpers that need a MarketPositionMap.
 *
 * Demo mode (no address, or contract not configured):
 *   `position` is null; `ledger` is loaded from localStorage (per-wallet key)
 *   and kept in sync across browser tabs via the storage event.
 *
 * The query key lives in lib/query-keys.ts (queryKeys.lendingPosition).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  isOnChainConfigured,
  readPosition,
  type LendingPosition,
} from "@/lib/lending-client";
import {
  loadLedger,
  saveLedger,
  storageKey,
  type Ledger,
} from "@/lib/demo-ledger";
import { queryKeys } from "@/lib/query-keys";
import { type Market, type MarketPositionMap } from "@/lib/markets";

export const POSITION_REFETCH_INTERVAL_MS = 30_000;

export type UsePositionsResult = {
  /** On-chain position (null in demo mode or while loading). */
  position: LendingPosition | null;
  /** True while the first on-chain fetch is in flight. */
  isLoadingPosition: boolean;
  /** Non-empty when the last on-chain read failed. */
  positionError: string;
  /** Demo-ledger keyed by asset symbol (BigInt base units). */
  ledger: Ledger;
  /** Update demo-ledger and persist to localStorage. */
  saveLedgerEntry: (next: Ledger) => void;
  /** True when the demo-ledger was reset due to corrupted storage. */
  resetNotice: boolean;
  dismissResetNotice: () => void;
  /**
   * Combined position map (on-chain overrides demo for `live` markets).
   * Suitable as the `positions` argument to filterAndSortMarkets.
   */
  marketPositions: MarketPositionMap;
  /** Imperatively re-fetch the on-chain position (called after a confirmed tx). */
  refreshPosition: () => void;
};

export function usePositions(
  address: string | null | undefined,
  activeMarkets: Market[],
  positionErrorText = "Could not load your on-chain position.",
): UsePositionsResult {
  const configured = isOnChainConfigured();
  const onChainMode = Boolean(address && configured);
  const queryClient = useQueryClient();

  // ── On-chain position via React Query ───────────────────────────────────

  const positionQuery = useQuery<LendingPosition | null>({
    queryKey: queryKeys.lendingPosition(address),
    queryFn: () => (address ? readPosition(address) : null),
    enabled: Boolean(address) && configured,
    staleTime: POSITION_REFETCH_INTERVAL_MS,
    refetchInterval: POSITION_REFETCH_INTERVAL_MS,
    // Surface errors as null so the UI shows positionError instead of crashing.
    retry: false,
  });

  const positionError =
    positionQuery.isError ? positionErrorText : "";

  const refreshPosition = useCallback(() => {
    if (address && configured) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lendingPosition(address),
      });
    }
  }, [address, configured, queryClient]);

  // ── Demo ledger ──────────────────────────────────────────────────────────

  const [ledger, setLedger] = useState<Ledger>({});
  const [resetNotice, setResetNotice] = useState(false);

  // Load ledger from localStorage when the wallet address changes.
  useEffect(() => {
    const { ledger: loaded, reset } = loadLedger(address ?? null);
    setLedger(loaded);
    if (reset) setResetNotice(true);
  }, [address]);

  // Cross-tab sync via the storage event.
  useEffect(() => {
    const key = storageKey(address ?? null);
    function onStorage(e: StorageEvent) {
      if (e.key !== key) return;
      if (e.newValue === null) {
        setLedger({});
        return;
      }
      try {
        const { ledger: reloaded } = loadLedger(address ?? null);
        setLedger(reloaded);
      } catch {
        // ignore malformed events from other tabs
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [address]);

  const saveLedgerEntry = useCallback(
    (next: Ledger) => {
      setLedger(next);
      saveLedger(address ?? null, next);
    },
    [address],
  );

  const dismissResetNotice = useCallback(() => setResetNotice(false), []);

  // ── Combined position map ────────────────────────────────────────────────

  const position = positionQuery.data ?? null;

  const marketPositions = useMemo<MarketPositionMap>(() => {
    const map: MarketPositionMap = { ...ledger };
    if (onChainMode && position) {
      for (const m of activeMarkets) {
        if (m.live) {
          map[m.symbol] = {
            supplied: position.collateral,
            borrowed: position.debt,
          };
        }
      }
    }
    return map;
  }, [ledger, onChainMode, position, activeMarkets]);

  return {
    position,
    isLoadingPosition: positionQuery.isLoading,
    positionError,
    ledger,
    saveLedgerEntry,
    resetNotice,
    dismissResetNotice,
    marketPositions,
    refreshPosition,
  };
}
