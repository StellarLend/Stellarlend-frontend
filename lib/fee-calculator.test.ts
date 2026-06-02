import { describe, it, expect } from 'vitest';
import { calculateProtocolFee } from './fee-calculator';

describe('fee-calculator', () => {
  it('calculates lend fee correctly', () => {
    const result = calculateProtocolFee('xlm', 'lend', 1000);
    expect(result.feeAmount).toBe(1);
    expect(result.feeBps).toBe(10);
  });

  it('applies minimum fee', () => {
    const result = calculateProtocolFee('xlm', 'lend', 1);
    expect(result.feeAmount).toBe(0.1);
  });

  it('returns 0 fee for 0 amount', () => {
    const result = calculateProtocolFee('xlm', 'borrow', 0);
    expect(result.feeAmount).toBe(0);
  });

  it('throws error for negative amount', () => {
    expect(() => calculateProtocolFee('xlm', 'repay', -100)).toThrow('Amount cannot be negative');
  });

  it('throws error for unknown market', () => {
    expect(() => calculateProtocolFee('unknown', 'lend', 100)).toThrow('Market not found: unknown');
  });

  it('property check: has non-negative fees', () => {
    const amounts = [0, 0.01, 10, 1000, 999999];
    for (const amount of amounts) {
      expect(calculateProtocolFee('xlm', 'borrow', amount).feeAmount).toBeGreaterThanOrEqual(0);
    }
  });

  it('property check: has monotonic fees in size', () => {
    const amounts = [0.1, 10, 100, 1000, 5000, 10000];
    for (let i = 1; i < amounts.length; i++) {
      expect(calculateProtocolFee('usdc', 'repay', amounts[i]).feeAmount).toBeGreaterThanOrEqual(calculateProtocolFee('usdc', 'repay', amounts[i - 1]).feeAmount);
    }
  });
});