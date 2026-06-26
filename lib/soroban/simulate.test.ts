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

describe('simulateSorobanTransaction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns normalized fee, auth, and footprint metadata on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(simulateSuccessFixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(simulateRestoreRequiredFixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(simulateAuthRequiredFixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1')),
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
});
