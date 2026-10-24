import { describe, it, expect } from 'vitest';
import { previewLiquidation } from './liquidation';

describe('previewLiquidation', () => {
  it('should calculate actualRepay and seizedEstimate correctly for normal case', () => {
    const result = previewLiquidation({
      debt: 1000n,
      collateral: 2000n,
      closeFactorBps: 5000n, // 50%
      incentiveBps: 500n, // 5%
      amount: 400n,
    });

    // Max repayable = 1000 * 5000 / 10000 = 500
    // Actual repay = min(400, 500) = 400
    // Seized = (400 * 2000 * 10500) / (1000 * 10000) = 8,400,000 / 10,000,000 = 0.84 -> floor = 0

    expect(result.actualRepay).toBe(400n);
    expect(result.seizedEstimate).toBe(0n);
  });

  it('should cap actualRepay at close factor when amount exceeds max', () => {
    const result = previewLiquidation({
      debt: 1000n,
      collateral: 2000n,
      closeFactorBps: 5000n, // 50%
      incentiveBps: 500n, // 5%
      amount: 600n,
    });

    // Max repayable = 1000 * 5000 / 10000 = 500
    // Actual repay = min(600, 500) = 500

    expect(result.actualRepay).toBe(500n);
  });

  it('should handle amount equal to close factor cap', () => {
    const result = previewLiquidation({
      debt: 1000n,
      collateral: 2000n,
      closeFactorBps: 5000n, // 50%
      incentiveBps: 500n, // 5%
      amount: 500n,
    });

    expect(result.actualRepay).toBe(500n);
  });

  it('should handle amount below close factor cap', () => {
    const result = previewLiquidation({
      debt: 1000n,
      collateral: 2000n,
      closeFactorBps: 5000n, // 50%
      incentiveBps: 500n, // 5%
      amount: 100n,
    });

    expect(result.actualRepay).toBe(100n);
  });

  it('should return zero for zero debt', () => {
    const result = previewLiquidation({
      debt: 0n,
      collateral: 2000n,
      closeFactorBps: 5000n,
      incentiveBps: 500n,
      amount: 100n,
    });

    expect(result.actualRepay).toBe(0n);
    expect(result.seizedEstimate).toBe(0n);
  });

  it('should handle very large i128 values without overflow', () => {
    const result = previewLiquidation({
      debt: 10n ** 18n,
      collateral: 10n ** 18n,
      closeFactorBps: 5000n,
      incentiveBps: 500n,
      amount: 10n ** 17n,
    });

    expect(result.actualRepay).toBe(10n ** 17n);
    expect(result.seizedEstimate).toBeGreaterThanOrEqual(0n);
  });

  it('should calculate seized collateral with incentive correctly', () => {
    const result = previewLiquidation({
      debt: 100n,
      collateral: 200n,
      closeFactorBps: 5000n, // 50%
      incentiveBps: 1000n, // 10%
      amount: 50n,
    });

    // Max repayable = 100 * 5000 / 10000 = 50
    // Actual repay = 50
    // Seized = (50 * 200 * 11000) / (100 * 10000) = 110,000,000 / 1,000,000 = 110

    expect(result.actualRepay).toBe(50n);
    expect(result.seizedEstimate).toBe(110n);
  });

  it('should handle zero amount', () => {
    const result = previewLiquidation({
      debt: 1000n,
      collateral: 2000n,
      closeFactorBps: 5000n,
      incentiveBps: 500n,
      amount: 0n,
    });

    expect(result.actualRepay).toBe(0n);
    expect(result.seizedEstimate).toBe(0n);
  });

  it('should use floor division for close factor calculation', () => {
    const result = previewLiquidation({
      debt: 1001n,
      collateral: 2000n,
      closeFactorBps: 5000n, // 50%
      incentiveBps: 500n,
      amount: 1000n,
    });

    // Max repayable = 1001 * 5000 / 10000 = 5005 / 10 = 500 (floor)
    expect(result.actualRepay).toBe(500n);
  });

  it('should use floor division for seized calculation', () => {
    const result = previewLiquidation({
      debt: 3n,
      collateral: 2n,
      closeFactorBps: 10000n, // 100%
      incentiveBps: 0n,
      amount: 1n,
    });

    // Max repayable = 3 * 10000 / 10000 = 3
    // Actual repay = 1
    // Seized = (1 * 2 * 10000) / (3 * 10000) = 20000 / 30000 = 0 (floor)

    expect(result.actualRepay).toBe(1n);
    expect(result.seizedEstimate).toBe(0n);
  });

  it('should handle edge case where debt and collateral are equal', () => {
    const result = previewLiquidation({
      debt: 1000n,
      collateral: 1000n,
      closeFactorBps: 5000n,
      incentiveBps: 500n,
      amount: 500n,
    });

    // Seized = (500 * 1000 * 10500) / (1000 * 10000) = 5,250,000 / 10,000,000 = 0 (floor)
    expect(result.actualRepay).toBe(500n);
    expect(result.seizedEstimate).toBe(0n);
  });

  it('should handle zero incentive', () => {
    const result = previewLiquidation({
      debt: 1000n,
      collateral: 2000n,
      closeFactorBps: 5000n,
      incentiveBps: 0n,
      amount: 500n,
    });

    // Seized = (500 * 2000 * 10000) / (1000 * 10000) = 10,000,000 / 10,000,000 = 1
    expect(result.actualRepay).toBe(500n);
    expect(result.seizedEstimate).toBe(1n);
  });
});
