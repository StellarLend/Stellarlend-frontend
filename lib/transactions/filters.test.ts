import { describe, expect, it } from 'vitest';
import { parseTransactionFilter, serializeTransactionFilters } from './filters';
import type { FilterValidationResult } from './filters';

function parse(query: string): FilterValidationResult {
  return parseTransactionFilter(new URLSearchParams(query));
}

describe('parseTransactionFilter', () => {
  describe('valid inputs', () => {
    it('returns empty filter for empty params', () => {
      const result = parse('');
      expect(result).toStrictEqual({ valid: true, filter: {} });
    });

    it('ignores unrelated params', () => {
      const result = parse('page=1&sort=date-desc');
      expect(result).toStrictEqual({ valid: true, filter: {} });
    });

    it.each(['lend', 'borrow', 'repay', 'withdraw'])(
      'accepts valid type: %s',
      (type) => {
        const result = parse(`type=${type}`);
        expect(result.valid).toBe(true);
        expect(result.filter.type).toBe(type);
      },
    );

    it.each([
      ['completed', 'Completed'],
      ['pending', 'Processing'],
      ['failed', 'Failed'],
    ])(
      'accepts valid status: %s → %s',
      (input, expected) => {
        const result = parse(`status=${input}`);
        expect(result.valid).toBe(true);
        expect(result.filter.status).toBe(expected);
      },
    );

    it('accepts valid asset and uppercases it', () => {
      const result = parse('asset=btc');
      expect(result.valid).toBe(true);
      expect(result.filter.asset).toBe('BTC');
    });

    it('accepts valid fromDate YYYY-MM-DD', () => {
      const result = parse('fromDate=2026-01-15');
      expect(result.valid).toBe(true);
      expect(result.filter.fromDate).toBe('2026-01-15');
    });

    it('accepts valid fromDate with full ISO datetime', () => {
      const result = parse('fromDate=2026-01-15T12:30:00Z');
      expect(result.valid).toBe(true);
      expect(result.filter.fromDate).toBe('2026-01-15T12:30:00Z');
    });

    it('accepts valid toDate YYYY-MM-DD', () => {
      const result = parse('toDate=2026-02-20');
      expect(result.valid).toBe(true);
      expect(result.filter.toDate).toBe('2026-02-20');
    });

    it('accepts valid toDate with full ISO datetime', () => {
      const result = parse('toDate=2026-02-20T23:59:59Z');
      expect(result.valid).toBe(true);
      expect(result.filter.toDate).toBe('2026-02-20T23:59:59Z');
    });

    it('accepts all valid params together', () => {
      const result = parse(
        'type=lend&status=completed&asset=XLM&fromDate=2026-01-01&toDate=2026-06-30',
      );
      expect(result.valid).toBe(true);
      expect(result.filter).toStrictEqual({
        type: 'lend',
        status: 'Completed',
        asset: 'XLM',
        fromDate: '2026-01-01',
        toDate: '2026-06-30',
      });
    });

    it('round-trips all supported filter fields including search and the All status sentinel', () => {
      const filters = {
        type: 'lend',
        status: 'All' as const,
        asset: 'XLM',
        fromDate: '2026-01-01',
        toDate: '2026-06-30',
        search: 'hello world',
      };

      const result = parseTransactionFilter(serializeTransactionFilters(filters));

      expect(result).toStrictEqual({
        valid: true,
        filter: {
          type: 'lend',
          status: 'All',
          asset: 'XLM',
          fromDate: '2026-01-01',
          toDate: '2026-06-30',
          search: 'hello world',
        },
      });
    });
  });

  describe('invalid inputs', () => {
    it('rejects invalid type', () => {
      const result = parse('type=swap');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid type: swap');
    });

    it('rejects invalid status', () => {
      const result = parse('status=cancelled');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid status: cancelled');
    });

    it('rejects asset longer than 12 characters', () => {
      const result = parse('asset=VERYLONGASSETNAME');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid asset: VERYLONGASSETNAME');
    });

    it('rejects asset with special characters', () => {
      const result = parse('asset=XL_M');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid asset: XL_M');
    });

    it('rejects malformed fromDate', () => {
      const result = parse('fromDate=01-15-2026');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid fromDate: 01-15-2026');
    });

    it('rejects fromDate with only date but trailing content', () => {
      const result = parse('fromDate=2026-01-15Z');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid fromDate: 2026-01-15Z');
    });

    it('rejects malformed toDate', () => {
      const result = parse('toDate=not-a-date');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid toDate: not-a-date');
    });

    it('rejects toDate with partial time', () => {
      const result = parse('toDate=2026-01-15T12:30');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid toDate: 2026-01-15T12:30');
    });

    it('fails fast on first invalid param (type)', () => {
      const result = parse('type=swap&status=completed');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid type: swap');
    });

    it('fails fast on first invalid param (status)', () => {
      const result = parse('type=lend&status=cancelled');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid status: cancelled');
    });

    it('fails fast on first invalid param (asset)', () => {
      const result = parse('type=lend&status=completed&asset=INVALID!');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid asset: INVALID!');
    });

    it('fails fast on first invalid param (fromDate)', () => {
      const result = parse(
        'type=lend&status=completed&asset=XLM&fromDate=bad-date',
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid fromDate: bad-date');
    });

    it('fails fast on first invalid param (toDate)', () => {
      const result = parse(
        'type=lend&status=completed&asset=XLM&fromDate=2026-01-01&toDate=bad-date',
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid toDate: bad-date');
    });

    it('rejects inverted range where fromDate is after toDate', () => {
      const result = parse('fromDate=2026-06-30&toDate=2026-01-01');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/fromDate .* is after toDate/i);
    });

    it('rejects an absurd multi-decade range', () => {
      const result = parse('fromDate=2000-01-01&toDate=2026-01-01');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/span exceeds/i);
    });
  });

  describe('date range edges', () => {
    it('accepts a single-day range (from === to)', () => {
      const result = parse('fromDate=2026-03-15&toDate=2026-03-15');
      expect(result.valid).toBe(true);
      expect(result.filter.fromDate).toBe('2026-03-15');
      expect(result.filter.toDate).toBe('2026-03-15');
    });

    it('accepts only fromDate or only toDate (open range)', () => {
      expect(parse('fromDate=2026-01-01').valid).toBe(true);
      expect(parse('toDate=2026-06-30').valid).toBe(true);
    });

    it('accepts the short from/to query aliases', () => {
      const result = parse('from=2026-01-01&to=2026-02-01');
      expect(result.valid).toBe(true);
      expect(result.filter.fromDate).toBe('2026-01-01');
      expect(result.filter.toDate).toBe('2026-02-01');
    });

    it('compares full ISO datetimes by absolute time', () => {
      const ok = parse(
        'fromDate=2026-01-15T12:00:00Z&toDate=2026-01-15T18:00:00Z',
      );
      expect(ok.valid).toBe(true);

      const inverted = parse(
        'fromDate=2026-01-15T18:00:00Z&toDate=2026-01-15T12:00:00Z',
      );
      expect(inverted.valid).toBe(false);
    });
  });
});
