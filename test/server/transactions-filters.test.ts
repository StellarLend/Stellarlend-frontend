import { describe, it, expect } from 'vitest';
import { parseTransactionFilter } from '@/lib/transactions/filters';

function params(obj: Record<string, string>): URLSearchParams {
  return new URLSearchParams(obj);
}

describe('parseTransactionFilter', () => {
  it('returns empty filter for no params', () => {
    const { valid, filter } = parseTransactionFilter(params({}));
    expect(valid).toBe(true);
    expect(filter).toEqual({});
  });

  it('parses valid type param', () => {
    const { valid, filter } = parseTransactionFilter(params({ type: 'lend' }));
    expect(valid).toBe(true);
    expect(filter.type).toBe('lend');
  });

  it('rejects invalid type param', () => {
    const { valid, error } = parseTransactionFilter(params({ type: 'hack' }));
    expect(valid).toBe(false);
    expect(error).toContain('type');
  });

  it('parses valid status param', () => {
    const { valid, filter } = parseTransactionFilter(params({ status: 'completed' }));
    expect(valid).toBe(true);
    expect(filter.status).toBe('completed');
  });

  it('rejects invalid status param', () => {
    const { valid } = parseTransactionFilter(params({ status: 'unknown' }));
    expect(valid).toBe(false);
  });

  it('uppercases and validates asset param', () => {
    const { valid, filter } = parseTransactionFilter(params({ asset: 'usdc' }));
    expect(valid).toBe(true);
    expect(filter.asset).toBe('USDC');
  });

  it('rejects asset with special characters', () => {
    const { valid } = parseTransactionFilter(params({ asset: '../etc' }));
    expect(valid).toBe(false);
  });

  it('parses valid ISO date range', () => {
    const { valid, filter } = parseTransactionFilter(
      params({ fromDate: '2025-01-01', toDate: '2025-12-31' })
    );
    expect(valid).toBe(true);
    expect(filter.fromDate).toBe('2025-01-01');
    expect(filter.toDate).toBe('2025-12-31');
  });

  it('rejects non-ISO date', () => {
    const { valid } = parseTransactionFilter(params({ fromDate: '01/01/2025' }));
    expect(valid).toBe(false);
  });
});
