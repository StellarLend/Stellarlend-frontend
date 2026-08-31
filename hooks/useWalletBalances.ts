"use client";

/**
 * hooks/useWalletBalances.ts
 *
 * Fetches wallet balances from Horizon on connect and re-fetches when:
 *  - The active wallet address changes.
 *  - The balance data has exceeded BALANCE_STALE_AFTER_MS and the user
 *    returns to the tab (visibilitychange) or the window regains focus.
 *
 * Previously the balance was fetched once per address change with no TTL.
 * Showing hours-old balances without a reload was a silent data-staleness
 * issue. The stale guard makes degraded behavior observable: a
 * `balance_stale` telemetry event fires before each forced re-fetch, and
 * the `isStale` flag is exposed so the UI can show a soft indicator.
 *
 * All telemetry is sanitised — no wallet addresses or raw balance values
 * are forwarded via `onTelemetry`.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useWallet } from "./useWallet";
import { fetchWalletBalances } from "@/lib/wallet/balances";
import { ASSETS, type AssetInfo } from "@/lib/assets";
import { WALLET_BOUNDS, type WalletTelemetryEvent } from "@/types/wallet";

export interface UseWalletBalancesOptions {
  onTelemetry?: (event: WalletTelemetryEvent) => void;
}

export interface UseWalletBalancesResult {
  assetsWithBalances: AssetInfo[];
  loading: boolean;
  error: string | null;
  /** True when the data was last fetched more than BALANCE_STALE_AFTER_MS ago. */
  isStale: boolean;
  /** Manually trigger a re-fetch regardless of TTL. */
  refresh: () => void;
}

export function useWalletBalances(
  { onTelemetry }: UseWalletBalancesOptions = {},
): UseWalletBalancesResult {
  const { address, status } = useWallet();
  const [liveBalances, setLiveBalances] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const isConnected = status === "connected";

  // Track when data was last successfully fetched.
  const lastFetchedAtRef = useRef<number>(0);
  const onTelemetryRef = useRef(onTelemetry);
  onTelemetryRef.current = onTelemetry;

  // -------------------------------------------------------------------------
  // Core fetch
  // -------------------------------------------------------------------------

  const doFetch = useCallback(
    async (addr: string, cancelled: { value: boolean }) => {
      setLoading(true);
      setError(null);
      setIsStale(false);

      const startTime = Date.now();
      onTelemetryRef.current?.({ type: "balance_fetch_started", timestamp: startTime });

      try {
        const balances = await fetchWalletBalances(addr);
        if (cancelled.value) return;

        const map = new Map<string, number>();
        for (const b of balances) {
          map.set(b.symbol, b.amount);
        }
        setLiveBalances(map);
        lastFetchedAtRef.current = Date.now();

        onTelemetryRef.current?.({
          type: "balance_fetch_succeeded",
          timestamp: Date.now(),
          latencyMs: Date.now() - startTime,
          metadata: { assetCount: balances.length },
        });
      } catch (err) {
        if (cancelled.value) return;
        const e = err as Error;
        setError(e.message);
        setLiveBalances(new Map());
        onTelemetryRef.current?.({
          type: "balance_fetch_failed",
          timestamp: Date.now(),
          latencyMs: Date.now() - startTime,
          message: e.message,
        });
      } finally {
        if (!cancelled.value) setLoading(false);
      }
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Manual refresh
  // -------------------------------------------------------------------------

  const refresh = useCallback(() => {
    if (!isConnected || !address) return;
    const cancelled = { value: false };
    void doFetch(address, cancelled);
  }, [address, doFetch, isConnected]);

  // -------------------------------------------------------------------------
  // Fetch on address / connection change
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isConnected || !address) {
      setLiveBalances(new Map());
      setLoading(false);
      setError(null);
      setIsStale(false);
      lastFetchedAtRef.current = 0;
      return;
    }

    const cancelled = { value: false };
    void doFetch(address, cancelled);
    return () => {
      cancelled.value = true;
    };
  }, [address, doFetch, isConnected]);

  // -------------------------------------------------------------------------
  // Stale-data guard: re-fetch on tab focus / visibility if TTL exceeded
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isConnected || !address) return;

    const checkStale = () => {
      if (!isConnected || !address) return;
      const age = Date.now() - lastFetchedAtRef.current;
      if (age >= WALLET_BOUNDS.BALANCE_STALE_AFTER_MS) {
        setIsStale(true);
        onTelemetryRef.current?.({
          type: "balance_stale",
          timestamp: Date.now(),
          metadata: { ageMs: age },
        });
        // Re-fetch automatically on stale detection.
        const cancelled = { value: false };
        void doFetch(address, cancelled);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") checkStale();
    };
    const onFocus = () => checkStale();

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [address, doFetch, isConnected]);

  // -------------------------------------------------------------------------
  // Merge live data with static asset list
  // -------------------------------------------------------------------------

  const assetsWithBalances: AssetInfo[] = ASSETS.map((asset) => {
    const liveBalance = liveBalances.get(asset.symbol);
    if (liveBalance !== undefined) {
      return { ...asset, balance: liveBalance };
    }
    if (isConnected && address) {
      return { ...asset, balance: 0 };
    }
    return asset;
  });

  return { assetsWithBalances, loading, error, isStale, refresh };
}
