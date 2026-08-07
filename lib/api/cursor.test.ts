import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CURSOR_LIMIT,
  MAX_CURSOR_LIMIT,
  decodeTransactionCursor,
  encodeTransactionCursor,
  parseCursorLimit,
  parseCursorParams,
  type TransactionCursor,
} from './cursor';

/**
 * Co-located unit tests for lib/api/cursor.ts (GrantFox #674).
 * Complements the server suite under test/server/cursor.test.ts with
 * extra boundary cases: empty, unicode ids, truncated/tampered payloads.
 */

function b64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

const sample: TransactionCursor = {
  v: 1,
  date: '2025-01-01T00:00:00.000Z',
  id: 'txn-001',
  direction: 'next',
};

describe('lib/api/cursor encode/decode round-trips', () => {
  it('round-trips a standard opaque cursor payload exactly', () => {
    const encoded = encodeTransactionCursor(sample);
    expect(encoded).not.toContain('{');
    expect(encoded).not.toContain('"');
    expect(decodeTransactionCursor(encoded)).toEqual(sample);
  });

  it('round-trips unicode and long-but-valid ids', () => {
    const cursor: TransactionCursor = {
      v: 1,
      date: '2026-08-01',
      id: 'tx-日本語-✨-αβγ',
      direction: 'prev',
    };
    expect(decodeTransactionCursor(encodeTransactionCursor(cursor))).toEqual(cursor);
  });

  it('round-trips max-length id (256 chars)', () => {
    const cursor: TransactionCursor = {
      v: 1,
      date: '2026-01-15',
      id: 'x'.repeat(256),
      direction: 'next',
    };
    expect(decodeTransactionCursor(encodeTransactionCursor(cursor))).toEqual(cursor);
  });

  it('rejects empty id and oversized id on encode', () => {
    expect(() =>
      encodeTransactionCursor({ ...sample, id: '' }),
    ).toThrow(/cursor id is invalid/);
    expect(() =>
      encodeTransactionCursor({ ...sample, id: 'y'.repeat(257) }),
    ).toThrow(/cursor id is invalid/);
  });

  it('rejects invalid direction and date on encode', () => {
    expect(() =>
      encodeTransactionCursor({
        ...sample,
        direction: 'sideways' as TransactionCursor['direction'],
      }),
    ).toThrow(/cursor direction is invalid/);
    expect(() =>
      encodeTransactionCursor({ ...sample, date: 'not-a-date' }),
    ).toThrow(/cursor date is invalid/);
  });
});

describe('lib/api/cursor malformed / tampered / truncated', () => {
  it('rejects empty raw cursor without leaking stack internals', () => {
    expect(() => decodeTransactionCursor('')).toThrow(/cursor must not be empty/);
  });

  it('rejects non-base64 / non-JSON garbage safely', () => {
    expect(() => decodeTransactionCursor('not-json!!!')).toThrow(
      /base64url-encoded JSON/,
    );
    expect(() => decodeTransactionCursor('@@@')).toThrow(/base64url-encoded JSON/);
  });

  it('rejects truncated base64url payloads', () => {
    const full = encodeTransactionCursor(sample);
    const truncated = full.slice(0, Math.max(1, Math.floor(full.length / 3)));
    expect(() => decodeTransactionCursor(truncated)).toThrow();
  });

  it('rejects tampered payloads (wrong version, missing fields)', () => {
    expect(() =>
      decodeTransactionCursor(
        b64urlJson({ v: 2, date: '2025-01-01', id: 'txn-001', direction: 'next' }),
      ),
    ).toThrow(/unsupported/);

    expect(() =>
      decodeTransactionCursor(b64urlJson({ v: 1, id: 'txn-001', direction: 'next' })),
    ).toThrow(/cursor date is invalid/);

    expect(() =>
      decodeTransactionCursor(
        b64urlJson({ v: 1, date: '2025-01-01', id: 'txn-001', direction: 'up' }),
      ),
    ).toThrow(/cursor direction is invalid/);
  });

  it('rejects non-object JSON payloads', () => {
    expect(() => decodeTransactionCursor(b64urlJson('just-a-string'))).toThrow(
      /cursor must be an object/,
    );
    expect(() => decodeTransactionCursor(b64urlJson(null))).toThrow(
      /cursor must be an object/,
    );
    // Arrays are typeof "object" in JS; validation then fails on version.
    expect(() => decodeTransactionCursor(b64urlJson([1, 2, 3]))).toThrow(
      /cursor version is unsupported/,
    );
  });
});

describe('lib/api/cursor parseCursorLimit / parseCursorParams', () => {
  it('defaults, caps, and validates limit', () => {
    expect(parseCursorLimit(null)).toBe(DEFAULT_CURSOR_LIMIT);
    expect(parseCursorLimit('2')).toBe(2);
    expect(parseCursorLimit(String(MAX_CURSOR_LIMIT + 50))).toBe(MAX_CURSOR_LIMIT);
    expect(() => parseCursorLimit('0')).toThrow(/between 1 and/);
    expect(() => parseCursorLimit('1.5')).toThrow(/between 1 and/);
    expect(() => parseCursorLimit('-3')).toThrow(/between 1 and/);
  });

  it('parses cursor + limit from URLSearchParams', () => {
    const encoded = encodeTransactionCursor({
      v: 1,
      date: '2025-06-01',
      id: 'txn-xyz',
      direction: 'prev',
    });
    const params = new URLSearchParams({ cursor: encoded, limit: '3' });
    expect(parseCursorParams(params)).toEqual({
      cursor: { v: 1, date: '2025-06-01', id: 'txn-xyz', direction: 'prev' },
      limit: 3,
    });
  });

  it('returns null cursor when param is absent', () => {
    expect(parseCursorParams(new URLSearchParams())).toEqual({
      cursor: null,
      limit: DEFAULT_CURSOR_LIMIT,
    });
  });
});
