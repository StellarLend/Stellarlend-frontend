import { testApiHandler } from 'next-test-api-route-handler';
import * as handler from '@/app/api/tx/submit/route';
import * as audit from '@/lib/audit/logger';
import * as http from '@/lib/http/client';
import * as simulate from '@/lib/soroban/simulate';
import * as sorobanTx from '@/lib/soroban/tx';

jest.mock('@/lib/audit/logger');
jest.mock('@/lib/http/client');
jest.mock('@/lib/soroban/simulate');
jest.mock('@/lib/soroban/tx', () => ({
  ...jest.requireActual('@/lib/soroban/tx'),
  buildSorobanSubmitRpcRequest: jest.fn().mockReturnValue({}),
  extractSubmitResult: jest.fn().mockReturnValue({ hash: 'dummyhash' }),
  isTxSubmitRequest: jest.fn().mockReturnValue(true),
  buildSorobanRpcError: jest.fn().mockImplementation((err) => ({ code: 'RPC_ERROR', message: 'rpc error', data: err })),
}));

describe('POST /api/tx/submit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-ignore
    audit.appendAuditEvent.mockResolvedValue({});
    // @ts-ignore
    http.httpPost.mockResolvedValue({ result: {} });
    // @ts-ignore
    simulate.simulateSorobanTransaction.mockResolvedValue(undefined);
  });

  it('returns 200 and logs audit on successful submission', async () => {
    const payload = { signedEnvelopeXdr: 'AAA' };
    await testApiHandler({
      appHandler: handler,
      request: {
        method: 'POST',
        headers: {
          'x-request-id': 'req-1',
          'x-forwarded-for': '1.2.3.4',
        },
        body: JSON.stringify(payload),
      },
      async test({ fetch }) {
        const res = await fetch({ method: 'POST' });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json).toEqual({ status: 'submitted', hash: 'dummyhash' });
        expect(audit.appendAuditEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'success',
            requestId: 'req-1',
            ipHash: expect.any(String),
          }),
        );
      },
    });
  });

  it('returns 400 and logs failure on malformed body', async () => {
    const badPayload = { wrong: true };
    await testApiHandler({
      appHandler: handler,
      request: {
        method: 'POST',
        headers: {
          'x-request-id': 'req-2',
          'x-forwarded-for': '5.6.7.8',
        },
        body: JSON.stringify(badPayload),
      },
      async test({ fetch }) {
        const res = await fetch({ method: 'POST' });
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.code).toBe('INVALID_INPUT');
        expect(audit.appendAuditEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'failure',
            requestId: 'req-2',
            ipHash: expect.any(String),
          }),
        );
      },
    });
  });
});
