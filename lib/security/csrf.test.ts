import type { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { verifyCsrfToken } from './csrf';

function createRequest(options: {
  authorization?: string;
  cookieToken?: string;
  headerToken?: string;
}) {
  const headers = new Headers();

  if (options.authorization) {
    headers.set('authorization', options.authorization);
  }

  if (options.headerToken) {
    headers.set('x-csrf-token', options.headerToken);
  }

  return {
    headers,
    cookies: {
      get(name: string) {
        if (name !== 'csrf-token' || !options.cookieToken) {
          return undefined;
        }

        return {
          name,
          value: options.cookieToken,
        };
      },
    },
  } as unknown as NextRequest;
}

describe('verifyCsrfToken', () => {
  it('accepts matching cookie and header tokens', () => {
    expect(verifyCsrfToken(createRequest({
      cookieToken: 'abc123',
      headerToken: 'abc123',
    }))).toBe(true);
  });

  it('rejects same-length mismatched tokens', () => {
    expect(verifyCsrfToken(createRequest({
      cookieToken: 'abc123',
      headerToken: 'xyz789',
    }))).toBe(false);
  });

  it('rejects different-length tokens without throwing', () => {
    expect(verifyCsrfToken(createRequest({
      cookieToken: 'short',
      headerToken: 'a-much-longer-token',
    }))).toBe(false);
  });

  it('preserves missing cookie or header rejection behaviour', () => {
    expect(verifyCsrfToken(createRequest({
      cookieToken: 'abc123',
    }))).toBe(false);
    expect(verifyCsrfToken(createRequest({
      headerToken: 'abc123',
    }))).toBe(false);
  });

  it('preserves the bearer authorization bypass', () => {
    expect(verifyCsrfToken(createRequest({
      authorization: 'Bearer api-token',
    }))).toBe(true);
  });
});
