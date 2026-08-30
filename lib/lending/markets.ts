/**
 * Market rate and utilization derivation for the lending UI.
 *
 * `useMarketRates` remains the React entry point (re-exported from the hook).
 * The pure helpers below pin the numeric contracts that the markets stub and
 * the eventual Soroban `get_reserve_data` integration must honour so APR and
 * utilization display stay stable under boundary inputs.
 *
 * See docs/markets-derivation.md.
 */

export { useMarketRates } from "@/hooks/useMarketRates";
export type { UseMarketRatesResult } from "@/hooks/useMarketRates";

/** Minimum set of fields a market row must expose for rate selection. */
export type MarketRateRow = {
  asset: string;
  borrowApr: number;
  supplyApr?: number;
  utilization?: number;
  totalSupply?: number;
  totalBorrow?: number;
};

/**
 * Clamp a raw ratio into the unit interval [0, 1].
 * Non-finite values collapse to 0 so callers never render NaN/Infinity.
 */
export function clampUnitInterval(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

/**
 * Utilization = totalBorrow / totalSupply, clamped to [0, 1].
 *
 * Boundary rules (fail-closed / display-safe):
 * - non-finite inputs → 0
 * - totalSupply ≤ 0 (empty or inverted pool) → 0 (nothing to utilise against)
 * - totalBorrow ≤ 0 → 0
 * - raw ratio > 1 (over-utilised / accounting lag) → 1
 * - raw ratio < 0 → 0
 */
export function deriveUtilization(
  totalSupply: number,
  totalBorrow: number,
): number {
  if (!Number.isFinite(totalSupply) || !Number.isFinite(totalBorrow)) {
    return 0;
  }
  if (totalSupply <= 0 || totalBorrow <= 0) {
    return 0;
  }

  const raw = totalBorrow / totalSupply;
  return clampUnitInterval(raw);
}

/**
 * Round an APR percentage to 2 decimal places.
 * Matches the repository stub contract (`toFixed(2)`).
 */
export function roundApr(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return parseFloat(value.toFixed(2));
}

/**
 * Round utilization to 4 decimal places after clamping to [0, 1].
 * Matches the repository stub contract (`toFixed(4)`).
 */
export function roundUtilization(value: number): number {
  return parseFloat(clampUnitInterval(value).toFixed(4));
}

/**
 * Derive utilization from totals and apply the repository display precision.
 */
export function deriveRoundedUtilization(
  totalSupply: number,
  totalBorrow: number,
): number {
  return roundUtilization(deriveUtilization(totalSupply, totalBorrow));
}

/**
 * Pick the borrow APR for an asset from a markets list.
 *
 * Mirrors `useMarketRates` selection:
 * - asset is trimmed + uppercased for comparison
 * - missing asset or non-numeric `borrowApr` → null
 * - zero is a valid APR (empty pool with a free rate)
 */
export function selectBorrowApr(
  markets: readonly MarketRateRow[],
  asset: string | null | undefined,
): number | null {
  const normalized = asset?.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  const market = markets.find(
    (entry) => entry.asset.toUpperCase() === normalized,
  );

  if (!market || typeof market.borrowApr !== "number") {
    return null;
  }
  if (!Number.isFinite(market.borrowApr)) {
    return null;
  }

  return market.borrowApr;
}

/**
 * Pick the supply APR for an asset. Same selection rules as `selectBorrowApr`.
 */
export function selectSupplyApr(
  markets: readonly MarketRateRow[],
  asset: string | null | undefined,
): number | null {
  const normalized = asset?.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  const market = markets.find(
    (entry) => entry.asset.toUpperCase() === normalized,
  );

  if (!market || typeof market.supplyApr !== "number") {
    return null;
  }
  if (!Number.isFinite(market.supplyApr)) {
    return null;
  }

  return market.supplyApr;
}
