import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import simulateRestoreRequiredFixture from '@/lib/soroban/__fixtures__/simulate-restore-required.json';
import simulateSuccessFixture from '@/lib/soroban/__fixtures__/simulate-success.json';

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

describe('POST /api/tx/build', () => {
  const getSessionMock = getSession as Mock;
  const validSourceAccount = `G${'A'.repeat(55)}`;
  const validLendBody = {
    type: 'lend',
    sourceAccount: validSourceAccount,
    data: { asset: 'XLM', amount: 1000, interestRate: 5, duration: 30 },
  };
  const simulationResult = {
    transactionDataXdr: 'AAAAAgAAAAE=',
    minResourceFee: '3210',
    footprint: {
      readOnly: ['AAAAAQ=='],
      readWrite: ['AAAAAg=='],
    },
    auth: ['AAAAAw==', 'AAAABA=='],
  };

  const buildRequest = (body: unknown) =>
    new Request('http://localhost/api/tx/build', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

  const readFetchJsonBody = (mockFetch: Mock, callIndex: number) => {
    const options = mockFetch.mock.calls[callIndex][1] as RequestInit;
    return JSON.parse(String(options.body));
  };

  beforeEach(() => {
    clearAccountBucketCache();
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

  it('returns 400 for malformed JSON', async () => {
    const response = await POST(buildRequest('{'));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({
      error: { code: 'INVALID_INPUT', message: 'Invalid request body.' },
    });
  });

  it('returns unsignedXdr when RPC build succeeds', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: { transaction: 'unsigned-xdr' } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(simulateSuccessFixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    vi.stubGlobal('fetch', mockFetch);

    const response = await POST(buildRequest(validLendBody));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ unsignedXdr: 'unsigned-xdr', simulation: simulationResult });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://private-rpc.test',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('assembles the borrow transaction envelope and simulation request', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: { transaction_xdr: 'borrow-xdr' } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(simulateSuccessFixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    vi.stubGlobal('fetch', mockFetch);

    const response = await POST(
      buildRequest({
        type: 'borrow',
        sourceAccount: validSourceAccount,
        data: {
          asset: 'USDC',
          amount: 250,
          interestRate: 7.5,
          duration: 90,
          collateral: 'XLM',
          collateralAmount: 1000,
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      unsignedXdr: 'borrow-xdr',
      simulation: simulationResult,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(readFetchJsonBody(mockFetch, 0)).toEqual({
      jsonrpc: '2.0',
      id: 'build_soroban_transaction',
      method: 'build_soroban_transaction',
      params: [
        {
          source: validSourceAccount,
          network_passphrase: 'Test SDF Network ; September 2015',
          fee: 100,
          instructions: [
            {
              type: 'invoke_host_function',
              function: 'borrow',
              contract_id: 'GCONTRACTTESTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
              args: [
                { type: 'string', value: 'USDC' },
                { type: 'u64', value: '250' },
                { type: 'string', value: '7.5' },
                { type: 'u32', value: '90' },
                { type: 'string', value: 'XLM' },
                { type: 'u64', value: '1000' },
              ],
              footprint: {
                read_only: [],
                read_write: [],
              },
            },
          ],
        },
      ],
    });
    expect(readFetchJsonBody(mockFetch, 1)).toEqual({
      jsonrpc: '2.0',
      id: 'simulate_transaction',
      method: 'simulateTransaction',
      params: [{ transaction: 'borrow-xdr' }],
    });
  });

  it('maps upstream RPC errors to a 502 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 400, message: 'invalid request' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    vi.stubGlobal('fetch', mockFetch);

    const response = await POST(buildRequest(validLendBody));

    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json.error.code).toBe(400);
  });

  it('returns a safe restore-required error when simulation requires restore', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: { transaction: 'unsigned-xdr' } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(simulateRestoreRequiredFixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    vi.stubGlobal('fetch', mockFetch);

    const response = await POST(buildRequest(validLendBody));

    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error.code).toBe('RESTORE_REQUIRED');
    expect(json.error.message).toBe(
      'This transaction requires a restore before it can be submitted.',
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns 429 when the authenticated wallet exceeds account rate limit', async () => {
    getSessionMock.mockResolvedValue({ user: { walletAddress: 'GABC123' } });
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ result: { transaction: 'unsigned-xdr' } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: { transaction: 'unsigned-xdr' } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(simulateSuccessFixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: { transaction: 'unsigned-xdr' } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(simulateSuccessFixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    vi.stubGlobal('fetch', mockFetch);

    await POST(buildRequest(validLendBody));

    await POST(buildRequest(validLendBody));

    const response = await POST(buildRequest(validLendBody));

    expect(response.status).toBe(429);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('2');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('Retry-After')).toBeTruthy();

    const json = await response.json();
    expect(json.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(json.error.retryAfter).toBeGreaterThan(0);
  });
});
