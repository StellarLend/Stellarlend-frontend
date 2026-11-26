"use client";
/**
 * useWatchlist
 *
 * Manages the starred-markets watchlist with:
 *   - Initial load from localStorage on mount / address change.
 *   - Cross-tab sync via the storage event.
 *   - Stable toggle callback that updates state and persists in one step.
 */

import { useCallback, useEffect, useState } from "react";
import { loadWatchlist, saveWatchlist, toggleWatchlist, watchlistKey } from "@/lib/watchlist";

export type UseWatchlistReturn = {
  /** Symbols the user has starred, in insertion order. */
  watchlist: string[];
  /** Returns true when the given symbol is starred. */
  isStarred: (symbol: string) => boolean;
  /** Toggle the starred state of a symbol. Persists to localStorage. */
  toggle: (symbol: string) => void;
};

/**
 * @param address - Connected wallet address (null = demo/anon).
 */
export function useWatchlist(address: string | null): UseWatchlistReturn {
  const [watchlist, setWatchlist] = useState<string[]>([]);

  // Load on mount and whenever the address changes
  useEffect(() => {
    setWatchlist(loadWatchlist(address));
  }, [address]);

  // Cross-tab sync via the storage event
  useEffect(() => {
    const key = watchlistKey(address);
    function onStorage(e: StorageEvent) {
      if (e.key !== key) return;
      setWatchlist(loadWatchlist(address));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [address]);

  const toggle = useCallback(
    (symbol: string) => {
      setWatchlist((current) => {
        const next = toggleWatchlist(current, symbol);
        saveWatchlist(address, next);
        return next;
      });
    },
    [address]
  );

  const isStarred = useCallback(
    (symbol: string) => watchlist.includes(symbol),
    [watchlist]
  );

  return { watchlist, isStarred, toggle };
}
