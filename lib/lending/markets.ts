/**
 * Market rate and utilization derivation utilities.
 *
 * These formulas mirror standard DeFi lending pool mechanics:
 * - Utilization = totalBorrow / totalSupply (clamped to [0, 1])
 * - Borrow rate = base rate + (utilization × rate slope)
 * - Supply rate = borrow rate × utilization × (1 − reserve factor)
 */

export interface MarketParams {
  totalSupply: number;
  totalBorrow: number;
  baseRate: number; // Base borrow APR (e.g. 2%)
  rateSlope: number; // Additional borrow APR at 100% utilization (e.g. 10%)
  reserveFactor: number; // Protocol fee on borrow interest (e.g. 0.1 = 10%)
}

export interface MarketRates {
  utilization: number;
  supplyApr: number;
  borrowApr: number;
}

/**
 * Calculate utilization ratio: borrowed / supplied.
 * Returns 0 when supply is 0 to avoid division by zero.
 * Clamps to [0, 1] to handle over-utilized edge cases.
 */
export function calculateUtilization(totalSupply: number, totalBorrow: number): number {
  if (totalSupply <= 0) {
    return 0;
  }

  const utilization = totalBorrow / totalSupply;
  return Math.min(1, Math.max(0, utilization));
}

/**
 * Calculate borrow APR from utilization using a linear model.
 * borrowApr = baseRate + (utilization × rateSlope)
 */
export function calculateBorrowRate(utilization: number, baseRate: number, rateSlope: number): number {
  const clampedUtilization = Math.min(1, Math.max(0, utilization));
  const rate = baseRate + clampedUtilization * rateSlope;
  return parseFloat(rate.toFixed(4));
}

/**
 * Calculate supply APR from borrow rate and utilization.
 * supplyApr = borrowApr × utilization × (1 − reserveFactor)
 *
 * This reflects that suppliers earn a portion of the borrow interest
 * proportional to utilization, minus the protocol reserve.
 */
export function calculateSupplyRate(
  borrowApr: number,
  utilization: number,
  reserveFactor: number,
): number {
  const clampedBorrowApr = Math.max(0, borrowApr);
  const clampedUtilization = Math.min(1, Math.max(0, utilization));
  const clampedReserveFactor = Math.min(1, Math.max(0, reserveFactor));
  const rate = clampedBorrowApr * clampedUtilization * (1 - clampedReserveFactor);
  return parseFloat(rate.toFixed(4));
}

/**
 * Derive full market rates (utilization, supplyApr, borrowApr) from raw market params.
 */
export function deriveMarketRates(params: MarketParams): MarketRates {
  const utilization = calculateUtilization(params.totalSupply, params.totalBorrow);
  const borrowApr = calculateBorrowRate(utilization, params.baseRate, params.rateSlope);
  const supplyApr = calculateSupplyRate(borrowApr, utilization, params.reserveFactor);

  return {
    utilization: parseFloat(utilization.toFixed(4)),
    supplyApr,
    borrowApr,
  };
}

// Re-export hook for backward compatibility
export { useMarketRates } from "@/hooks/useMarketRates";
