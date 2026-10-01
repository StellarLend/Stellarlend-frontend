"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PRICE_CACHE_CONFIG } from "@/lib/prices/constants";
import type { PriceResponse } from "@/lib/prices/types";
import { formatCurrency } from "@/lib/utils/format";

interface CacheEntry {
  prices: Record<string, number>;
  fetchedAt: number;
  error: boolean;
}

const sessionCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<CacheEntry>>();

export function resetPricesCache(): void {
  sessionCache.clear();
  inflightRequests.clear();
}

export function cacheKeyForAssets(assets: string[]): string {
  if (assets.length === 0) return "ALL";
  return [...new Set(assets)].sort().join(",");
}

export function isPriceCacheStale(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAt > PRICE_CACHE_CONFIG.ttl;
}

export function formatAssetPrice(
  price: number | undefined,
  unavailable: boolean,
): string {
  if (unavailable || price === undefined || Number.isNaN(price)) {
    return "Price unavailable";
  }
  return `$${formatCurrency(price)}`;
}

async function fetchPricesFromApi(
  assets: string[],
): Promise<Record<string, number>> {
  const url = new URL("/api/prices", window.location.origin);
  if (assets.length > 0) {
    // Sort + dedupe so the request URL is a deterministic function of the
    // symbol *set*, exactly like the cache/in-flight key. Without this, two
    // callers passing the same symbols in a different order would coalesce
    // onto one request whose URL silently depended on mount order.
    url.searchParams.set("assets", cacheKeyForAssets(assets));
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to fetch prices");
  }

  const data: PriceResponse = await response.json();
  return data.prices;
}

export interface LoadPricesOptions {
  /**
   * Ignore the freshness window and always go to the network. The request is
   * still de-duplicated against any identical call already in flight, so a
   * forced refresh can never fan out into more than one network request.
   */
  force?: boolean;
}

export async function loadPrices(
  assets: string[],
  options: LoadPricesOptions = {},
): Promise<CacheEntry> {
  const key = cacheKeyForAssets(assets);
  const cached = sessionCache.get(key);
  const force = options.force ?? false;

  // `refresh()` is documented as fetching current prices, so it must not be
  // satisfied by a still-fresh cache entry. Only a forced call skips the
  // freshness shortcut; ordinary reads keep the cheap cache hit.
  if (!force && cached && !isPriceCacheStale(cached)) {
    return cached;
  }

  const existingRequest = inflightRequests.get(key);
  if (existingRequest) {
    return existingRequest;
  }

  const request = (async (): Promise<CacheEntry> => {
    try {
      const prices = await fetchPricesFromApi(assets);
      const entry: CacheEntry = {
        prices,
        fetchedAt: Date.now(),
        error: false,
      };
      sessionCache.set(key, entry);
      return entry;
    } catch {
      const entry: CacheEntry = {
        prices: cached?.prices ?? {},
        fetchedAt: cached?.fetchedAt ?? Date.now(),
        error: true,
      };
      sessionCache.set(key, entry);
      return entry;
    } finally {
      inflightRequests.delete(key);
    }
  })();

  inflightRequests.set(key, request);
  return request;
}

export interface UsePricesResult {
  getPriceLabel: (symbol: string) => string;
  isLoading: boolean;
  hasError: boolean;
  refresh: () => Promise<void>;
}

export function usePrices(assets: string[]): UsePricesResult {
  // The set of symbols is what actually matters, not the identity or the order
  // of the caller's array. Joining first keeps the memo pure (it never closes
  // over `assets`) while still recomputing when the symbol set changes.
  const assetsKey = assets.join(",");
  const symbolsKey = useMemo(
    () => cacheKeyForAssets(assetsKey ? assetsKey.split(",") : []),
    [assetsKey],
  );

  // Callers typically pass a fresh array literal (e.g. usePrices(['XLM','USDC']))
  // on every render, so `assets` itself is not a stable dependency. `symbolsKey`
  // is the stable, memoized identity for a given set of symbols; the ref lets
  // the effect and refresh() read the latest array contents without needing
  // `assets` in their dependency lists.
  const assetsRef = useRef(assets);
  assetsRef.current = assets;

  const [entry, setEntry] = useState<CacheEntry | null>(
    () => sessionCache.get(symbolsKey) ?? null,
  );
  const [isLoading, setIsLoading] = useState(
    () => !sessionCache.has(symbolsKey),
  );

  useEffect(() => {
    let active = true;
    const cached = sessionCache.get(symbolsKey);

    if (cached) {
      setEntry(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    loadPrices(assetsRef.current).then((result) => {
      if (active) {
        setEntry(result);
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [symbolsKey]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await loadPrices(assetsRef.current, { force: true });
      setEntry(result);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getPriceLabel = useCallback(
    (symbol: string): string => {
      const price = entry?.prices[symbol];

      if (price !== undefined) {
        return formatAssetPrice(price, false);
      }

      if (isLoading) {
        return "Loading price...";
      }

      return formatAssetPrice(undefined, true);
    },
    [entry, isLoading],
  );

  return {
    getPriceLabel,
    isLoading,
    hasError: entry?.error ?? false,
    refresh,
  };
}
