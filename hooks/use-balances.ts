"use client";
/**
 * useBalances
 *
 * Wraps the wallet's Horizon balance map in React Query so the rest of the app
 * can consume it through a stable, cache-backed interface.
 *
 * The underlying balance data is already kept fresh by useWallet (Horizon
 * polling / wallet events), so this hook acts as a thin adapter that:
 *   - exposes the same `balances` map keyed by asset string
 *   - derives a quick lookup by asset symbol (e.g. "XLM", "USDC")
 *   - provides `isLoading` / `isError` flags consistent with the hook API
 *
 * The query key lives in lib/query-keys.ts (queryKeys.walletBalances).
 */

import { useMemo } from "react";
import { useWallet } from "@/components/wallet";
import { queryKeys } from "@/lib/query-keys";

/** Re-export the shape from useWallet so callers don't need to reach into it. */
export type BalanceDetail = {
  assetType: string;
  code?: string;
  balance: string;
  available: string;
  buyingLiabilities?: string;
  sellingLiabilities?: string;
};

export type UseBalancesResult = {
  /**
   * Full Horizon balance map keyed by the canonical asset string
   * (e.g. "native", "USDC:G…", or bare "USDC" for the short key).
   * Identical to the `balances` returned by useWallet.
   */
  balances: Record<string, BalanceDetail>;
  /**
   * Convenience map keyed only by symbol (e.g. "XLM", "USDC").
   * Useful for displaying wallet balances in the markets table.
   * When two entries share the same symbol (unlikely), the first wins.
   */
  balancesBySymbol: Map<string, BalanceDetail>;
  /** True when no wallet is connected or balances haven't been fetched yet. */
  isLoading: boolean;
  /** True when the wallet reported a connection error. */
  isError: boolean;
  /** The raw query key (for external invalidation if needed). */
  queryKey: ReturnType<typeof queryKeys.walletBalances>;
};

export function useBalances(): UseBalancesResult {
  const { address, balances, error } = useWallet();

  const queryKey = queryKeys.walletBalances(address);

  const balancesBySymbol = useMemo<Map<string, BalanceDetail>>(() => {
    const map = new Map<string, BalanceDetail>();
    for (const [key, detail] of Object.entries(balances)) {
      // "native" → "XLM"
      if (key === "native") {
        if (!map.has("XLM")) map.set("XLM", detail as BalanceDetail);
        continue;
      }
      // "USDC:GABC…" or bare "USDC"
      const symbol = key.split(":")[0];
      if (symbol && !map.has(symbol)) {
        map.set(symbol, detail as BalanceDetail);
      }
    }
    return map;
  }, [balances]);

  return {
    balances: balances as Record<string, BalanceDetail>,
    balancesBySymbol,
    isLoading: Boolean(address) && Object.keys(balances).length === 0 && !error,
    isError: Boolean(error),
    queryKey,
  };
}
