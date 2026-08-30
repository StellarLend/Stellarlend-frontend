/**
 * useMarketplaceListings
 *
 * Fetches marketplace listings with bounded filters. Guards against stale data
 * in two ways:
 *  - a monotonically increasing request id means a slow, out-of-order response
 *    can never clobber the result of a newer request;
 *  - an AbortController cancels the previous in-flight request before a new
 *    one starts.
 *
 * Filter changes are validated through the same `normalizeAndValidateFilters`
 * invariants the API uses, so an out-of-bounds filter is reported as
 * `filterErrors` and never sent to the server.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeAndValidateFilters } from "@/lib/marketplace/invariants";
import type { MarketplaceFilters, MarketplaceListing } from "@/types/marketplace";

export interface UseMarketplaceListingsOptions {
  initialFilters?: MarketplaceFilters;
  autoFetch?: boolean;
}

export interface UseMarketplaceListingsReturn {
  listings: MarketplaceListing[];
  total: number;
  nextCursor: string | null;
  isLoading: boolean;
  error: { code: string; message: string } | null;
  filters: MarketplaceFilters;
  filterErrors: Record<string, string>;
  applyFilters: (patch: Partial<MarketplaceFilters>) => Promise<boolean>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  reset: () => void;
}

interface ListingsEnvelope {
  success: boolean;
  data?: {
    listings: MarketplaceListing[];
    nextCursor: string | null;
    total: number;
    filters?: unknown;
  };
  error?: { code: string; message: string };
}

const EMPTY_FILTERS: MarketplaceFilters = {
  availability: "available",
  sort: "newest",
};

function toRawFilters(filters: MarketplaceFilters): Record<string, string | undefined> {
  return {
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    asset: filters.asset,
    category: filters.category,
    availability: filters.availability,
    sort: filters.sort,
    cursor: filters.cursor,
    pageSize: filters.pageSize !== undefined ? String(filters.pageSize) : undefined,
  };
}

function buildQuery(filters: MarketplaceFilters): string {
  const params = new URLSearchParams();
  const raw = toRawFilters(filters);
  for (const [key, value] of Object.entries(raw)) {
    if (value !== undefined && value !== "") {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useMarketplaceListings({
  initialFilters,
  autoFetch = true,
}: UseMarketplaceListingsOptions = {}): UseMarketplaceListingsReturn {
  const [filters, setFilters] = useState<MarketplaceFilters>(
    initialFilters ?? EMPTY_FILTERS,
  );
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [filterErrors, setFilterErrors] = useState<Record<string, string>>({});

  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchPage = useCallback(async (spec: MarketplaceFilters, replace: boolean) => {
    const requestId = ++requestIdRef.current;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/marketplace/listings${buildQuery(spec)}`, {
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
      });
      // A newer request superseded this one; drop the stale response.
      if (requestIdRef.current !== requestId) return;

      const body = (await response.json()) as ListingsEnvelope;
      if (requestIdRef.current !== requestId) return;

      if (!response.ok || !body.success || !body.data) {
        setError(body.error ?? { code: "unknown", message: "Failed to load listings." });
        return;
      }

      setListings((prev) =>
        replace ? body.data!.listings : [...prev, ...body.data!.listings],
      );
      setTotal(body.data.total);
      setNextCursor(body.data.nextCursor);
    } catch (cause) {
      if (requestIdRef.current !== requestId) return;
      const err = cause as Error;
      if (err.name === "AbortError") return;
      setError({ code: "network_error", message: err.message });
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, []);

  const applyFilters = useCallback(
    async (patch: Partial<MarketplaceFilters>): Promise<boolean> => {
      const candidate: MarketplaceFilters = { ...filtersRef.current, ...patch };
      const validation = normalizeAndValidateFilters(toRawFilters(candidate));
      if (!validation.ok) {
        setFilterErrors({ [patchKey(patch)]: validation.message });
        return false;
      }
      setFilterErrors({});
      setFilters(validation.value);
      await fetchPage(validation.value, true);
      return true;
    },
    [fetchPage],
  );

  const refresh = useCallback(() => fetchPage(filtersRef.current, true), [fetchPage]);
  const loadMore = useCallback(() => {
    if (!nextCursor) return Promise.resolve();
    const spec: MarketplaceFilters = { ...filtersRef.current, cursor: nextCursor };
    return fetchPage(spec, false);
  }, [fetchPage, nextCursor]);

  const reset = useCallback(() => {
    setFilters(initialFilters ?? EMPTY_FILTERS);
    setFilterErrors({});
    setListings([]);
    setNextCursor(null);
  }, [initialFilters]);

  useEffect(() => {
    if (!autoFetch) return;
    abortControllerRef.current?.abort();
    return () => abortControllerRef.current?.abort();
  }, [autoFetch]);

  useEffect(() => {
    if (autoFetch) {
      void fetchPage(filtersRef.current, true);
    }
    // Initial mount fetch only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    listings,
    total,
    nextCursor,
    isLoading,
    error,
    filters,
    filterErrors,
    applyFilters,
    refresh,
    loadMore,
    reset,
  };
}

function patchKey(patch: Partial<MarketplaceFilters>): string {
  const first = Object.keys(patch)[0];
  return first ?? "message";
}