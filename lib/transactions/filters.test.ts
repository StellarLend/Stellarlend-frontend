import { describe, expect, it } from 'vitest';

import { parseTransactionFilter } from './filters';

function parse(query = '') {
  return parseTransactionFilter(new URLSearchParams(query));
}

describe('parseTransactionFilter', () => {
  it('returns an empty valid filter for empty search params', () => {
    expect(parse()).toEqual({
      valid: true,
      filter: {},
    });
  });

  it.each([
    ['lend'],
    ['borrow'],
    ['repay'],
    ['withdraw'],
  ])('accepts valid transaction type %s', (type) => {
    expect(parse(`type=${type}`)).toEqual({
      valid: true,
      filter: { type },
    });
  });

  it.each([
    ['completed'],
    ['pending'],
    ['failed'],
  ])('accepts valid transaction status %s', (status) => {
    expect(parse(`status=${status}`)).toEqual({
      valid: true,
      filter: { status },
    });
  });

  it.each([
    ['type', 'stake', 'Invalid type: stake'],
    ['status', 'processing', 'Invalid status: processing'],
    ['asset', '../etc', 'Invalid asset: ../etc'],
    ['fromDate', '01/01/2025', 'Invalid fromDate: 01/01/2025'],
    ['toDate', '2025-99-99T00:00Z', 'Invalid toDate: 2025-99-99T00:00Z'],
  ])('rejects invalid %s values with a descriptive error', (key, value, error) => {
    expect(parse(`${key}=${encodeURIComponent(value)}`)).toEqual({
      valid: false,
      filter: {},
      error,
    });
  });

  it.each([
    ['fromDate', '2025-01-31'],
    ['toDate', '2025-12-31'],
    ['fromDate', '2025-01-31T10:15:30Z'],
    ['toDate', '2025-12-31T23:59:59Z'],
  ])('accepts %s in supported ISO form %s', (key, value) => {
    expect(parse(`${key}=${encodeURIComponent(value)}`)).toEqual({
      valid: true,
      filter: { [key]: value },
    });
  });

  it('uppercases valid asset values and ignores unrelated params', () => {
    expect(parse('asset=xlm&foo=bar&page=2')).toEqual({
      valid: true,
      filter: { asset: 'XLM' },
    });
  });

  it('returns prior valid filter fields when a later param is invalid', () => {
    expect(parse('type=lend&status=archived')).toEqual({
      valid: false,
      filter: { type: 'lend' },
      error: 'Invalid status: archived',
    });
  });

  it('parses a complete valid filter', () => {
    expect(parse('type=borrow&status=pending&asset=usdc&fromDate=2025-01-01&toDate=2025-01-31T00:00:00Z')).toEqual({
      valid: true,
      filter: {
        asset: 'USDC',
        fromDate: '2025-01-01',
        status: 'pending',
        toDate: '2025-01-31T00:00:00Z',
        type: 'borrow',
      },
    });
  });
});
