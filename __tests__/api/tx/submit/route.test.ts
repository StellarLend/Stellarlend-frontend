import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as handler from '@/app/api/tx/submit/route';
import { appendAuditEvent, hashIp } from '@/lib/audit/logger';
import { httpPost } from '@/lib/http/client';
import { simulateSorobanTransaction } from '@/lib/soroban/simulate';
import {
  buildSorobanSubmitRpcRequest,
  extractSubmitResult,
  isTxSubmitRequest,
  buildSorobanRpcError,
} from '@/lib/soroban/tx';
import { getSession } from '@/lib/auth';
import { accountBucketRateLimit } from '@/lib/rate-limit/account-bucket';

vi.mock('@/lib/audit/logger', () => ({
  appendAuditEvent: vi.fn().mockResolvedValue({}),
  hashIp: vi.fn().mockReturnValue('hashed-ip'),
}));

vi.mock('@/lib/http/client', () => ({
  httpPost: vi.fn().mockResolvedValue({ result: {} }),
}));

vi.mock('@/lib/soroban/simulate', () => ({
  simulateSorobanTransaction: vi.fn().mockResolvedValue(undefined),
  SorobanSimulationError: class SorobanSimulationError extends Error {},
  buildSorobanSimulationApiError: vi.fn().mockReturnValue({}),
  getSorobanSimulationStatus: vi.fn().mockReturnValue('PASS'),
}));

vi.mock('@/lib/soroban/tx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/soroban/tx')>();
  return {
    ...actual,
    buildSorobanSubmitRpcRequest: vi.fn().mockReturnValue({}),
    extractSubmitResult: vi.fn().mockReturnValue({ hash: 'dummyhash' }),
    isTxSubmitRequest: vi.fn().mockReturnValue(true),
    buildSorobanRpcError: vi.fn().mockImplementation((err: unknown) => ({ code: 'RPC_ERROR', message: 'rpc error', data: err })),
  };
});

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/config', () => ({
  default: {
    api: { timeout: 8000 },
    rateLimit: { account: { maxRequests: 100, windowMs: 60000 } },
  },
}));

vi.mock('@/lib/server-config', () => ({
  default: {
    redisUrl: 'redis://localhost:6379',
    horizon: {
      urls: ['https://horizon-testnet.stellar.org'],
      primaryUrl: 'https://horizon-testnet.stellar.org',
    },
    stellar: {
      sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    },
  },
}));

vi.mock('@/lib/metrics/registry', () => ({
  metrics: { httpRequests: { inc: vi.fn() } },
}));

vi.mock('@/lib/rate-limit/account-bucket', () => ({
  accountBucketRateLimit: vi.fn().mockReturnValue({ success: true }),
}));

vi.mock('@/lib/api/handler', () => ({
  withCsrfProtection: vi.fn((_req: any, handler: any) => handler(_req)),
}));

describe('POST /api/tx/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and logs audit on successful submission', async () => {
    const payload = { signedEnvelopeXdr: 'AAA' };
    const req = new NextRequest('http://localhost:3000/api/tx/submit', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'req-1',
        'x-forwarded-for': '1.2.3.4',
      },
      body: JSON.stringify(payload),
    });

    const res = await handler.POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ status: 'submitted', hash: 'dummyhash' });
  });

  it('returns 400 and logs failure on malformed body', async () => {
    const badPayload = { wrong: true };
    vi.mocked(isTxSubmitRequest).mockReturnValueOnce(false);

    const req = new NextRequest('http://localhost:3000/api/tx/submit', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'req-2',
        'x-forwarded-for': '5.6.7.8',
      },
      body: JSON.stringify(badPayload),
    });

    const res = await handler.POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('INVALID_INPUT');
    expect(appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failure',
        requestId: 'req-2',
      }),
    );
  });
});
