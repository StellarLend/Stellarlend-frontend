import { useEffect, useState } from "react";
import type { AssetMarket, MarketsResponse } from "@/lib/markets/types";

const MARKETS_CACHE_TTL_MS = 30_000;

let cachedMarkets: AssetMarket[] | null = null;
let cachedAt = 0;
let marketsRequest: Promise<AssetMarket[]> | null = null;

function loadMarkets(): Promise<AssetMarket[]> {
  const markets = cachedMarkets;
  const cacheIsFresh =
    markets !== null && Date.now() - cachedAt < MARKETS_CACHE_TTL_MS;

  if (cacheIsFresh) {
    return Promise.resolve(markets);
  }

  if (!marketsRequest) {
    marketsRequest = fetch("/api/markets")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Markets request failed with status ${response.status}`,
          );
        }

        const data = (await response.json()) as MarketsResponse;
        const markets = data.markets;
        cachedMarkets = markets;
        cachedAt = Date.now();
        return markets;
      })
      .finally(() => {
        marketsRequest = null;
      });
  }

  return marketsRequest;
}

export interface UseMarketsResult {
  markets: AssetMarket[] | null;
  isLoading: boolean;
  error: string | null;
}

export function useMarkets(): UseMarketsResult {
  const [markets, setMarkets] = useState<AssetMarket[] | null>(cachedMarkets);
  const [isLoading, setIsLoading] = useState(cachedMarkets === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    loadMarkets()
      .then((data) => {
        if (!isCancelled) {
          setMarkets(data);
          setError(null);
        }
      })
      .catch((cause) => {
        if (!isCancelled) {
          setMarkets(null);
          setError(
            cause instanceof Error ? cause.message : "Unable to load markets",
          );
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return { markets, isLoading, error };
}

export function invalidateMarketsCache(): void {
  cachedMarkets = null;
  cachedAt = 0;
  marketsRequest = null;
}
