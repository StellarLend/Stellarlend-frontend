import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { SnapshotHistoryResponse } from "@/lib/positions/snapshot";

export type TimeWindow = "24h" | "7d" | "30d";

const TIME_WINDOW_MS: Record<TimeWindow, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 800;
const MAX_BACKOFF_MS = 8_000;

function backoffDelay(attempt: number): number {
  const exponential = BASE_BACKOFF_MS * 2 ** attempt;
  return Math.min(exponential, MAX_BACKOFF_MS) + Math.random() * 300;
}

export interface NetWorthSnapshot {
  timestamp: number;
  /** supplied − borrowed; may be negative when debt exceeds collateral */
  netWorth: number;
}

export interface NetWorthTrendData {
  snapshots: NetWorthSnapshot[];
  window: TimeWindow;
}

export interface UsePositionHistoryResult {
  data: NetWorthTrendData | null;
  /**
   * True while the initial load (no prior data) is in progress.
   * Stays false during background retries when stale data is already present.
   */
  isLoading: boolean;
  /**
   * True when the last fetch failed and retries are in progress, but a
   * prior successful response is still being served as `data`.
   */
  isStale: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Normalises a raw snapshot into a NetWorthSnapshot.
 * Returns null for records with non-finite or negative supplied/borrowed values
 * so that incomparable time-series points are never mixed into trend charts.
 */
function normalizeSnapshot(
  raw: SnapshotHistoryResponse["snapshots"][number],
): NetWorthSnapshot | null {
  const supplied =
    Number.isFinite(raw.supplied) && raw.supplied >= 0 ? raw.supplied : null;
  const borrowed =
    Number.isFinite(raw.borrowed) && raw.borrowed >= 0 ? raw.borrowed : null;
  if (supplied === null || borrowed === null) return null;
  if (!Number.isFinite(raw.timestamp) || raw.timestamp <= 0) return null;
  return { timestamp: raw.timestamp, netWorth: supplied - borrowed };
}

export function usePositionHistory(
  window: TimeWindow = "7d",
  fetcher: typeof fetch = fetch,
): UsePositionHistoryResult {
  const [data, setData] = useState<NetWorthTrendData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Generation counter — incremented each time a new fetch sequence starts
   * (window change or manual refetch).  Responses from prior generations
   * are discarded to prevent stale responses creating contradictory state.
   */
  const generationRef = useRef(0);

  const fetchHistory = useCallback(
    async (signal: AbortSignal, generation: number, attempt = 0) => {
      // Bail early if superseded by a newer fetch sequence
      if (generation !== generationRef.current) return;

      // Show the skeleton spinner only on the very first load (no prior data)
      if (attempt === 0) {
        setIsLoading((prev) => (data === null ? true : prev));
        setError(null);
      }

      try {
        const now = Date.now();
        const from = now - TIME_WINDOW_MS[window];
        const to = now;

        const response = await fetcher(
          `/api/positions/history?from=${from}&to=${to}&interval=1h`,
          { signal },
        );

        // Stale-generation guard after the await
        if (generation !== generationRef.current) return;

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message ||
              `Failed to fetch position history: ${response.status} ${response.statusText}`,
          );
        }

        const rawData: SnapshotHistoryResponse = await response.json();

        // Stale-generation guard after second await
        if (generation !== generationRef.current) return;

        const snapshots = (rawData.snapshots ?? [])
          .map(normalizeSnapshot)
          .filter((s): s is NetWorthSnapshot => s !== null)
          .sort((a, b) => a.timestamp - b.timestamp);

        setData({ snapshots, window });
        setIsStale(false);
        setIsLoading(false);
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (signal.aborted) return;
        if (generation !== generationRef.current) return;

        if (attempt < MAX_RETRIES) {
          // Surface staleness while retries are in progress
          setIsStale(true);
          setIsLoading(false);

          const delay = backoffDelay(attempt);
          await new Promise<void>((resolve) => {
            const t = setTimeout(resolve, delay);
            signal.addEventListener("abort", () => {
              clearTimeout(t);
              resolve();
            }, { once: true });
          });

          if (signal.aborted) return;
          if (generation !== generationRef.current) return;

          return fetchHistory(signal, generation, attempt + 1);
        }

        // Max retries exhausted — surface the error
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        setIsLoading(false);
        // Keep isStale=true so callers know displayed data may be outdated
      }
    },
    // `data` intentionally excluded from deps — we only read it once at
    // attempt===0 to decide whether to show the loading spinner; including it
    // would create an infinite re-subscription loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [window, fetcher],
  );

  useEffect(() => {
    const controller = new AbortController();
    generationRef.current += 1;
    const gen = generationRef.current;

    // Reset loading state for the new window
    setIsLoading(true);
    setIsStale(false);
    setError(null);

    fetchHistory(controller.signal, gen);

    return () => controller.abort();
  }, [fetchHistory]);

  const refetch = useCallback(() => {
    const controller = new AbortController();
    generationRef.current += 1;
    const gen = generationRef.current;
    setIsStale(false);
    setError(null);
    fetchHistory(controller.signal, gen);
  }, [fetchHistory]);

  return useMemo(
    () => ({ data, isLoading, isStale, error, refetch }),
    [data, isLoading, isStale, error, refetch],
  );
}