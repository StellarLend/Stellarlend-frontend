"use client";
/**
 * useMarketParams
 *
 * Fetches live on-chain market parameters (LTV, caps, thresholds) with React
 * Query. Falls back to the static MARKETS array merged with demo defaults when
 * the contract is not configured or the fetch fails.
 *
 * The query key lives in lib/query-keys.ts (queryKeys.marketParams).
 *
 * staleTime: 60 s — params change infrequently; a 60-second cache avoids
 * redundant RPC calls while keeping the UI reasonably fresh.
 *
 * refetchInterval: 60_000 — replaces the hand-rolled setInterval / useEffect
 * polling that existed in markets-app.tsx.
 */

import { useQuery } from "@tanstack/react-query";
import { MARKETS, type Market } from "@/lib/markets";
import { fetchLiveMarketParams } from "@/lib/market-params";
import { queryKeys } from "@/lib/query-keys";

export const MARKET_PARAMS_REFETCH_INTERVAL_MS = 60_000;
export const MARKET_PARAMS_STALE_TIME_MS = 60_000;

export type UseMarketParamsResult = {
  /** Markets merged with the latest on-chain parameters. */
  markets: Market[];
  /** True while the first fetch is in flight (skeleton loaders). */
  isLoading: boolean;
  /** True when the last fetch attempt failed. */
  isError: boolean;
};

/**
 * Returns live market params merged into the MARKETS array.
 * While loading, `markets` contains the static MARKETS so the table is
 * immediately visible (and `isLoading` drives the skeleton placeholders).
 */
export function useMarketParams(): UseMarketParamsResult {
  const query = useQuery<Market[]>({
    queryKey: queryKeys.marketParams(),
    queryFn: () => fetchLiveMarketParams(MARKETS),
    staleTime: MARKET_PARAMS_STALE_TIME_MS,
    refetchInterval: MARKET_PARAMS_REFETCH_INTERVAL_MS,
  });

  return {
    markets: query.data ?? MARKETS,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
