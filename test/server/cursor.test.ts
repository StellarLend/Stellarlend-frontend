import { describe, expect, it } from 'vitest';
import {
  decodeTransactionCursor,
  encodeTransactionCursor,
  parseCursorLimit,
  parseCursorParams,
} from '@/lib/api/cursor';

describe('transaction cursor helpers', () => {
  it('round-trips an opaque cursor payload', () => {
    const cursor = { v: 1 as const, date: '2025-01-01', id: 'txn-001', direction: 'next' as const };

    const encoded = encodeTransactionCursor(cursor);

    expect(encoded).not.toContain('{');
    expect(decodeTransactionCursor(encoded)).toEqual(cursor);
  });

  it('rejects malformed cursor values', () => {
    expect(() => decodeTransactionCursor('not-json')).toThrow(/base64url-encoded JSON/);

    const unsupported = Buffer.from(
      JSON.stringify({ v: 2, date: '2025-01-01', id: 'txn-001', direction: 'next' }),
      'utf8',
    ).toString('base64url');

    expect(() => decodeTransactionCursor(unsupported)).toThrow(/unsupported/);
  });

  it('parses and caps limit values', () => {
    expect(parseCursorLimit(null)).toBe(6);
    expect(parseCursorLimit('2')).toBe(2);
    expect(parseCursorLimit('500')).toBe(100);
    expect(() => parseCursorLimit('0')).toThrow(/between 1 and 100/);
    expect(() => parseCursorLimit('1.5')).toThrow(/between 1 and 100/);
  });

  it('decodes cursor and limit from URLSearchParams', () => {
    const cursor = encodeTransactionCursor({
      v: 1,
      date: '2025-01-01',
      id: 'txn-001',
      direction: 'prev',
    });
    const params = new URLSearchParams({ cursor, limit: '3' });

    expect(parseCursorParams(params)).toEqual({
      cursor: { v: 1, date: '2025-01-01', id: 'txn-001', direction: 'prev' },
      limit: 3,
    });
  });
});
