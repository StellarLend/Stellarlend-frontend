import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/config', () => ({
  default: {
    stellar: {
      sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
      network: 'testnet',
      sorobanContractId: 'GCONTRACTTESTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    },
  },
}));

import { POST } from './route';

describe('POST /api/tx/submit', () => {
  beforeEach(() => {
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
});
