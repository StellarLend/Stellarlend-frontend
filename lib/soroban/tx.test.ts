import { describe, expect, it } from 'vitest';
import {
  buildSorobanRpcError,
  buildSorobanTransactionRpcRequest,
  DEFAULT_SOROBAN_TRANSACTION_FEE,
  isTxBuildRequest,
  TxBuildRequest,
} from './tx';

const VALID_PUBLIC_KEY = 'G' + 'A'.repeat(55);

const baseRequest: TxBuildRequest = {
  type: 'lend',
  sourceAccount: VALID_PUBLIC_KEY,
  data: {
    asset: 'XLM',
    amount: 100,
    interestRate: 5,
  },
};

function paramsOf(payload: Record<string, unknown>): Record<string, unknown> {
  const params = payload.params as Array<Record<string, unknown>>;
  return params[0];
}

describe('buildSorobanRpcError', () => {
  it('returns UNKNOWN_ERROR when the error is not an object', () => {
    expect(buildSorobanRpcError(null).code).toBe('UNKNOWN_ERROR');
    expect(buildSorobanRpcError(undefined).code).toBe('UNKNOWN_ERROR');
    expect(buildSorobanRpcError('boom').code).toBe('UNKNOWN_ERROR');
    expect(buildSorobanRpcError(404).code).toBe('UNKNOWN_ERROR');
    expect(buildSorobanRpcError(true).code).toBe('UNKNOWN_ERROR');
  });

  it('preserves primitive string and number codes', () => {
    expect(
      buildSorobanRpcError({ code: 'INVALID_INSTRUCTION', message: 'bad' }).code,
    ).toBe('INVALID_INSTRUCTION');
    expect(buildSorobanRpcError({ code: 500, message: 'oops' }).code).toBe(500);
    expect(buildSorobanRpcError({ code: 0, message: 'zero' }).code).toBe(0);
    expect(buildSorobanRpcError({ code: '', message: 'empty' }).code).toBe('');
  });

  it('coerces non-primitive codes to UNKNOWN_ERROR so the type contract holds', () => {
    expect(buildSorobanRpcError({ code: { foo: 'bar' }, message: 'x' }).code).toBe(
      'UNKNOWN_ERROR',
    );
    expect(buildSorobanRpcError({ code: [1, 2, 3], message: 'x' }).code).toBe(
      'UNKNOWN_ERROR',
    );
    expect(buildSorobanRpcError({ code: true, message: 'x' }).code).toBe(
      'UNKNOWN_ERROR',
    );
    expect(buildSorobanRpcError({ code: null, message: 'x' }).code).toBe(
      'UNKNOWN_ERROR',
    );
    expect(buildSorobanRpcError({ code: undefined, message: 'x' }).code).toBe(
      'UNKNOWN_ERROR',
    );
  });

  it('coerces bigint codes to a base-10 string representation', () => {
    expect(buildSorobanRpcError({ code: 42n, message: 'x' }).code).toBe('42');
  });

  it('uses the default message when the upstream message is not a string', () => {
    expect(buildSorobanRpcError({ code: 'X', message: undefined }).message).toBe(
      'Unknown Soroban RPC error',
    );
    expect(buildSorobanRpcError({ code: 'X', message: { weird: true } }).message).toBe(
      'Unknown Soroban RPC error',
    );
  });

  it('coerces a non-primitive code while defaulting the message and dropping data', () => {
    const result = buildSorobanRpcError({ code: { nested: { deep: true } } });
    expect(result.code).toBe('UNKNOWN_ERROR');
    expect(typeof result.code).toBe('string');
    expect(result.message).toBe('Unknown Soroban RPC error');
    expect(result.data).toBeUndefined();
  });

  it('preserves the upstream message when it is a string', () => {
    expect(
      buildSorobanRpcError({ code: 'X', message: 'real upstream problem' }).message,
    ).toBe('real upstream problem');
  });

  it('preserves the optional data field through the conversion', () => {
    const data = { extra: 'info', cause: 'tx_bad_seq' };
    expect(
      buildSorobanRpcError({ code: 'TX_BAD_SEQ', message: 'm', data }).data,
    ).toEqual(data);
  });
});

describe('buildSorobanTransactionRpcRequest', () => {
  it('uses DEFAULT_SOROBAN_TRANSACTION_FEE when no fee override is supplied', () => {
    expect(DEFAULT_SOROBAN_TRANSACTION_FEE).toBe(100);
    const payload = buildSorobanTransactionRpcRequest(baseRequest, 'contract', 'testnet');
    expect(paramsOf(payload).fee).toBe(DEFAULT_SOROBAN_TRANSACTION_FEE);
  });

  it('honors a custom fee passed via options', () => {
    const payload = buildSorobanTransactionRpcRequest(
      baseRequest,
      'contract',
      'testnet',
      { fee: 250 },
    );
    expect(paramsOf(payload).fee).toBe(250);
  });

  it('accepts a fee of zero for fee-bump or sponsored transactions', () => {
    const payload = buildSorobanTransactionRpcRequest(
      baseRequest,
      'contract',
      'testnet',
      { fee: 0 },
    );
    expect(paramsOf(payload).fee).toBe(0);
  });

  it('rejects negative, NaN, and non-finite fee values', () => {
    expect(() =>
      buildSorobanTransactionRpcRequest(baseRequest, 'cid', 'testnet', { fee: -1 }),
    ).toThrow(/Invalid Soroban transaction fee/);

    expect(() =>
      buildSorobanTransactionRpcRequest(baseRequest, 'cid', 'testnet', {
        fee: Number.NaN,
      }),
    ).toThrow(/Invalid Soroban transaction fee/);

    expect(() =>
      buildSorobanTransactionRpcRequest(baseRequest, 'cid', 'testnet', {
        fee: Number.POSITIVE_INFINITY,
      }),
    ).toThrow(/Invalid Soroban transaction fee/);
  });

  it('selects the appropriate network passphrase', () => {
    const publicPayload = buildSorobanTransactionRpcRequest(
      baseRequest,
      'cid',
      'public',
    );
    expect(paramsOf(publicPayload).network_passphrase).toBe(
      'Public Global Stellar Network ; September 2015',
    );

    const testnetPayload = buildSorobanTransactionRpcRequest(
      baseRequest,
      'cid',
      'testnet',
    );
    expect(paramsOf(testnetPayload).network_passphrase).toBe(
      'Test SDF Network ; September 2015',
    );
  });
});

describe('isTxBuildRequest', () => {
  it('accepts the base request without a fee', () => {
    expect(isTxBuildRequest(baseRequest)).toBe(true);
  });

  it('accepts a valid optional fee override', () => {
    expect(isTxBuildRequest({ ...baseRequest, fee: 150 })).toBe(true);
    expect(isTxBuildRequest({ ...baseRequest, fee: 0 })).toBe(true);
  });

  it('rejects invalid optional fee overrides', () => {
    expect(isTxBuildRequest({ ...baseRequest, fee: -10 })).toBe(false);
    expect(isTxBuildRequest({ ...baseRequest, fee: '500' })).toBe(false);
    expect(isTxBuildRequest({ ...baseRequest, fee: null })).toBe(false);
    expect(isTxBuildRequest({ ...baseRequest, fee: Number.NaN })).toBe(false);
  });
});
