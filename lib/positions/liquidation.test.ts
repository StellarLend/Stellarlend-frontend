import { describe, it, expect } from 'vitest';
import {
  computeLiquidationPriceFactor,
  computeHealthFactor,
  computeRiskScore,
  computeLiquidations,
  generateMockPositions,
  SAFE_HEALTH_FACTOR,
} from './liquidation';

describe('computeLiquidationPriceFactor', () => {
  it('returns correct factor for normal inputs', () => {
    const result = computeLiquidationPriceFactor(1000, 2000, 0.75);
    expect(result).toBeCloseTo(0.666667, 4);
  });

  it('returns null when collateralAmount is zero', () => {
    expect(computeLiquidationPriceFactor(1000, 0, 0.75)).toBeNull();
  });

  it('returns null when collateralAmount is negative', () => {
    expect(computeLiquidationPriceFactor(1000, -100, 0.75)).toBeNull();
  });

  it('returns null when collateralFactor is zero', () => {
    expect(computeLiquidationPriceFactor(1000, 2000, 0)).toBeNull();
  });

  it('returns null when collateralFactor is negative', () => {
    expect(computeLiquidationPriceFactor(1000, 2000, -0.1)).toBeNull();
  });

  it('returns zero when borrowedAmount is zero', () => {
    const result = computeLiquidationPriceFactor(0, 2000, 0.75);
    expect(result).toBe(0);
  });

  it('returns factor > 1 when borrowed exceeds effective collateral', () => {
    const result = computeLiquidationPriceFactor(2000, 2000, 0.75);
    expect(result).toBeGreaterThan(1);
  });
});

describe('computeHealthFactor', () => {
  it('returns correct HF for normal inputs', () => {
    const result = computeHealthFactor(5000, 0.75, 1500);
    expect(result).toBeCloseTo(2.5, 4);
  });

  it('returns null when borrowedAmount is zero', () => {
    expect(computeHealthFactor(5000, 0.75, 0)).toBeNull();
  });

  it('returns null when borrowedAmount is negative', () => {
    expect(computeHealthFactor(5000, 0.75, -100)).toBeNull();
  });

  it('returns HF < 1 when position is underwater', () => {
    const result = computeHealthFactor(1000, 0.75, 1000);
    expect(result).toBeLessThan(1);
  });

  it('returns HF === 1 at exact liquidation boundary', () => {
    const result = computeHealthFactor(1000, 0.80, 800);
    expect(result).toBeCloseTo(1, 4);
  });
});

describe('computeRiskScore', () => {
  it('returns 1 when healthFactor <= 1', () => {
    expect(computeRiskScore(1)).toBe(1);
    expect(computeRiskScore(0.5)).toBe(1);
    expect(computeRiskScore(0)).toBe(1);
  });

  it('returns 0 when healthFactor >= SAFE_HEALTH_FACTOR', () => {
    expect(computeRiskScore(SAFE_HEALTH_FACTOR)).toBe(0);
    expect(computeRiskScore(5)).toBe(0);
  });

  it('returns interpolated value for HF between 1 and SAFE_HEALTH_FACTOR', () => {
    const mid = (1 + SAFE_HEALTH_FACTOR) / 2;
    const score = computeRiskScore(mid);
    expect(score).toBeCloseTo(0.5, 4);
  });

  it('returns linear decreasing function', () => {
    const scoreAt15 = computeRiskScore(1.5);
    const scoreAt125 = computeRiskScore(1.25);
    expect(scoreAt125).toBeGreaterThan(scoreAt15);
  });

  it('rounds to 6 decimal places', () => {
    const score = computeRiskScore(1.333333333333);
    expect(score * 1e6).toBe(Math.round(score * 1e6));
  });
});

describe('computeLiquidations', () => {
  it('returns positions sorted by risk score descending', () => {
    const positions = [
      { asset: 'XLM' as const, borrowedAmount: 100, collateralAsset: 'XLM' as const, collateralAmount: 10000 },
      { asset: 'USDC' as const, borrowedAmount: 5000, collateralAsset: 'ETH' as const, collateralAmount: 4000 },
    ];
    const result = computeLiquidations(positions);
    expect(result[0].riskScore).toBeGreaterThanOrEqual(result[1].riskScore);
  });

  it('handles empty input', () => {
    const result = computeLiquidations([]);
    expect(result).toEqual([]);
  });

  it('computes riskScore 1 for immediately liquidatable position', () => {
    const positions = [
      { asset: 'XLM' as const, borrowedAmount: 5000, collateralAsset: 'XLM' as const, collateralAmount: 5000 },
    ];
    const result = computeLiquidations(positions);
    expect(result[0].riskScore).toBe(1);
  });

  it('computes riskScore 0 for very safe position', () => {
    const positions = [
      { asset: 'XLM' as const, borrowedAmount: 100, collateralAsset: 'XLM' as const, collateralAmount: 10000 },
    ];
    const result = computeLiquidations(positions);
    expect(result[0].riskScore).toBe(0);
  });

  it('includes collateralFactor from registry', () => {
    const positions = [
      { asset: 'USDC' as const, borrowedAmount: 1000, collateralAsset: 'USDC' as const, collateralAmount: 5000 },
    ];
    const result = computeLiquidations(positions);
    expect(result[0].collateralFactor).toBe(0.85);
  });

  it('handles position with zero borrowed amount', () => {
    const positions = [
      { asset: 'BTC' as const, borrowedAmount: 0, collateralAsset: 'BTC' as const, collateralAmount: 2000 },
    ];
    const result = computeLiquidations(positions);
    expect(result[0].healthFactor).toBe(Infinity);
    expect(result[0].riskScore).toBe(0);
  });

  it('handles position with zero collateral', () => {
    const positions = [
      { asset: 'XLM' as const, borrowedAmount: 1000, collateralAsset: 'XLM' as const, collateralAmount: 0 },
    ];
    const result = computeLiquidations(positions);
    expect(result[0].liquidationPriceFactor).toBe(0);
    expect(result[0].healthFactor).toBe(0);
    expect(result[0].riskScore).toBe(1);
  });
});

describe('generateMockPositions', () => {
  it('returns array of positions', () => {
    const result = generateMockPositions('GA-test-address');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('each position has required fields', () => {
    const result = generateMockPositions('GA-test-address');
    for (const pos of result) {
      expect(pos).toHaveProperty('asset');
      expect(pos).toHaveProperty('borrowedAmount');
      expect(pos).toHaveProperty('collateralAsset');
      expect(pos).toHaveProperty('collateralAmount');
    }
  });
});
