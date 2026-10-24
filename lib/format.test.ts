import { describe, expect, it } from 'vitest';
import { formatUnits, formatTokenDisplay, formatPercentFromBps } from './format';

describe('formatUnits', () => {
  it('formats standard 7 decimal values without trailing zeroes', () => {
    expect(formatUnits(10_000_000n, 7)).toBe('1');
    expect(formatUnits(12_345_678n, 7)).toBe('1.2345678');
    expect(formatUnits(100_000n, 7)).toBe('0.01');
  });

  it('handles zero correctly', () => {
    expect(formatUnits(0n, 7)).toBe('0');
  });

  it('handles very large values without precision loss', () => {
    const large = 123_456_789_012_345_678_901_234n;
    expect(formatUnits(large, 7)).toBe('12345678901234567.8901234');
  });

  it('handles negative values', () => {
    expect(formatUnits(-10_000_000n, 7)).toBe('-1');
    expect(formatUnits(-15_000_000n, 7)).toBe('-1.5');
  });
});

describe('formatTokenDisplay', () => {
  it('formats token amounts with comma thousands separators and symbol', () => {
    expect(formatTokenDisplay(10_000_000n, 7, 'XLM')).toBe('1 XLM');
    expect(formatTokenDisplay(1_234_5000000n, 7, 'XLM')).toBe('1,234.5 XLM');
    expect(formatTokenDisplay(1_000_000_0000000n, 7, 'XLM')).toBe('1,000,000 XLM');
  });

  it('formats zero token amounts', () => {
    expect(formatTokenDisplay(0n, 7, 'XLM')).toBe('0 XLM');
  });

  it('formats very large token amounts without Number overflow', () => {
    const huge = 10_000_000_000_0000000n;
    expect(formatTokenDisplay(huge, 7, 'XLM')).toBe('10,000,000,000 XLM');
  });
});

describe('formatPercentFromBps', () => {
  it('formats bps to percentage string', () => {
    expect(formatPercentFromBps(2000)).toBe('20.00%');
    expect(formatPercentFromBps(0)).toBe('0.00%');
    expect(formatPercentFromBps(10000)).toBe('100.00%');
    expect(formatPercentFromBps(50)).toBe('0.50%');
    expect(formatPercentFromBps(2000n)).toBe('20.00%');
  });
});
