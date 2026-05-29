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

describe('POST /api/tx/build', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 for invalid request body', async () => {
    const response = await POST(
      new Request('http://localhost/api/tx/build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ foo: 'bar' }),
      }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe('INVALID_INPUT');
  });

  it('returns unsignedXdr when RPC build succeeds', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ result: { transaction: 'unsigned-xdr' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    vi.stubGlobal('fetch', mockFetch);

    const response = await POST(
      new Request('http://localhost/api/tx/build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'lend',
          sourceAccount: `G${'A'.repeat(55)}`,
          data: { asset: 'XLM', amount: 1000, interestRate: 5, duration: 30 },
        }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ unsignedXdr: 'unsigned-xdr' });
  });

  it('maps upstream RPC errors to a 502 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 400, message: 'invalid request' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    vi.stubGlobal('fetch', mockFetch);

    const response = await POST(
      new Request('http://localhost/api/tx/build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'lend',
          sourceAccount: `G${'A'.repeat(55)}`,
          data: { asset: 'XLM', amount: 1000, interestRate: 5, duration: 30 },
        }),
      }),
    );

    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json.error.code).toBe(400);
  });
});
