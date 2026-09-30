import { describe, expect, it } from "vitest";
import {
  clampUnitInterval,
  deriveRoundedUtilization,
  deriveUtilization,
  roundApr,
  roundUtilization,
  selectBorrowApr,
  selectSupplyApr,
  type MarketRateRow,
} from "./markets";

const sampleMarkets: MarketRateRow[] = [
  {
    asset: "USDC",
    supplyApr: 5.2,
    borrowApr: 7.8,
    utilization: 0.65,
    totalSupply: 10_000_000,
    totalBorrow: 6_500_000,
  },
  {
    asset: "XLM",
    supplyApr: 8.5,
    borrowApr: 12.0,
    utilization: 0.71,
    totalSupply: 2_500_000,
    totalBorrow: 1_775_000,
  },
  {
    asset: "BTC",
    supplyApr: 2.1,
    borrowApr: 4.5,
    utilization: 0.47,
    totalSupply: 500_000,
    totalBorrow: 235_000,
  },
];

describe("lib/lending/markets — clampUnitInterval", () => {
  it("passes through values already in [0, 1]", () => {
    expect(clampUnitInterval(0)).toBe(0);
    expect(clampUnitInterval(0.5)).toBe(0.5);
    expect(clampUnitInterval(1)).toBe(1);
  });

  it("clamps below 0 and above 1", () => {
    expect(clampUnitInterval(-0.01)).toBe(0);
    expect(clampUnitInterval(-100)).toBe(0);
    expect(clampUnitInterval(1.01)).toBe(1);
    expect(clampUnitInterval(2)).toBe(1);
  });

  it("collapses non-finite values to 0", () => {
    expect(clampUnitInterval(Number.NaN)).toBe(0);
    expect(clampUnitInterval(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampUnitInterval(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe("lib/lending/markets — deriveUtilization", () => {
  it("computes totalBorrow / totalSupply for normal pools", () => {
    expect(deriveUtilization(1000, 500)).toBe(0.5);
    expect(deriveUtilization(10_000_000, 6_500_000)).toBe(0.65);
  });

  it("returns 0 for zero supply (empty pool)", () => {
    expect(deriveUtilization(0, 0)).toBe(0);
    expect(deriveUtilization(0, 100)).toBe(0);
  });

  it("returns 0 for zero borrow (single-sided liquidity)", () => {
    expect(deriveUtilization(1_000_000, 0)).toBe(0);
  });

  it("returns 0 for negative supply or borrow (inverted accounting)", () => {
    expect(deriveUtilization(-100, 50)).toBe(0);
    expect(deriveUtilization(100, -50)).toBe(0);
  });

  it("clamps fully-utilised and over-utilised pools to 1", () => {
    expect(deriveUtilization(1000, 1000)).toBe(1);
    // Over-utilised: more borrowed than supplied (lag / rounding in on-chain state).
    expect(deriveUtilization(1000, 1001)).toBe(1);
    expect(deriveUtilization(100, 250)).toBe(1);
  });

  it("returns 0 for non-finite inputs", () => {
    expect(deriveUtilization(Number.NaN, 10)).toBe(0);
    expect(deriveUtilization(10, Number.NaN)).toBe(0);
    expect(deriveUtilization(Number.POSITIVE_INFINITY, 10)).toBe(0);
    expect(deriveUtilization(10, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("handles fractional pools without floating noise outside [0, 1]", () => {
    const util = deriveUtilization(3, 1);
    expect(util).toBeCloseTo(1 / 3, 12);
    expect(util).toBeGreaterThan(0);
    expect(util).toBeLessThan(1);
  });
});

describe("lib/lending/markets — roundApr / roundUtilization", () => {
  it("rounds APR to two decimal places (repository stub contract)", () => {
    expect(roundApr(12.345)).toBe(12.35);
    expect(roundApr(12.344)).toBe(12.34);
    expect(roundApr(0)).toBe(0);
    expect(roundApr(7.8)).toBe(7.8);
  });

  it("uses half-up ties via toFixed for APR midpoints", () => {
    // 1.225 → "1.23" under JS toFixed half-up for this case.
    expect(roundApr(1.225)).toBe(1.23);
  });

  it("collapses non-finite APR to 0", () => {
    expect(roundApr(Number.NaN)).toBe(0);
    expect(roundApr(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("rounds utilization to four decimal places after clamping", () => {
    expect(roundUtilization(0.71234)).toBe(0.7123);
    expect(roundUtilization(0.71235)).toBe(0.7124);
    expect(roundUtilization(1.5)).toBe(1);
    expect(roundUtilization(-0.2)).toBe(0);
  });

  it("deriveRoundedUtilization combines derivation + display precision", () => {
    // 1 / 3 → 0.3333... → 0.3333 at 4 dp
    expect(deriveRoundedUtilization(3, 1)).toBe(0.3333);
    expect(deriveRoundedUtilization(1000, 1001)).toBe(1);
    expect(deriveRoundedUtilization(0, 50)).toBe(0);
  });
});

describe("lib/lending/markets — selectBorrowApr / selectSupplyApr", () => {
  it("returns the borrow APR for a known asset", () => {
    expect(selectBorrowApr(sampleMarkets, "USDC")).toBe(7.8);
    expect(selectBorrowApr(sampleMarkets, "XLM")).toBe(12.0);
  });

  it("returns the supply APR for a known asset", () => {
    expect(selectSupplyApr(sampleMarkets, "USDC")).toBe(5.2);
    expect(selectSupplyApr(sampleMarkets, "BTC")).toBe(2.1);
  });

  it("normalises asset case and surrounding whitespace", () => {
    expect(selectBorrowApr(sampleMarkets, " usdc ")).toBe(7.8);
    expect(selectBorrowApr(sampleMarkets, "xlm")).toBe(12.0);
    expect(selectSupplyApr(sampleMarkets, "Btc")).toBe(2.1);
  });

  it("returns null for unknown, empty, or missing assets", () => {
    expect(selectBorrowApr(sampleMarkets, "FAKE")).toBeNull();
    expect(selectBorrowApr(sampleMarkets, "")).toBeNull();
    expect(selectBorrowApr(sampleMarkets, "   ")).toBeNull();
    expect(selectBorrowApr(sampleMarkets, null)).toBeNull();
    expect(selectBorrowApr(sampleMarkets, undefined)).toBeNull();
    expect(selectSupplyApr(sampleMarkets, "FAKE")).toBeNull();
  });

  it("preserves a zero borrow APR (valid free-rate edge)", () => {
    const markets: MarketRateRow[] = [
      { asset: "USDC", borrowApr: 0, supplyApr: 0 },
    ];
    expect(selectBorrowApr(markets, "USDC")).toBe(0);
    expect(selectSupplyApr(markets, "USDC")).toBe(0);
  });

  it("rejects non-finite APR values", () => {
    const markets: MarketRateRow[] = [
      { asset: "USDC", borrowApr: Number.NaN, supplyApr: Number.POSITIVE_INFINITY },
    ];
    expect(selectBorrowApr(markets, "USDC")).toBeNull();
    expect(selectSupplyApr(markets, "USDC")).toBeNull();
  });

  it("rejects rows whose APR fields are missing or the wrong type", () => {
    const markets = [
      { asset: "USDC", borrowApr: "7.8" as unknown as number },
    ];
    expect(selectBorrowApr(markets, "USDC")).toBeNull();

    const noSupply: MarketRateRow[] = [{ asset: "USDC", borrowApr: 7.8 }];
    expect(selectSupplyApr(noSupply, "USDC")).toBeNull();
  });

  it("keeps borrow APR above supply APR for the sample baseline set", () => {
    // Solvency invariant of the documented baseline markets.
    for (const market of sampleMarkets) {
      const borrow = selectBorrowApr(sampleMarkets, market.asset);
      const supply = selectSupplyApr(sampleMarkets, market.asset);
      expect(borrow).not.toBeNull();
      expect(supply).not.toBeNull();
      expect(borrow!).toBeGreaterThan(supply!);
    }
  });
});

describe("lib/lending/markets — precision stability across the range", () => {
  it.each([
    [1, 0, 0],
    [100, 1, 0.01],
    [100, 50, 0.5],
    [100, 99, 0.99],
    [100, 100, 1],
    [100, 150, 1],
  ] as const)(
    "deriveRoundedUtilization(%i, %i) === %s",
    (supply, borrow, expected) => {
      expect(deriveRoundedUtilization(supply, borrow)).toBe(expected);
    },
  );

  it("round-trip of rounded APR stays fixed under re-rounding", () => {
    const values = [0, 0.01, 1.11, 5.25, 12.99, 99.99];
    for (const v of values) {
      const once = roundApr(v);
      expect(roundApr(once)).toBe(once);
    }
  });
});
