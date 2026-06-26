import { describe, expect, it } from 'vitest';

import { parseTransactionParams } from './validator';

function parse(query = '') {
  return parseTransactionParams(new URLSearchParams(query));
}

describe('parseTransactionParams', () => {
  it('applies defaults when query params are absent', () => {
    expect(parse()).toEqual({
      params: {
        page: 1,
        pageSize: 10,
        sort: 'date-desc',
        status: null,
        asset: null,
        startDate: null,
        endDate: null,
      },
      errors: null,
    });
  });

  it('clamps page below 1 and non-numeric page values to 1', () => {
    expect(parse('page=-3').params.page).toBe(1);
    expect(parse('page=abc').params.page).toBe(1);
    expect(parse('page=2').params.page).toBe(2);
  });

  it('clamps pageSize into the 1..100 range and falls back for non-numeric values', () => {
    expect(parse('pageSize=0').params.pageSize).toBe(1);
    expect(parse('pageSize=101').params.pageSize).toBe(100);
    expect(parse('pageSize=50').params.pageSize).toBe(50);
    expect(parse('pageSize=abc').params.pageSize).toBe(10);
  });

  it('passes valid status and asset values with no errors', () => {
    expect(parse('status=Completed&asset=XLM')).toEqual({
      params: {
        page: 1,
        pageSize: 10,
        sort: 'date-desc',
        status: 'Completed',
        asset: 'XLM',
        startDate: null,
        endDate: null,
      },
      errors: null,
    });
  });

  it('collects exact errors for invalid status and asset values', () => {
    expect(parse('status=Pending&asset=ETH').errors).toEqual([
      'Invalid status',
      'Invalid asset',
    ]);
  });

  it('passes startDate and endDate through unmodified', () => {
    expect(parse('startDate=2026-01-02&endDate=2026-02-03').params).toMatchObject({
      startDate: '2026-01-02',
      endDate: '2026-02-03',
    });
  });
});
