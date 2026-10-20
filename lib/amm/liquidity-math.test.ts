import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  calculateBurnAmounts,
  calculateMintShares,
  integerSqrt,
  MINIMUM_LIQUIDITY,
  proportionalAmount,
} from "./liquidity-math";

describe("calculateMintShares contract fixtures", () => {
  it.each([
    [0n, 10_000n, 10_000n, 0n, 0n, 9_000n, 1_000n],
    [0n, 100n, 10n, 0n, 0n, null, null],
    [10_000n, 2_000n, 2_000n, 10_000n, 10_000n, 2_000n, 0n],
    [0n, 1_001n, 1_001n, 0n, 0n, 1n, 1_000n],
    [1_001n, 500_000n, 500_000n, 1_001_001n, 1_001_001n, 499n, 0n],
  ])("matches contract mint fixture", (supply, a, b, reserveA, reserveB, shares, locked) => {
    const result = calculateMintShares(supply, a, b, reserveA, reserveB);
    if (shares === null) expect(result).toEqual({ ok: false, error: "InsufficientLiquidityMinted" });
    else expect(result).toEqual({ ok: true, value: { shares, lockedShares: locked } });
  });

  it("rejects a dust deposit that mints zero", () => {
    expect(calculateMintShares(10_000n, 0n, 10_000n, 10_000n, 10_000n)).toEqual({
      ok: false,
      error: "InsufficientLiquidityMinted",
    });
  });

  it("rejects subsequent deposits with zero reserves", () => {
    expect(calculateMintShares(10_000n, 2_000n, 2_000n, 0n, 10_000n)).toEqual({ ok: false, error: "ZeroReserve" });
    expect(calculateMintShares(10_000n, 2_000n, 2_000n, 10_000n, 0n)).toEqual({ ok: false, error: "ZeroReserve" });
    expect(calculateMintShares(10_000n, 2_000n, 2_000n, 0n, 0n)).toEqual({ ok: false, error: "ZeroReserve" });
  });

  it("locks MINIMUM_LIQUIDITY on a first deposit", () => {
    expect(calculateMintShares(0n, 10_000n, 10_000n, 0n, 0n)).toEqual({
      ok: true,
      value: { shares: 9_000n, lockedShares: MINIMUM_LIQUIDITY },
    });
  });
});

describe("calculateBurnAmounts contract fixtures", () => {
  it.each([
    [500n, 2_000n, 1_000n, 4_000n, 250n, 1_000n],
    [2_000n, 2_000n, 1_000n, 4_000n, 1_000n, 4_000n],
    [1n, 3n, 1_000n, 1_000n, 333n, 333n],
    [500n, 2_000n, 0n, 4_000n, 0n, 1_000n],
    [2_000n, 2_000n, 5_000n, 7_000n, 5_000n, 7_000n],
    [25n, 100n, 333n, 777n, 83n, 194n],
    [1n, 10n, 100n, 1_000n, 10n, 100n],
    [75n, 300n, 999n, 3_001n, 249n, 750n],
    [50n, 200n, 101n, 503n, 25n, 125n],
    [5n, 17n, 1_000n, 2_000n, 294n, 588n],
  ])("matches contract burn fixture", (shares, supply, a, b, amountA, amountB) => {
    expect(calculateBurnAmounts(shares, supply, a, b)).toEqual({
      ok: true,
      value: { amountA, amountB },
    });
  });

  it("rejects zero shares, zero supply, and over-burn", () => {
    expect(calculateBurnAmounts(0n, 2_000n, 1_000n, 4_000n)).toEqual({ ok: false, error: "InvalidBurnAmount" });
    expect(calculateBurnAmounts(100n, 0n, 1_000n, 4_000n)).toEqual({ ok: false, error: "ZeroSupply" });
    expect(calculateBurnAmounts(2_001n, 2_000n, 1_000n, 4_000n)).toEqual({ ok: false, error: "BurnExceedsSupply" });
  });

  it("detects i128 multiplication overflow", () => {
    const max = (1n << 127n) - 1n;
    expect(calculateBurnAmounts(max, max, max, 0n)).toEqual({ ok: false, error: "Overflow" });
  });
});

describe("integer square root and ratio helper", () => {
  it("matches the contract integer square root floor", () => {
    expect(integerSqrt(24n)).toEqual({ ok: true, value: 4n });
    expect(integerSqrt(-1n)).toEqual({ ok: false, error: "Overflow" });
  });

  it("rounds a matching amount up so it does not underfund the pool ratio", () => {
    expect(proportionalAmount(1n, 3n, 10n)).toBe(4n);
    expect(proportionalAmount(0n, 3n, 10n)).toBeNull();
  });

  it("add then remove never returns more than the deposit", () => {
    fc.assert(fc.property(
      fc.bigInt({ min: 1_000n, max: 10_000_000n }),
      fc.bigInt({ min: 1_000n, max: 10_000_000n }),
      (depositA, depositB) => {
        const initialReserve = 100_000_000n;
        const initialSupply = 100_000_000n;
        const minted = calculateMintShares(initialSupply, depositA, depositB, initialReserve, initialReserve);
        if (!minted.ok) return true;
        const burned = calculateBurnAmounts(
          minted.value.shares,
          initialSupply + minted.value.shares,
          initialReserve + depositA,
          initialReserve + depositB,
        );
        return burned.ok && burned.value.amountA <= depositA && burned.value.amountB <= depositB;
      },
    ), { numRuns: 200 });
  });
});
