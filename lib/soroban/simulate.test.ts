import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import simulateAuthRequiredFixture from './__fixtures__/simulate-auth-required.json';
import simulateRestoreRequiredFixture from './__fixtures__/simulate-restore-required.json';
import simulateSuccessFixture from './__fixtures__/simulate-success.json';
import {
  buildSorobanSimulationApiError,
  getSorobanSimulationStatus,
  simulateSorobanTransaction,
  SorobanSimulationError,
} from './simulate';
import {
  HttpError,
  NetworkError,
  RetryExhaustedError,
  TimeoutError,
  UpstreamHttpError,
} from '@/lib/http/errors';

vi.mock('@/lib/http/client', () => ({
  httpPost: vi.fn(),
}));

import { httpPost } from '@/lib/http/client';

describe('simulateSorobanTransaction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns normalized fee, auth, and footprint metadata on success', async () => {
    vi.mocked(httpPost).mockResolvedValue(simulateSuccessFixture);

    await expect(
      simulateSorobanTransaction('https://soroban-testnet.stellar.org', 'unsigned-xdr'),
    ).resolves.toEqual({
      transactionDataXdr: 'AAAAAgAAAAE=',
      minResourceFee: '3210',
      footprint: {
        readOnly: ['AAAAAQ=='],
        readWrite: ['AAAAAg=='],
      },
      auth: ['AAAAAw==', 'AAAABA=='],
    });
  });

  it('throws a restore-required error when restore preamble is present', async () => {
    vi.mocked(httpPost).mockResolvedValue(simulateRestoreRequiredFixture);

    try {
      await simulateSorobanTransaction('https://soroban-testnet.stellar.org', 'unsigned-xdr');
      throw new Error('Expected restore-required simulation error.');
    } catch (error) {
      expect(error).toBeInstanceOf(SorobanSimulationError);
      expect((error as SorobanSimulationError).code).toBe('RESTORE_REQUIRED');
      expect(getSorobanSimulationStatus(error)).toBe(409);
      expect(buildSorobanSimulationApiError(error)).toEqual({
        code: 'RESTORE_REQUIRED',
        message: 'This transaction requires a restore before it can be submitted.',
        data: {
          restoreRequired: true,
          restorePreamble: simulateRestoreRequiredFixture.result.restorePreamble,
        },
      });
    }
  });

  it('maps auth-related RPC failures to a safe API error', async () => {
    vi.mocked(httpPost).mockResolvedValue(simulateAuthRequiredFixture);

    try {
      await simulateSorobanTransaction('https://soroban-testnet.stellar.org', 'unsigned-xdr');
      throw new Error('Expected auth-related simulation error.');
    } catch (error) {
      expect(error).toBeInstanceOf(SorobanSimulationError);
      expect((error as SorobanSimulationError).code).toBe('AUTH_REQUIRED');
      expect(buildSorobanSimulationApiError(error)).toEqual({
        code: 'AUTH_REQUIRED',
        message: 'This transaction requires additional authorization before it can be submitted.',
        data: { authRequired: true },
      });
    }
  });

  it('sanitizes transport-level simulation failures', async () => {
    vi.mocked(httpPost).mockRejectedValue(
      new NetworkError('https://private-rpc.test', new Error('connect ECONNREFUSED 127.0.0.1')),
    );

    try {
      await simulateSorobanTransaction('https://private-rpc.test', 'unsigned-xdr');
      throw new Error('Expected transport-level simulation error.');
    } catch (error) {
      expect(error).toBeInstanceOf(SorobanSimulationError);
      expect((error as SorobanSimulationError).code).toBe('SIMULATION_UNAVAILABLE');
      expect((error as SorobanSimulationError).message).toBe(
        'Unable to simulate the transaction right now. Please try again later.',
      );
      expect(JSON.stringify(buildSorobanSimulationApiError(error))).not.toContain(
        'private-rpc.test',
      );
    }
  });

  it('produces a sane fallback message for a plain TypeError not matching any instanceof check', async () => {
    vi.mocked(httpPost).mockRejectedValue(
      new TypeError("Cannot read properties of undefined (reading 'foo')"),
    );

    try {
      await simulateSorobanTransaction('https://private-rpc.test', 'unsigned-xdr');
      throw new Error('Expected fallback simulation error from TypeError.');
    } catch (error) {
      expect(error).toBeInstanceOf(SorobanSimulationError);
      const simError = error as SorobanSimulationError;
      expect(simError.code).toBe('SIMULATION_FAILED');
      expect(simError.message).toBe(
        'Transaction simulation failed. Review the transaction details and try again.',
      );
      expect(simError.message.trim().length).toBeGreaterThan(0);
      expect(simError.status).toBe(422);
      expect(simError.cause).toBeInstanceOf(TypeError);
      expect(buildSorobanSimulationApiError(error)).toEqual({
        code: 'SIMULATION_FAILED',
        message: 'Transaction simulation failed. Review the transaction details and try again.',
      });
    }
  });

  it('produces a sane fallback message when a non-Error string is thrown', async () => {
    vi.mocked(httpPost).mockRejectedValue('raw string thrown as error');

    try {
      await simulateSorobanTransaction('https://private-rpc.test', 'unsigned-xdr');
      throw new Error('Expected fallback simulation error from thrown string.');
    } catch (error) {
      expect(error).toBeInstanceOf(SorobanSimulationError);
      const simError = error as SorobanSimulationError;
      expect(simError.code).toBe('SIMULATION_FAILED');
      expect(simError.message).toBe(
        'Transaction simulation failed. Review the transaction details and try again.',
      );
      expect(simError.message.trim().length).toBeGreaterThan(0);
      expect(simError.status).toBe(422);
      expect(simError.cause).toBe('raw string thrown as error');
      expect(buildSorobanSimulationApiError(error)).toEqual({
        code: 'SIMULATION_FAILED',
        message: 'Transaction simulation failed. Review the transaction details and try again.',
      });
    }
  });

  it('produces a sane fallback message when a plain object is thrown', async () => {
    const thrownObject = { unexpected: true, detail: 'some weird value' };
    vi.mocked(httpPost).mockRejectedValue(thrownObject);

    try {
      await simulateSorobanTransaction('https://private-rpc.test', 'unsigned-xdr');
      throw new Error('Expected fallback simulation error from thrown plain object.');
    } catch (error) {
      expect(error).toBeInstanceOf(SorobanSimulationError);
      const simError = error as SorobanSimulationError;
      expect(simError.code).toBe('SIMULATION_FAILED');
      expect(simError.message).toBe(
        'Transaction simulation failed. Review the transaction details and try again.',
      );
      expect(simError.message.trim().length).toBeGreaterThan(0);
      expect(simError.status).toBe(422);
      expect(simError.cause).toBe(thrownObject);
      expect(buildSorobanSimulationApiError(error)).toEqual({
        code: 'SIMULATION_FAILED',
        message: 'Transaction simulation failed. Review the transaction details and try again.',
      });
    }
  });
});
