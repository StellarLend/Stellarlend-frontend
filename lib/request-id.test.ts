import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateRequestId,
  normalizeRequestId,
  getOrCreateRequestId,
  REQUEST_ID_HEADER,
} from './request-id';

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ULID_REGEX = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

describe('REQUEST_ID_HEADER', () => {
  it('is x-request-id', () => {
    expect(REQUEST_ID_HEADER).toBe('x-request-id');
  });
});

describe('generateRequestId', () => {
  it('produces a 26-character string', () => {
    expect(generateRequestId()).toHaveLength(26);
  });

  it('matches the ULID pattern', () => {
    expect(generateRequestId()).toMatch(ULID_REGEX);
  });

  it('uses only Crockford base-32 alphabet characters', () => {
    const id = generateRequestId();
    for (const ch of id) {
      expect(CROCKFORD_ALPHABET).toContain(ch);
    }
  });

  it('is uppercase only (no lowercase)', () => {
    const id = generateRequestId();
    expect(id).toBe(id.toUpperCase());
  });

  it('two IDs generated at the same millisecond differ in random suffix', () => {
    const now = 1_700_000_000_000;
    const id1 = generateRequestId(now);
    const id2 = generateRequestId(now);
    // Same time prefix (first 10 chars)
    expect(id1.slice(0, 10)).toBe(id2.slice(0, 10));
    // Different random suffix (statistically guaranteed with 80 random bits)
    expect(id1).not.toBe(id2);
  });

  it('IDs generated at later timestamps have lexicographically greater prefixes', () => {
    const id1 = generateRequestId(1_000_000_000_000);
    const id2 = generateRequestId(1_000_000_000_001);
    expect(id2.slice(0, 10) > id1.slice(0, 10)).toBe(true);
  });

  it('uses the provided timestamp for the time-encoded prefix', () => {
    const t1 = 1_000_000_000_000;
    const t2 = 2_000_000_000_000;
    const prefix1 = generateRequestId(t1).slice(0, 10);
    const prefix2 = generateRequestId(t2).slice(0, 10);
    expect(prefix1).not.toBe(prefix2);
    expect(prefix2 > prefix1).toBe(true);
  });

  it('generates unique IDs across many calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateRequestId()));
    expect(ids.size).toBe(1000);
  });
});

describe('normalizeRequestId', () => {
  const validUlid = generateRequestId();

  it('accepts a valid ULID', () => {
    expect(normalizeRequestId(validUlid)).toBe(validUlid);
  });

  it('accepts a lowercase ULID by uppercasing it', () => {
    const lower = validUlid.toLowerCase();
    expect(normalizeRequestId(lower)).toBe(validUlid);
  });

  it('trims surrounding whitespace before validating', () => {
    expect(normalizeRequestId(`  ${validUlid}  `)).toBe(validUlid);
  });

  it('returns undefined for empty string', () => {
    expect(normalizeRequestId('')).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(normalizeRequestId(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(normalizeRequestId(undefined)).toBeUndefined();
  });

  it('returns undefined when length is too short', () => {
    expect(normalizeRequestId(validUlid.slice(0, 25))).toBeUndefined();
  });

  it('returns undefined when length is too long', () => {
    expect(normalizeRequestId(validUlid + '0')).toBeUndefined();
  });

  it('returns undefined for out-of-alphabet characters (e.g. I, L, O, U)', () => {
    // Replace a character in the random suffix with an invalid one
    const invalid = validUlid.slice(0, 25) + 'I';
    expect(normalizeRequestId(invalid)).toBeUndefined();
  });

  it('returns undefined when the first character exceeds 7 (timestamp overflow)', () => {
    // First char must be 0-7; '8' is invalid per ULID spec
    const overflow = '8' + validUlid.slice(1);
    expect(normalizeRequestId(overflow)).toBeUndefined();
  });
});

describe('getOrCreateRequestId', () => {
  it('returns the incoming request id when the header is a valid ULID', () => {
    const id = generateRequestId();
    const headers = new Headers({ [REQUEST_ID_HEADER]: id });
    const result = getOrCreateRequestId(headers);
    expect(result).toEqual({ requestId: id, wasGenerated: false });
  });

  it('normalizes a lowercase incoming id', () => {
    const id = generateRequestId();
    const headers = new Headers({ [REQUEST_ID_HEADER]: id.toLowerCase() });
    const result = getOrCreateRequestId(headers);
    expect(result).toEqual({ requestId: id, wasGenerated: false });
  });

  it('generates a new id when the header is absent', () => {
    const headers = new Headers();
    const result = getOrCreateRequestId(headers);
    expect(result.wasGenerated).toBe(true);
    expect(result.requestId).toMatch(ULID_REGEX);
  });

  it('generates a new id when the header value is invalid', () => {
    const headers = new Headers({ [REQUEST_ID_HEADER]: 'not-a-ulid' });
    const result = getOrCreateRequestId(headers);
    expect(result.wasGenerated).toBe(true);
    expect(result.requestId).toMatch(ULID_REGEX);
  });
});
