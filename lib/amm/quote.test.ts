import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  calculateEffectivePrice,
  I128_MAX,
  priceImpactBps,
  quoteExactIn,
} from "./quote";

describe("quoteExactIn contract formula exact fixtures", () => {
  // Test cases from contract swap_quote_test.rs and worked examples:
  // 1. swap_quote_test: ra=1_000_000, rb=2_000_000, amount_in=50_000, fee=30
  // 2. swap_quote_test: ra=500_000, rb=800_000, amount_in=30_000, fee=30
  // 3. PRICE_IMPACT_GUARD worked example: ra=1_000_000, rb=1_000_000, amount_in=10_000, fee=30 -> amount_out=9871, impact=196
  // 4. Large amount near depletion: ra=1_000_000, rb=1_000_000, amount_in=999_990, fee=30
  // Plus 17 additional boundary, fee, and reserve test cases (21 cases in total)
  const cases: Array<{
    amountIn: bigint;
    reserveIn: bigint;
    reserveOut: bigint;
    feeBps: bigint;
    expectedOut: bigint;
    expectedFee: bigint;
  }> = [
    // Case 1: swap_quote_test A->B (ra=1M, rb=2M, in=50k, fee=30)
    {
      amountIn: 50_000n,
      reserveIn: 1_000_000n,
      reserveOut: 2_000_000n,
      feeBps: 30n,
      expectedOut: 94_965n,
      expectedFee: 150n,
    },
    // Case 2: swap_quote_test B->A (rb=800k, ra=500k, in=30k, fee=30)
    {
      amountIn: 30_000n,
      reserveIn: 800_000n,
      reserveOut: 500_000n,
      feeBps: 30n,
      expectedOut: 18_020n,
      expectedFee: 90n,
    },
    // Case 3: PRICE_IMPACT_GUARD.md worked example (ra=1M, rb=1M, in=10k, fee=30)
    {
      amountIn: 10_000n,
      reserveIn: 1_000_000n,
      reserveOut: 1_000_000n,
      feeBps: 30n,
      expectedOut: 9_871n,
      expectedFee: 30n,
    },
    // Case 4: Near depletion A->B (ra=1M, rb=1M, in=999990, fee=30)
    {
      amountIn: 999_990n,
      reserveIn: 1_000_000n,
      reserveOut: 1_000_000n,
      feeBps: 30n,
      expectedOut: 499_246n,
      expectedFee: 2_999n,
    },
    // Case 5: fee_bps = 0
    {
      amountIn: 5_000n,
      reserveIn: 100_000n,
      reserveOut: 100_000n,
      feeBps: 0n,
      expectedOut: 4_761n,
      expectedFee: 0n,
    },
    // Case 6: fee_bps = 5000 (50%)
    {
      amountIn: 10_000n,
      reserveIn: 100_000n,
      reserveOut: 100_000n,
      feeBps: 5_000n,
      expectedOut: 4_761n,
      expectedFee: 5_000n,
    },
    // Case 7: custom bps = 200 (2%), in = 20000
    {
      amountIn: 20_000n,
      reserveIn: 1_000_000n,
      reserveOut: 1_000_000n,
      feeBps: 200n,
      expectedOut: 19_223n,
      expectedFee: 400n,
    },
    // Case 8: Dust input producing 0 output
    {
      amountIn: 1n,
      reserveIn: 1_000_000n,
      reserveOut: 1_000n,
      feeBps: 30n,
      expectedOut: 0n,
      expectedFee: 0n,
    },
    // Case 9: Equal reserves and large swap
    {
      amountIn: 100_000n,
      reserveIn: 100_000n,
      reserveOut: 100_000n,
      feeBps: 30n,
      expectedOut: 49_924n,
      expectedFee: 300n,
    },
    // Case 10: 100 bps (1%)
    {
      amountIn: 1_000n,
      reserveIn: 10_000n,
      reserveOut: 10_000n,
      feeBps: 100n,
      expectedOut: 900n,
      expectedFee: 10n,
    },
    // Case 11: Asymmetric reserves 10:1
    {
      amountIn: 5_000n,
      reserveIn: 50_000n,
      reserveOut: 500_000n,
      feeBps: 30n,
      expectedOut: 45_330n,
      expectedFee: 15n,
    },
    // Case 12: Asymmetric reserves 1:10
    {
      amountIn: 5_000n,
      reserveIn: 500_000n,
      reserveOut: 50_000n,
      feeBps: 30n,
      expectedOut: 493n,
      expectedFee: 15n,
    },
    // Case 13: Fee 10,000 (100% fee) -> amount_out must be 0
    {
      amountIn: 10_000n,
      reserveIn: 100_000n,
      reserveOut: 100_000n,
      feeBps: 10_000n,
      expectedOut: 0n,
      expectedFee: 10_000n,
    },
    // Case 14: Minimal input 1 with small reserve
    {
      amountIn: 1n,
      reserveIn: 10n,
      reserveOut: 10n,
      feeBps: 0n,
      expectedOut: 0n,
      expectedFee: 0n,
    },
    // Case 15: Exact ratio test
    {
      amountIn: 10n,
      reserveIn: 100n,
      reserveOut: 100n,
      feeBps: 0n,
      expectedOut: 9n,
      expectedFee: 0n,
    },
    // Case 16: 10M swap in 100M pool
    {
      amountIn: 10_000_000n,
      reserveIn: 100_000_000n,
      reserveOut: 100_000_000n,
      feeBps: 30n,
      expectedOut: 9_066_108n,
      expectedFee: 30_000n,
    },
    // Case 17: Tiny fee 1 bps
    {
      amountIn: 10_000n,
      reserveIn: 100_000n,
      reserveOut: 100_000n,
      feeBps: 1n,
      expectedOut: 9_090n,
      expectedFee: 1n,
    },
    // Case 18: High fee 9999 bps
    {
      amountIn: 100_000n,
      reserveIn: 100_000n,
      reserveOut: 100_000n,
      feeBps: 9_999n,
      expectedOut: 9n,
      expectedFee: 99_990n,
    },
    // Case 19: 7-decimal Stellar typical amounts (100 XLM into 10,000 XLM pool)
    {
      amountIn: 1_000_000_000n, // 100 tokens with 7 decimals
      reserveIn: 100_000_000_000n, // 10,000 tokens
      reserveOut: 100_000_000_000n,
      feeBps: 30n,
      expectedOut: 987_158_034n,
      expectedFee: 3_000_000n,
    },
    // Case 20: 7-decimal large swap (5,000 tokens into 10,000 tokens pool)
    {
      amountIn: 50_000_000_000n,
      reserveIn: 100_000_000_000n,
      reserveOut: 100_000_000_000n,
      feeBps: 30n,
      expectedOut: 33_266_599_933n,
      expectedFee: 150_000_000n,
    },
    // Case 21: High reserve 10^14 within safe i128
    {
      amountIn: 100_000_000n,
      reserveIn: 100_000_000_000_000n,
      reserveOut: 100_000_000_000_000n,
      feeBps: 30n,
      expectedOut: 99_699_900n,
      expectedFee: 300_000n,
    },
  ];

  it.each(cases)(
    "exact match for amountIn=$amountIn feeBps=$feeBps",
    ({ amountIn, reserveIn, reserveOut, feeBps, expectedOut, expectedFee }) => {
      const res = quoteExactIn({ amountIn, reserveIn, reserveOut, feeBps });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.amountOut).toBe(expectedOut);
        expect(res.value.fee).toBe(expectedFee);
        expect(res.value.reserveInAfter).toBe(reserveIn + amountIn);
        expect(res.value.reserveOutAfter).toBe(reserveOut - expectedOut);
      }
    },
  );

  it("handles zero reserves as EmptyPool", () => {
    expect(quoteExactIn({ amountIn: 100n, reserveIn: 0n, reserveOut: 1000n, feeBps: 30n })).toEqual({
      ok: false,
      error: "EmptyPool",
    });
    expect(quoteExactIn({ amountIn: 100n, reserveIn: 1000n, reserveOut: 0n, feeBps: 30n })).toEqual({
      ok: false,
      error: "EmptyPool",
    });
  });

  it("handles non-positive amountIn as NonPositiveAmount", () => {
    expect(quoteExactIn({ amountIn: 0n, reserveIn: 1000n, reserveOut: 1000n, feeBps: 30n })).toEqual({
      ok: false,
      error: "NonPositiveAmount",
    });
    expect(quoteExactIn({ amountIn: -10n, reserveIn: 1000n, reserveOut: 1000n, feeBps: 30n })).toEqual({
      ok: false,
      error: "NonPositiveAmount",
    });
  });

  it("handles huge reserves near i128 bounds with Overflow check", () => {
    const nearLimit = I128_MAX / 100n;
    const res = quoteExactIn({
      amountIn: nearLimit,
      reserveIn: nearLimit,
      reserveOut: nearLimit,
      feeBps: 30n,
    });
    expect(res).toEqual({ ok: false, error: "Overflow" });
  });

  it("verifies priceImpactBps matches PRICE_IMPACT_GUARD worked example", () => {
    const impact = priceImpactBps({
      reserveIn: 1_000_000n,
      reserveOut: 1_000_000n,
      reserveInAfter: 1_010_000n,
      reserveOutAfter: 990_129n,
    });
    expect(impact).toBe(196n);
  });

  it("verifies effective price calculation", () => {
    const price = calculateEffectivePrice(10_000n, 9_871n, 7, 7, 4);
    expect(price).toBe("0.9871");
  });

  it("symmetry property: quoting A->B then B->A never returns more than input", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1_000n, max: 1_000_000n }),
        fc.bigInt({ min: 10_000_000n, max: 100_000_000n }),
        fc.bigInt({ min: 10_000_000n, max: 100_000_000n }),
        fc.bigInt({ min: 0n, max: 1_000n }),
        (amountIn, reserveA, reserveB, feeBps) => {
          const quoteAB = quoteExactIn({
            amountIn,
            reserveIn: reserveA,
            reserveOut: reserveB,
            feeBps,
          });
          if (!quoteAB.ok || quoteAB.value.amountOut === 0n) return true;

          const quoteBA = quoteExactIn({
            amountIn: quoteAB.value.amountOut,
            reserveIn: quoteAB.value.reserveOutAfter,
            reserveOut: quoteAB.value.reserveInAfter,
            feeBps,
          });
          if (!quoteBA.ok) return true;

          return quoteBA.value.amountOut <= amountIn;
        },
      ),
      { numRuns: 200 },
    );
  });
});
