import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/config', () => ({
  default: {
    stellar: {
      network: 'testnet',
      sorobanContractId: 'GCONTRACTTESTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    },
    rateLimit: {
      account: {
        limit: 2,
        windowMs: 60000,
        burst: 2,
      },
    },
  },
}));

vi.mock('@/lib/server-config', () => ({
  default: {
    stellar: {
      sorobanRpcUrl: 'https://private-rpc.test',
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

import { getSession } from '@/lib/auth';
import { clearAccountBucketCache } from '@/lib/rate-limit/account-bucket';
import { POST } from './route';

describe('POST /api/tx/submit', () => {
  const getSessionMock = getSession as Mock;

  beforeEach(() => {
    clearAccountBucketCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 for invalid request body', async () => {
    const response = await POST(
      new Request('http://localhost/api/tx/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ foo: 'bar' }),
      }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe('INVALID_INPUT');
  });

  it('returns hash when RPC submission succeeds', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ result: { hash: 'tx-hash-123' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    vi.stubGlobal('fetch', mockFetch);

    const response = await POST(
      new Request('http://localhost/api/tx/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signedEnvelopeXdr: 'signed-envelope-xdr' }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ status: 'submitted', hash: 'tx-hash-123' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://private-rpc.test',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('maps upstream RPC errors to a 502 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 500, message: 'upstream failure' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    vi.stubGlobal('fetch', mockFetch);

    const response = await POST(
      new Request('http://localhost/api/tx/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signedEnvelopeXdr: 'signed-envelope-xdr' }),
      }),
    );

    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json.error.code).toBe(500);
  });

  it('returns 429 when the authenticated wallet exceeds account rate limit', async () => {
    getSessionMock.mockResolvedValue({ user: { walletAddress: 'GABC123' } });
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ result: { hash: 'tx-hash-123' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    vi.stubGlobal('fetch', mockFetch);

    await POST(
      new Request('http://localhost/api/tx/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signedEnvelopeXdr: 'signed-envelope-xdr' }),
      }),
    );

    await POST(
      new Request('http://localhost/api/tx/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signedEnvelopeXdr: 'signed-envelope-xdr' }),
      }),
    );

    const response = await POST(
      new Request('http://localhost/api/tx/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signedEnvelopeXdr: 'signed-envelope-xdr' }),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('2');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('Retry-After')).toBeTruthy();

    const json = await response.json();
    expect(json.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(json.error.retryAfter).toBeGreaterThan(0);
  });
});
