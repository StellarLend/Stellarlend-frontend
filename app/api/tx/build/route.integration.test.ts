import { beforeEach, describe, expect, it, vi } from 'vitest';
import simulateSuccessFixture from '@/lib/soroban/__fixtures__/simulate-success.json';

vi.mock('@/lib/config', () => ({
  default: {
    stellar: {
      network: 'testnet',
      sorobanContractId: 'GCONTRACTTESTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      sorobanRpcUrl: 'https://private-rpc.test',
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

vi.mock('@/lib/http/client', () => ({
  httpPost: vi.fn(),
}));

import { getSession } from '@/lib/auth';
import { httpPost } from '@/lib/http/client';
import { clearAccountBucketCache } from '@/lib/rate-limit/account-bucket';
import { POST } from './route';

const validSourceAccount = `G${'A'.repeat(55)}`;

const validLendBody = {
  type: 'lend',
  sourceAccount: validSourceAccount,
  data: {
    asset: 'XLM',
    amount: 1000,
    interestRate: 5,
    duration: 30,
  },
};

const validBorrowBody = {
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
};

const normalizedSimulation = {
  transactionDataXdr: 'AAAAAgAAAAE=',
  minResourceFee: '3210',
  footprint: {
    readOnly: ['AAAAAQ=='],
    readWrite: ['AAAAAg=='],
  },
  auth: ['AAAAAw==', 'AAAABA=='],
};

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/tx/build', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/tx/build integration', () => {
  const httpPostMock = vi.mocked(httpPost);
  const getSessionMock = vi.mocked(getSession);

  beforeEach(() => {
    clearAccountBucketCache();
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue(null);
  });

  it('rejects malformed JSON with the standard invalid-input envelope', async () => {
    const response = await POST(makeRequest('{'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'INVALID_INPUT',
        message: 'Invalid request body.',
      },
    });
    expect(httpPostMock).not.toHaveBeenCalled();
  });

  it('rejects structurally invalid tx build requests before calling Soroban RPC', async () => {
    const response = await POST(
      makeRequest({
        type: 'lend',
        sourceAccount: validSourceAccount,
        data: {
          asset: '',
          amount: '1000',
          interestRate: 5,
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'INVALID_INPUT',
        message: 'Invalid request body.',
      },
    });
    expect(httpPostMock).not.toHaveBeenCalled();
  });

  it('assembles a lend build request and returns the unsigned envelope plus simulation', async () => {
    httpPostMock
      .mockResolvedValueOnce({ result: { transaction: 'unsigned-lend-xdr' } })
      .mockResolvedValueOnce(simulateSuccessFixture);

    const response = await POST(makeRequest(validLendBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      unsignedXdr: 'unsigned-lend-xdr',
      simulation: normalizedSimulation,
    });

    expect(httpPostMock).toHaveBeenNthCalledWith(
      1,
      'https://private-rpc.test',
      {
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
                function: 'lend',
                contract_id: 'GCONTRACTTESTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
                args: [
                  { type: 'string', value: 'XLM' },
                  { type: 'u64', value: '1000' },
                  { type: 'string', value: '5' },
                ],
                footprint: {
                  read_only: [],
                  read_write: [],
                },
              },
            ],
          },
        ],
      },
      { timeoutMs: 10000 },
    );
    expect(httpPostMock).toHaveBeenNthCalledWith(
      2,
      'https://private-rpc.test',
      {
        jsonrpc: '2.0',
        id: 'simulate_transaction',
        method: 'simulateTransaction',
        params: [{ transaction: 'unsigned-lend-xdr' }],
      },
      { timeoutMs: 10000 },
    );
  });

  it('assembles borrow-specific instruction arguments before simulation', async () => {
    httpPostMock
      .mockResolvedValueOnce({
        result: { transaction_xdr: 'unsigned-borrow-xdr' },
      })
      .mockResolvedValueOnce(simulateSuccessFixture);

    const response = await POST(makeRequest(validBorrowBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      unsignedXdr: 'unsigned-borrow-xdr',
      simulation: normalizedSimulation,
    });

    expect(httpPostMock.mock.calls[0][1]).toMatchObject({
      params: [
        {
          instructions: [
            {
              function: 'borrow',
              args: [
                { type: 'string', value: 'USDC' },
                { type: 'u64', value: '250' },
                { type: 'string', value: '7.5' },
                { type: 'u32', value: '90' },
                { type: 'string', value: 'XLM' },
                { type: 'u64', value: '1000' },
              ],
            },
          ],
        },
      ],
    });
  });

  it('maps Soroban build RPC errors to the route error envelope', async () => {
    httpPostMock.mockResolvedValueOnce({
      error: {
        code: -32602,
        message: 'invalid transaction build request',
        data: { reason: 'bad params' },
      },
    });

    const response = await POST(makeRequest(validLendBody));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: -32602,
        message: 'invalid transaction build request',
        data: { reason: 'bad params' },
      },
    });
    expect(httpPostMock).toHaveBeenCalledTimes(1);
  });

  it('returns a safe RPC error when the build response has no unsigned envelope', async () => {
    httpPostMock.mockResolvedValueOnce({ result: { status: 'missing_xdr' } });

    const response = await POST(makeRequest(validLendBody));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'RPC_ERROR',
        message: 'Failed to build Soroban transaction with upstream RPC.',
      },
    });
    expect(httpPostMock).toHaveBeenCalledTimes(1);
  });

  it('maps simulation failures after a successful build without hiding the route status', async () => {
    httpPostMock
      .mockResolvedValueOnce({ result: { transaction: 'unsigned-lend-xdr' } })
      .mockResolvedValueOnce({
        error: {
          code: -32000,
          message: 'restore required before simulation can continue',
          data: { restorePreamble: 'restore-xdr' },
        },
      });

    const response = await POST(makeRequest(validLendBody));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'RESTORE_REQUIRED',
        message:
          'This transaction requires a restore before it can be submitted.',
        data: {
          restoreRequired: true,
          restorePreamble: 'restore-xdr',
        },
      },
    });
    expect(httpPostMock).toHaveBeenCalledTimes(2);
  });
});
