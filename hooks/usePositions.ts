import { useState, useEffect, useCallback, useMemo } from "react";

export interface BorrowPosition {
  id: string;
  asset: string;
  amount: number;
  /** USD value of this position used as collateral */
  collateralUsd?: number;
  healthFactor?: number;
  nextDue?: string;
}

export interface CollateralShare {
  asset: string;
  usdValue: number;
  /** Integer percentage 0-100; sum across all shares equals exactly 100 */
  share: number;
}

/**
 * Derives per-asset collateral shares from positions.
 * Rounding is handled via largest-remainder so the shares always sum to 100.
 */
export function deriveCollateralShares(positions: BorrowPosition[]): CollateralShare[] {
  const collateral = positions.filter((p) => (p.collateralUsd ?? 0) > 0);
  if (!collateral.length) return [];

  const total = collateral.reduce((s, p) => s + (p.collateralUsd ?? 0), 0);
  if (total === 0) return [];

  // Initial floored percentages + fractional remainders
  const rows = collateral.map((p) => {
    const exact = ((p.collateralUsd ?? 0) / total) * 100;
    return { asset: p.asset, usdValue: p.collateralUsd ?? 0, floored: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });

  // Distribute remaining percentage points to rows with largest remainders
  const distributed = 100 - rows.reduce((s, r) => s + r.floored, 0);
  rows.sort((a, b) => b.remainder - a.remainder);
  rows.forEach((r, i) => { r.floored += i < distributed ? 1 : 0; });

  return rows.map(({ asset, usdValue, floored }) => ({ asset, usdValue, share: floored }));
}

export interface UsePositionsResult {
  positions: BorrowPosition[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isStale: boolean;
  isOffline: boolean;
}

export function usePositions(onError?: (error: Error) => void): UsePositionsResult {
  const [positions, setPositions] = useState<BorrowPosition[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      fetchPositions();
    };
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchPositions = useCallback(async (abortSignal?: AbortSignal, attempts = 0) => {
    if (attempts === 0) setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/positions", { signal: abortSignal });
      if (!response.ok) {
        throw new Error(`Failed to fetch positions: ${response.statusText}`);
      }
      const data = await response.json();
      const mapped = mapPositionsResponse(data);
      setPositions(mapped);
      setIsStale(false);
      setIsOffline(false);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return; // Aborted
      }

      setIsStale(true);
      const errorObj = err instanceof Error ? err : new Error(String(err));
      
      if (!navigator.onLine) {
        setIsOffline(true);
      }

      const maxAttempts = 5;
      if (attempts < maxAttempts && navigator.onLine) {
        const backoff = Math.min(1000 * (2 ** attempts), 10000);
        const jitter = Math.random() * 500;
        setTimeout(() => {
          if (abortSignal && abortSignal.aborted) return;
          fetchPositions(abortSignal, attempts + 1);
        }, backoff + jitter);
      } else {
        setError(errorObj);
        if (onError) {
          onError(errorObj);
        }
      }
    } finally {
      if (attempts === 0) setIsLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPositions(controller.signal);
    return () => controller.abort();
  }, [fetchPositions]);

  return {
    positions,
    isLoading,
    error,
    refetch: () => fetchPositions(),
    isStale,
    isOffline
  };
}

/** Convenience hook: returns collateral shares derived from usePositions data. */
export function useCollateralShares(): { shares: CollateralShare[]; isLoading: boolean; error: Error | null } {
  const { positions, isLoading, error } = usePositions();
  const shares = useMemo(() => deriveCollateralShares(positions), [positions]);
  return { shares, isLoading, error };
}
