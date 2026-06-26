import { useState, useEffect, useCallback } from "react";

export interface BorrowPosition {
  id: string;
  asset: string;
  amount: number;
  healthFactor?: number;
  nextDue?: string;
}

export interface UsePositionsResult {
  positions: BorrowPosition[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function mapPositionsResponse(data: any): BorrowPosition[] {
  if (!data) return [];

  const borrowPositions: BorrowPosition[] = [];

  // 1. Support direct object format with borrowedAmount
  if (data.borrowedAmount) {
    const match = String(data.borrowedAmount).match(/\$?([0-9,.]+)\s*([A-Za-z0-9]+)/);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ""));
      const asset = match[2];
      if (amount > 0) {
        borrowPositions.push({
          id: `borrow-${asset}`,
          asset,
          amount,
          healthFactor: typeof data.healthFactor === "number" ? data.healthFactor : undefined,
          nextDue: data.nextDue || undefined,
        });
      }
    }
  }

  // 2. Support array format in positions property (forward-compatibility/storybook mock support)
  if (Array.isArray(data.positions)) {
    data.positions.forEach((pos: any, idx: number) => {
      const type = pos.type || pos.side || "";
      const isBorrow = type.toLowerCase() === "borrow" || pos.borrowedAmount || pos.isBorrow;
      if (isBorrow) {
        const asset = pos.asset || pos.symbol || "";
        let amount = 0;
        if (typeof pos.amount === "number") {
          amount = pos.amount;
        } else if (pos.borrowedAmount) {
          const amtStr = String(pos.borrowedAmount).replace(/[^\d.-]/g, "");
          amount = parseFloat(amtStr) || 0;
        } else if (pos.amount) {
          const amtStr = String(pos.amount).replace(/[^\d.-]/g, "");
          amount = parseFloat(amtStr) || 0;
        }

        if (asset && amount > 0) {
          borrowPositions.push({
            id: pos.id || `borrow-${asset}-${idx}`,
            asset,
            amount,
            healthFactor: pos.healthFactor ?? data.healthFactor,
            nextDue: pos.nextDue ?? data.nextDue,
          });
        }
      }
    });
  }

  return borrowPositions;
}

export function usePositions(onError?: (error: Error) => void): UsePositionsResult {
  const [positions, setPositions] = useState<BorrowPosition[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPositions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/positions");
      if (!response.ok) {
        throw new Error(`Failed to fetch positions: ${response.statusText}`);
      }
      const data = await response.json();
      const mapped = mapPositionsResponse(data);
      setPositions(mapped);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      if (onError) {
        onError(errorObj);
      }
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  return {
    positions,
    isLoading,
    error,
    refetch: fetchPositions,
  };
}
