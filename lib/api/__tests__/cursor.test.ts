import {
  DEFAULT_CURSOR_LIMIT,
  MAX_CURSOR_LIMIT,
  encodeTransactionCursor,
  decodeTransactionCursor,
  parseCursorLimit,
  parseCursorParams,
  type TransactionCursor,
} from '../cursor';

const baseCursor: TransactionCursor = {
  v: 1,
  date: '2026-01-15T12:00:00.000Z',
  id: 'tx-abc-123',
  direction: 'next',
};

describe('encodeTransactionCursor / decodeTransactionCursor', () => {
  it('round-trips a valid cursor', () => {
    const encoded = encodeTransactionCursor(baseCursor);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
    expect(decodeTransactionCursor(encoded)).toEqual(baseCursor);
  });

  it('produces URL-safe base64 (no +, /, or =)', () => {
    const encoded = encodeTransactionCursor(baseCursor);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('decodes prev direction', () => {
    const prevCursor: TransactionCursor = { ...baseCursor, direction: 'prev' };
    const encoded = encodeTransactionCursor(prevCursor);
    expect(decodeTransactionCursor(encoded).direction).toBe('prev');
  });
});

describe('decodeTransactionCursor errors', () => {
  it('throws on empty string', () => {
    expect(() => decodeTransactionCursor('')).toThrow('cursor must not be empty');
  });

  it('throws on non-base64 garbage', () => {
    expect(() => decodeTransactionCursor('not-base64-!@#')).toThrow();
  });

  it('throws on valid base64 but non-JSON content', () => {
    // "hello" -> base64url
    const notJson = Buffer.from('hello', 'utf8').toString('base64url');
    expect(() => decodeTransactionCursor(notJson)).toThrow(/base64url-encoded JSON/);
  });

  it('throws when the JSON is missing the version field', () => {
    const wrongShape = Buffer.from(JSON.stringify({ date: '2026-01-01', id: 'x', direction: 'next' }), 'utf8').toString('base64url');
    expect(() => decodeTransactionCursor(wrongShape)).toThrow(/version is unsupported/);
  });

  it('throws when the date is invalid', () => {
    const bad = Buffer.from(JSON.stringify({ v: 1, date: 'not-a-date', id: 'x', direction: 'next' }), 'utf8').toString('base64url');
    expect(() => decodeTransactionCursor(bad)).toThrow(/date is invalid/);
  });

  it('throws when the id is empty', () => {
    const bad = Buffer.from(JSON.stringify({ v: 1, date: '2026-01-01', id: '', direction: 'next' }), 'utf8').toString('base64url');
    expect(() => decodeTransactionCursor(bad)).toThrow(/id is invalid/);
  });

  it('throws when the id is too long', () => {
    const bad = Buffer.from(JSON.stringify({ v: 1, date: '2026-01-01', id: 'a'.repeat(257), direction: 'next' }), 'utf8').toString('base64url');
    expect(() => decodeTransactionCursor(bad)).toThrow(/id is invalid/);
  });

  it('throws when the direction is not next/prev', () => {
    const bad = Buffer.from(JSON.stringify({ v: 1, date: '2026-01-01', id: 'x', direction: 'sideways' }), 'utf8').toString('base64url');
    expect(() => decodeTransactionCursor(bad)).toThrow(/direction is invalid/);
  });
});

describe('parseCursorLimit', () => {
  it('returns the default when null', () => {
    expect(parseCursorLimit(null)).toBe(DEFAULT_CURSOR_LIMIT);
  });

  it('parses a valid integer', () => {
    expect(parseCursorLimit('25')).toBe(25);
  });

  it('caps at MAX_CURSOR_LIMIT', () => {
    expect(parseCursorLimit('9999')).toBe(MAX_CURSOR_LIMIT);
  });

  it('throws on zero', () => {
    expect(() => parseCursorLimit('0')).toThrow(/between 1 and/);
  });

  it('throws on negative', () => {
    expect(() => parseCursorLimit('-1')).toThrow(/between 1 and/);
  });

  it('throws on non-integer', () => {
    expect(() => parseCursorLimit('3.5')).toThrow(/between 1 and/);
  });

  it('throws on non-numeric', () => {
    expect(() => parseCursorLimit('abc')).toThrow(/between 1 and/);
  });
});

describe('parseCursorParams', () => {
  it('returns null cursor and default limit when neither is present', () => {
    const result = parseCursorParams(new URLSearchParams(''));
    expect(result.cursor).toBeNull();
    expect(result.limit).toBe(DEFAULT_CURSOR_LIMIT);
  });

  it('parses a valid cursor and limit', () => {
    const encoded = encodeTransactionCursor(baseCursor);
    const result = parseCursorParams(new URLSearchParams(`cursor=${encoded}&limit=10`));
    expect(result.cursor).toEqual(baseCursor);
    expect(result.limit).toBe(10);
  });

  it('forwards a bad cursor error', () => {
    expect(() => parseCursorParams(new URLSearchParams('cursor=garbage'))).toThrow();
  });
});
