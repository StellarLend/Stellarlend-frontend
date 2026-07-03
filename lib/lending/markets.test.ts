import { describe, expect, it } from "vitest";
import {
  calculateUtilization,
  calculateBorrowRate,
  calculateSupplyRate,
  deriveMarketRates,
  type MarketParams,
} from "@/lib/lending/markets";

describe("calculateUtilization", () => {
  it("returns 0 when supply is 0", () => {
    expect(calculateUtilization(0, 100)).toBe(0);
    expect(calculateUtilization(0, 0)).toBe(0);
  });

  it("returns 0 when borrow is 0", () => {
    expect(calculateUtilization(1000, 0)).toBe(0);
  });

  it("calculates utilization for normal range", () => {
    expect(calculateUtilization(1000, 500)).toBe(0.5);
    expect(calculateUtilization(1000, 250)).toBe(0.25);
    expect(calculateUtilization(1000, 750)).toBe(0.75);
  });

  it("clamps to 1 when over-utilized", () => {
    expect(calculateUtilization(1000, 1200)).toBe(1);
    expect(calculateUtilization(1000, 2000)).toBe(1);
  });

  it("clamps to 0 for negative inputs", () => {
    expect(calculateUtilization(-100, 50)).toBe(0);
    expect(calculateUtilization(100, -50)).toBe(0);
  });

  it("handles very small numbers", () => {
    expect(calculateUtilization(0.001, 0.0005)).toBe(0.5);
  });

  it("handles very large numbers", () => {
    expect(calculateUtilization(1e12, 5e11)).toBe(0.5);
  });
});

describe("calculateBorrowRate", () => {
  it("returns base rate at zero utilization", () => {
    expect(calculateBorrowRate(0, 2, 10)).toBe(2);
  });

  it("returns max rate at full utilization", () => {
    expect(calculateBorrowRate(1, 2, 10)).toBe(12);
  });

  it("calculates linear interpolation", () => {
    expect(calculateBorrowRate(0.5, 2, 10)).toBe(7);
    expect(calculateBorrowRate(0.25, 2, 10)).toBe(4.5);
    expect(calculateBorrowRate(0.75, 2, 10)).toBe(9.5);
  });

  it("clamps utilization to [0, 1]", () => {
    expect(calculateBorrowRate(-0.5, 2, 10)).toBe(2);
    expect(calculateBorrowRate(1.5, 2, 10)).toBe(12);
  });

  it("handles zero base and slope", () => {
    expect(calculateBorrowRate(0.5, 0, 0)).toBe(0);
  });

  it("rounds to 4 decimal places", () => {
    expect(calculateBorrowRate(0.3333, 2, 10)).toBe(5.333);
  });
});

describe("calculateSupplyRate", () => {
  it("returns 0 when borrow rate is 0", () => {
    expect(calculateSupplyRate(0, 0.5, 0.1)).toBe(0);
  });

  it("returns 0 when utilization is 0", () => {
    expect(calculateSupplyRate(10, 0, 0.1)).toBe(0);
  });

  it("calculates supply rate with reserve factor", () => {
    // borrowApr=10, utilization=0.5, reserveFactor=0.1
    // supply = 10 * 0.5 * 0.9 = 4.5
    expect(calculateSupplyRate(10, 0.5, 0.1)).toBe(4.5);
  });

  it("calculates supply rate with no reserve factor", () => {
    // borrowApr=12, utilization=0.7, reserveFactor=0
    // supply = 12 * 0.7 * 1 = 8.4
    expect(calculateSupplyRate(12, 0.7, 0)).toBe(8.4);
  });

  it("clamps reserve factor to [0, 1]", () => {
    expect(calculateSupplyRate(10, 0.5, -0.5)).toBe(5);
    expect(calculateSupplyRate(10, 0.5, 1.5)).toBe(0);
  });

  it("clamps negative inputs to valid ranges", () => {
    // Negative borrow rate clamped to 0
    expect(calculateSupplyRate(-10, 0.5, 0.1)).toBe(0);
    // Negative utilization clamped to 0
    expect(calculateSupplyRate(10, -0.5, 0.1)).toBe(0);
    // Negative reserve factor clamped to 0 (no protocol fee)
    expect(calculateSupplyRate(10, 0.5, -0.1)).toBe(5);
  });

  it("handles fully utilized market", () => {
    // borrowApr=12, utilization=1, reserveFactor=0.1
    // supply = 12 * 1 * 0.9 = 10.8
    expect(calculateSupplyRate(12, 1, 0.1)).toBe(10.8);
  });

  it("rounds to 4 decimal places", () => {
    expect(calculateSupplyRate(10, 0.3333, 0.1)).toBeCloseTo(2.9997, 4);
  });
});

describe("deriveMarketRates", () => {
  const baseParams: MarketParams = {
    totalSupply: 1_000_000,
    totalBorrow: 650_000,
    baseRate: 2,
    rateSlope: 10,
    reserveFactor: 0.1,
  };

  it("derives rates for a typical market", () => {
    const rates = deriveMarketRates(baseParams);

    expect(rates.utilization).toBe(0.65);
    expect(rates.borrowApr).toBe(8.5); // 2 + 0.65 * 10
    expect(rates.supplyApr).toBeCloseTo(4.9725, 4); // 8.5 * 0.65 * 0.9
  });

  it("handles empty market (zero supply)", () => {
    const rates = deriveMarketRates({
      ...baseParams,
      totalSupply: 0,
      totalBorrow: 0,
    });

    expect(rates.utilization).toBe(0);
    expect(rates.borrowApr).toBe(2);
    expect(rates.supplyApr).toBe(0);
  });

  it("handles single-sided liquidity (supply only)", () => {
    const rates = deriveMarketRates({
      ...baseParams,
      totalBorrow: 0,
    });

    expect(rates.utilization).toBe(0);
    expect(rates.borrowApr).toBe(2);
    expect(rates.supplyApr).toBe(0);
  });

  it("handles fully utilized market", () => {
    const rates = deriveMarketRates({
      ...baseParams,
      totalSupply: 1_000_000,
      totalBorrow: 1_000_000,
    });

    expect(rates.utilization).toBe(1);
    expect(rates.borrowApr).toBe(12);
    expect(rates.supplyApr).toBeCloseTo(10.8, 4);
  });

  it("clamps over-utilized market", () => {
    const rates = deriveMarketRates({
      ...baseParams,
      totalSupply: 1_000_000,
      totalBorrow: 1_500_000,
    });

    expect(rates.utilization).toBe(1);
    expect(rates.borrowApr).toBe(12);
    expect(rates.supplyApr).toBeCloseTo(10.8, 4);
  });

  it("handles zero base rate and slope", () => {
    const rates = deriveMarketRates({
      ...baseParams,
      baseRate: 0,
      rateSlope: 0,
    });

    expect(rates.borrowApr).toBe(0);
    expect(rates.supplyApr).toBe(0);
  });

  it("handles high reserve factor", () => {
    const rates = deriveMarketRates({
      ...baseParams,
      reserveFactor: 1,
    });

    expect(rates.supplyApr).toBe(0);
  });

  it("handles rounding ties consistently", () => {
    // Force a case where rounding matters
    const rates = deriveMarketRates({
      totalSupply: 3,
      totalBorrow: 1,
      baseRate: 1,
      rateSlope: 3,
      reserveFactor: 0.3333,
    });

    expect(rates.utilization).toBeCloseTo(0.3333, 4);
    expect(rates.borrowApr).toBeCloseTo(2, 4);
    expect(rates.supplyApr).toBeCloseTo(0.4445, 4);
  });
});
