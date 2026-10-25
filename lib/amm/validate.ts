import { IMPACT_GUARD_DISABLED, type SwapQuoteResult } from "./quote";

export type GuardIssue =
  | "below_min_swap_in"
  | "zero_output"
  | "impact_exceeds_guard"
  | "below_min_liquidity";

export type QuoteGuards = {
  amountIn: bigint;
  minSwapIn: bigint;
  maxImpactBps: number; // u32 from contract get_max_impact_bps
  minLiquidity: bigint; // floor from contract get_min_liquidity
  impactBps: bigint | null;
};

export const GUARD_ERROR_MESSAGES: Record<GuardIssue, string> = {
  below_min_swap_in: "Input amount is below the pool's minimum swap requirement.",
  zero_output: "Output amount rounds to zero; swap cannot proceed.",
  impact_exceeds_guard: "Price impact exceeds the pool's safety threshold.",
  below_min_liquidity: "Swap would deplete the pool reserve below its minimum liquidity floor.",
};

/**
 * Validates a projected swap quote against contract guards.
 *
 * Citing `swap_internal` in contracts `lib.rs`:
 * 1. min_swap_in: if min_swap_in > 0 && amount_in < min_swap_in -> AmountBelowMinSwapIn
 * 2. zero_output: if amount_out == 0 -> ZeroOutput
 * 3. below_min_liquidity: if floor > 0 && new_out < floor -> BelowMinLiquidity (floor only protects outgoing reserve)
 * 4. impact_exceeds_guard: if max_impact != IMPACT_GUARD_DISABLED && impact_bps > max_impact -> PriceImpactExceeded
 */
export function validateQuote(
  quote: SwapQuoteResult,
  guards: QuoteGuards,
): GuardIssue[] {
  const issues: GuardIssue[] = [];

  // 1. Min swap in guard
  if (guards.minSwapIn > 0n && guards.amountIn < guards.minSwapIn) {
    issues.push("below_min_swap_in");
  }

  // 2. Zero output guard
  if (quote.amountOut === 0n) {
    issues.push("zero_output");
  }

  // 3. Below minimum liquidity floor guard (outgoing reserve is reserveOutAfter)
  if (guards.minLiquidity > 0n && quote.reserveOutAfter < guards.minLiquidity) {
    issues.push("below_min_liquidity");
  }

  // 4. Price impact guard (strict > comparison as specified in PRICE_IMPACT_GUARD.md)
  if (guards.maxImpactBps !== IMPACT_GUARD_DISABLED) {
    if (guards.impactBps === null || guards.impactBps > BigInt(guards.maxImpactBps)) {
      issues.push("impact_exceeds_guard");
    }
  }

  return issues;
}
