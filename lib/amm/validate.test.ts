import { describe, expect, it } from "vitest";
import { IMPACT_GUARD_DISABLED, type SwapQuoteResult } from "./quote";
import { GUARD_ERROR_MESSAGES, validateQuote } from "./validate";

describe("validateQuote guards", () => {
  const baseQuote: SwapQuoteResult = {
    amountOut: 9_871n,
    fee: 30n,
    reserveInAfter: 1_010_000n,
    reserveOutAfter: 990_129n,
  };

  it("passes when all guards are satisfied", () => {
    const issues = validateQuote(baseQuote, {
      amountIn: 10_000n,
      minSwapIn: 1_000n,
      maxImpactBps: 500,
      minLiquidity: 1_000n,
      impactBps: 196n,
    });
    expect(issues).toEqual([]);
  });

  it("detects below_min_swap_in when amountIn is below minSwapIn", () => {
    const issues = validateQuote(baseQuote, {
      amountIn: 500n,
      minSwapIn: 1_000n,
      maxImpactBps: 500,
      minLiquidity: 1_000n,
      impactBps: 10n,
    });
    expect(issues).toContain("below_min_swap_in");
    expect(GUARD_ERROR_MESSAGES.below_min_swap_in).toBeDefined();
  });

  it("does not trigger below_min_swap_in if minSwapIn is 0 (disabled)", () => {
    const issues = validateQuote(baseQuote, {
      amountIn: 500n,
      minSwapIn: 0n,
      maxImpactBps: 500,
      minLiquidity: 1_000n,
      impactBps: 10n,
    });
    expect(issues).not.toContain("below_min_swap_in");
  });

  it("detects zero_output when amountOut is 0", () => {
    const zeroQuote: SwapQuoteResult = {
      ...baseQuote,
      amountOut: 0n,
    };
    const issues = validateQuote(zeroQuote, {
      amountIn: 10_000n,
      minSwapIn: 0n,
      maxImpactBps: 500,
      minLiquidity: 0n,
      impactBps: 0n,
    });
    expect(issues).toContain("zero_output");
  });

  it("detects below_min_liquidity when reserveOutAfter is below minLiquidity floor", () => {
    const issues = validateQuote(baseQuote, {
      amountIn: 10_000n,
      minSwapIn: 0n,
      maxImpactBps: 500,
      minLiquidity: 1_000_000n,
      impactBps: 196n,
    });
    expect(issues).toContain("below_min_liquidity");
  });

  it("does not trigger below_min_liquidity when minLiquidity is 0", () => {
    const depletedQuote: SwapQuoteResult = {
      ...baseQuote,
      reserveOutAfter: 10n,
    };
    const issues = validateQuote(depletedQuote, {
      amountIn: 10_000n,
      minSwapIn: 0n,
      maxImpactBps: 500,
      minLiquidity: 0n,
      impactBps: 50n,
    });
    expect(issues).not.toContain("below_min_liquidity");
  });

  it("detects impact_exceeds_guard when impact is strictly greater than maxImpactBps", () => {
    const issues = validateQuote(baseQuote, {
      amountIn: 10_000n,
      minSwapIn: 0n,
      maxImpactBps: 50,
      minLiquidity: 0n,
      impactBps: 196n,
    });
    expect(issues).toContain("impact_exceeds_guard");
  });

  it("allows equal-to-cap impact (strict > comparison per PRICE_IMPACT_GUARD.md)", () => {
    const issues = validateQuote(baseQuote, {
      amountIn: 10_000n,
      minSwapIn: 0n,
      maxImpactBps: 196,
      minLiquidity: 0n,
      impactBps: 196n,
    });
    expect(issues).not.toContain("impact_exceeds_guard");
  });

  it("allows any impact when impact guard is disabled (u32::MAX)", () => {
    const issues = validateQuote(baseQuote, {
      amountIn: 10_000n,
      minSwapIn: 0n,
      maxImpactBps: IMPACT_GUARD_DISABLED,
      minLiquidity: 0n,
      impactBps: 9_999n,
    });
    expect(issues).not.toContain("impact_exceeds_guard");
  });

  it("flags impact_exceeds_guard if impact calculation failed (null) and guard is active", () => {
    const issues = validateQuote(baseQuote, {
      amountIn: 10_000n,
      minSwapIn: 0n,
      maxImpactBps: 200,
      minLiquidity: 0n,
      impactBps: null,
    });
    expect(issues).toContain("impact_exceeds_guard");
  });

  it("returns multiple issues when multiple guards are violated", () => {
    const zeroQuote: SwapQuoteResult = {
      ...baseQuote,
      amountOut: 0n,
      reserveOutAfter: 50n,
    };
    const issues = validateQuote(zeroQuote, {
      amountIn: 10n,
      minSwapIn: 100n,
      maxImpactBps: 50,
      minLiquidity: 500n,
      impactBps: 100n,
    });
    expect(issues).toContain("below_min_swap_in");
    expect(issues).toContain("zero_output");
    expect(issues).toContain("below_min_liquidity");
    expect(issues).toContain("impact_exceeds_guard");
    expect(issues.length).toBe(4);
  });
});
