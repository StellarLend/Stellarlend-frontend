import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  generateRequestId,
  getOrCreateRequestId,
  normalizeRequestId,
  REQUEST_ID_HEADER,
} from './request-id';

const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
const CROCKFORD_ALPHABET_PATTERN = /^[0-9A-HJKMNP-TV-Z]+$/;
const KNOWN_GOOD_ULID = '01HZ0000000000000000000000';

function mockRandomValues(...fills: number[]) {
  let callIndex = 0;

  return vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
    const fill = fills[Math.min(callIndex, fills.length - 1)];
    callIndex += 1;
    (array as Uint8Array).fill(fill);
    return array;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('request id helpers', () => {
  it('exports the request id header name used by request-context middleware', () => {
    expect(REQUEST_ID_HEADER).toBe('x-request-id');
  });

  it('generates uppercase 26-character ULIDs using the Crockford alphabet', () => {
    mockRandomValues(0);

    const requestId = generateRequestId(0);

    expect(requestId).toHaveLength(26);
    expect(requestId).toMatch(ULID_PATTERN);
    expect(requestId).toMatch(CROCKFORD_ALPHABET_PATTERN);
  });

  it('keeps the time prefix monotonic-friendly across increasing timestamps', () => {
    mockRandomValues(0);

    const first = generateRequestId(0);
    const second = generateRequestId(1);
    const later = generateRequestId(32);

    expect(first.slice(0, 10)).toBe('0000000000');
    expect(second.slice(0, 10)).toBe('0000000001');
    expect(later.slice(0, 10)).toBe('0000000010');
    expect(first.slice(0, 10) < second.slice(0, 10)).toBe(true);
    expect(second.slice(0, 10) < later.slice(0, 10)).toBe(true);
  });

  it('generates distinct random suffixes for two IDs created in the same millisecond', () => {
    mockRandomValues(0, 255);

    const first = generateRequestId(1_700_000_000_000);
    const second = generateRequestId(1_700_000_000_000);

    expect(first.slice(0, 10)).toBe(second.slice(0, 10));
    expect(first.slice(10)).not.toBe(second.slice(10));
    expect(first).not.toBe(second);
  });

  it('accepts a known-good ULID and trims surrounding whitespace', () => {
    expect(normalizeRequestId(KNOWN_GOOD_ULID)).toBe(KNOWN_GOOD_ULID);
    expect(normalizeRequestId(`  ${KNOWN_GOOD_ULID}  `)).toBe(KNOWN_GOOD_ULID);
  });

  it('rejects malformed request IDs', () => {
    expect(normalizeRequestId(undefined)).toBeUndefined();
    expect(normalizeRequestId(null)).toBeUndefined();
    expect(normalizeRequestId('')).toBeUndefined();
    expect(normalizeRequestId(KNOWN_GOOD_ULID.slice(1))).toBeUndefined();
    expect(normalizeRequestId(`${KNOWN_GOOD_ULID}0`)).toBeUndefined();
    expect(normalizeRequestId(KNOWN_GOOD_ULID.toLowerCase())).toBeUndefined();
    expect(normalizeRequestId('01HZ000000000000000000000I')).toBeUndefined();
    expect(normalizeRequestId('81HZ0000000000000000000000')).toBeUndefined();
  });

  it('reuses a valid x-request-id header', () => {
    const headers = new Headers({ [REQUEST_ID_HEADER]: KNOWN_GOOD_ULID });

    expect(getOrCreateRequestId(headers)).toEqual({
      requestId: KNOWN_GOOD_ULID,
      wasGenerated: false,
    });
  });

  it('generates a fresh ULID when the x-request-id header is missing or invalid', () => {
    mockRandomValues(0);

    const missing = getOrCreateRequestId(new Headers());
    const invalid = getOrCreateRequestId(new Headers({ [REQUEST_ID_HEADER]: KNOWN_GOOD_ULID.toLowerCase() }));

    expect(missing.wasGenerated).toBe(true);
    expect(missing.requestId).toMatch(ULID_PATTERN);
    expect(invalid.wasGenerated).toBe(true);
    expect(invalid.requestId).toMatch(ULID_PATTERN);
  });
});
