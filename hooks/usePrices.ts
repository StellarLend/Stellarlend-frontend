"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
    url.searchParams.set("assets", assets.join(","));
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to fetch prices");
  }

  const data: PriceResponse = await response.json();
  return data.prices;
}

export async function loadPrices(assets: string[]): Promise<CacheEntry> {
  const key = cacheKeyForAssets(assets);
  const cached = sessionCache.get(key);

  if (cached && !isPriceCacheStale(cached)) {
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
  const symbolsKey = useMemo(
    () => cacheKeyForAssets(assets),
    [assets.join(",")],
  );

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

    loadPrices(assets).then((result) => {
      if (active) {
        setEntry(result);
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [symbolsKey, assets]);

  const refresh = useCallback(async () => {
    const result = await loadPrices(assets);
    setEntry(result);
    setIsLoading(false);
  }, [assets]);

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
