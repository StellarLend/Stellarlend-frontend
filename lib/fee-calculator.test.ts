import { describe, it, expect } from 'vitest';
import { calculateProtocolFee } from './fee-calculator';
import { getMarket, marketsRegistry } from './registry';
import { ASSET_SYMBOLS } from '@/types/enums';

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
      expect(calculateProtocolFee('usdc', 'repay', amounts[i]).feeAmount).toBeGreaterThanOrEqual(
        calculateProtocolFee('usdc', 'repay', amounts[i - 1]).feeAmount,
      );
    }
  });
});

describe('marketsRegistry covers every ASSET_SYMBOLS entry (#966)', () => {
  it.each([...ASSET_SYMBOLS])('has a market for %s (case-insensitive lookup)', (asset) => {
    const market = getMarket(asset);
    expect(market, `missing marketsRegistry entry for ${asset}`).toBeDefined();
    expect(market!.asset).toBe(asset);
    expect(market!.id).toBe(asset.toLowerCase());
    expect(market!.feeSchedule.lendFeeBps).toBeGreaterThan(0);
    expect(market!.feeSchedule.borrowFeeBps).toBeGreaterThan(0);
    expect(market!.feeSchedule.repayFeeBps).toBeGreaterThan(0);
    expect(market!.feeSchedule.minFeeAmount).toBeGreaterThan(0);
  });

  it('calculateProtocolFee succeeds for every ASSET_SYMBOLS market on lend/borrow/repay', () => {
    for (const asset of ASSET_SYMBOLS) {
      for (const action of ['lend', 'borrow', 'repay'] as const) {
        const result = calculateProtocolFee(asset.toLowerCase(), action, 100);
        expect(result.feeAmount).toBeGreaterThan(0);
        expect(result.marketId).toBe(asset.toLowerCase());
        expect(result.action).toBe(action);
      }
    }
  });

  it('registry keys are exactly the lowercase ASSET_SYMBOLS set', () => {
    const keys = Object.keys(marketsRegistry).sort();
    const expected = ASSET_SYMBOLS.map((a) => a.toLowerCase()).sort();
    expect(keys).toEqual(expected);
  });
});
