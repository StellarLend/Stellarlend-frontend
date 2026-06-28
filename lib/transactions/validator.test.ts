import { describe, expect, it } from 'vitest';
import { parseTransactionParams } from './validator';

function parse(query = '') {
  return parseTransactionParams(new URLSearchParams(query));
}

describe('parseTransactionParams', () => {
  it('applies defaults when params are absent', () => {
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

  it('clamps page below 1 to 1', () => {
    expect(parse('page=-3').params.page).toBe(1);
  });

  it('clamps non-numeric page to 1', () => {
    expect(parse('page=abc').params.page).toBe(1);
  });

  it('clamps pageSize below 1 to 1', () => {
    expect(parse('pageSize=0').params.pageSize).toBe(1);
  });

  it('clamps pageSize above 100 to 100', () => {
    expect(parse('pageSize=101').params.pageSize).toBe(100);
  });

  it('passes valid status and asset values without errors', () => {
    expect(parse('status=Completed&asset=XLM')).toMatchObject({
      params: {
        status: 'Completed',
        asset: 'XLM',
      },
      errors: null,
    });
  });

  it('collects an invalid status error', () => {
    expect(parse('status=Pending').errors).toEqual(['Invalid status']);
  });

  it('collects an invalid asset error', () => {
    expect(parse('asset=ETH').errors).toEqual(['Invalid asset']);
  });

  it('collects invalid status and asset errors together in order', () => {
    expect(parse('status=Pending&asset=ETH').errors).toEqual([
      'Invalid status',
      'Invalid asset',
    ]);
  });

  it('passes startDate and endDate through unmodified', () => {
    expect(
      parse('startDate=2026-01-02T03%3A04%3A05.000Z&endDate=2026-02-03').params
    ).toMatchObject({
      startDate: '2026-01-02T03:04:05.000Z',
      endDate: '2026-02-03',
    });
  });
});
