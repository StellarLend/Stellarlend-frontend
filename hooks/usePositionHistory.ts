import { useState, useEffect, useCallback, useMemo } from "react";
import { SnapshotHistoryResponse } from "@/lib/positions/snapshot";

export type TimeWindow = "24h" | "7d" | "30d";

const TIME_WINDOW_MS: Record<TimeWindow, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export interface NetWorthSnapshot {
  timestamp: number;
  netWorth: number;
}

export interface NetWorthTrendData {
  snapshots: NetWorthSnapshot[];
  window: TimeWindow;
}

export interface UsePositionHistoryResult {
  data: NetWorthTrendData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePositionHistory(
  window: TimeWindow = "7d",
  fetcher: typeof fetch = fetch
): UsePositionHistoryResult {
  const [data, setData] = useState<NetWorthTrendData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const now = Date.now();
      const from = now - TIME_WINDOW_MS[window];
      const to = now;

      const response = await fetcher(
        `/api/positions/history?from=${from}&to=${to}&interval=1h`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Failed to fetch position history: ${response.status} ${response.statusText}`
        );
      }

      const rawData: SnapshotHistoryResponse = await response.json();

      const snapshots: NetWorthSnapshot[] = rawData.snapshots.map((s) => ({
        timestamp: s.timestamp,
        netWorth: s.supplied - s.borrowed,
      }));

      setData({
        snapshots,
        window,
      });
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
    } finally {
      setIsLoading(false);
    }
  }, [window, fetcher]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return useMemo(
    () => ({
      data,
      isLoading,
      error,
      refetch: fetchHistory,
    }),
    [data, isLoading, error, fetchHistory]
  );
}