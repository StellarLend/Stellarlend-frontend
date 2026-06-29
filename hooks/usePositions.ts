import { useState, useEffect, useCallback, useMemo, useRef } from "react";

export interface SupplyPosition {
  id: string;
  asset: string;
  suppliedAmount: number;
  lockedCollateral: number;
  outstandingDebt: number;
  healthFactor?: number | null;
}

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
  supplyPositions: SupplyPosition[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

function parseAmountValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const match = value.match(/[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/);
    if (match) {
      return parseFloat(match[0].replace(/,/g, "")) || 0;
    }
  }

  return 0;
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

export function mapSupplyPositionsResponse(data: any): SupplyPosition[] {
  if (!data) return [];

  const supplyPositions: SupplyPosition[] = [];

  const addSupplyPosition = (entry: any, index: number) => {
    const asset =
      entry?.asset ||
      entry?.symbol ||
      entry?.currency ||
      data?.asset ||
      "";

    if (!asset) return;

    const suppliedAmount = parseAmountValue(
      entry?.suppliedAmount ??
        entry?.suppliedFunds ??
        entry?.amount ??
        entry?.balance ??
        data?.suppliedFunds ??
        data?.amount ??
        0,
    );
    const availableBalance = parseAmountValue(
      entry?.availableBalance ??
        entry?.available ??
        entry?.withdrawable ??
        entry?.availableToWithdraw ??
        data?.availableBalance ??
        data?.available ??
        0,
    );
    const outstandingDebt = parseAmountValue(
      entry?.outstandingDebt ??
        entry?.borrowedAmount ??
        entry?.debt ??
        entry?.debtAmount ??
        data?.borrowedAmount ??
        data?.outstandingDebt ??
        0,
    );
    const healthFactor =
      typeof entry?.healthFactor === "number"
        ? entry.healthFactor
        : typeof data?.healthFactor === "number"
          ? data.healthFactor
          : undefined;

    const normalizedSuppliedAmount = Math.max(0, suppliedAmount);
    const normalizedAvailableBalance = Math.max(0, availableBalance);

    if (
      normalizedSuppliedAmount === 0 &&
      normalizedAvailableBalance === 0 &&
      outstandingDebt === 0
    ) {
      return;
    }

    supplyPositions.push({
      id: entry?.id || `supply-${asset}-${index}`,
      asset,
      suppliedAmount: normalizedSuppliedAmount,
      lockedCollateral: Math.max(0, normalizedSuppliedAmount - normalizedAvailableBalance),
      outstandingDebt,
      healthFactor,
    });
  };

  if (
    typeof data.suppliedFunds === "string" ||
    typeof data.availableBalance === "string" ||
    typeof data.borrowedAmount === "string" ||
    typeof data.outstandingDebt === "string" ||
    typeof data.asset === "string"
  ) {
    addSupplyPosition(data, 0);
  }

  if (Array.isArray(data.positions)) {
    data.positions.forEach((position: any, index: number) => {
      const type = String(position?.type || position?.side || "").toLowerCase();
      const hasSupplyData = Boolean(
        position?.suppliedFunds ||
          position?.availableBalance ||
          position?.borrowedAmount ||
          position?.outstandingDebt ||
          position?.amount ||
          position?.balance,
      );
      const isSupplyPosition =
        type === "supply" ||
        type === "lend" ||
        type === "supplied" ||
        hasSupplyData;

      if (isSupplyPosition) {
        addSupplyPosition(position, index);
      }
    });
  }

  return supplyPositions;
}

export function usePositions(onError?: (error: Error) => void): UsePositionsResult {
  const [positions, setPositions] = useState<BorrowPosition[]>([]);
  const [supplyPositions, setSupplyPositions] = useState<SupplyPosition[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const fetchPositions = useCallback(async () => {
    if (!hasLoadedOnceRef.current) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const response = await fetch("/api/positions", { signal: abortSignal });
      if (!response.ok) {
        throw new Error(`Failed to fetch positions: ${response.statusText}`);
      }
      const data = await response.json();
      const mapped = mapPositionsResponse(data);
      const mappedSupply = mapSupplyPositionsResponse(data);
      setPositions(mapped);
      setSupplyPositions(mappedSupply);
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
      hasLoadedOnceRef.current = true;
      setIsLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPositions(controller.signal);
    return () => controller.abort();
  }, [fetchPositions]);

  return {
    positions,
    supplyPositions,
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
