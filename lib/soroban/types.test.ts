import { describe, expect, it } from 'vitest';
import {
  isSorobanRpcErrorResponse,
  isSorobanRpcSuccessResponse,
  type SorobanRpcResponse,
} from './types';
import { extractUnsignedXdr } from './tx';

describe('SorobanRpcResponse type guards', () => {
  describe('isSorobanRpcErrorResponse', () => {
    it('returns true for a valid error response', () => {
      const response: SorobanRpcResponse = {
        jsonrpc: '2.0',
        id: '1',
        error: { code: -32000, message: 'Transaction failed' },
      };
      expect(isSorobanRpcErrorResponse(response)).toBe(true);
    });

    it('returns false for a valid success response', () => {
      const response: SorobanRpcResponse = {
        jsonrpc: '2.0',
        id: '1',
        result: { transaction: 'AAAA...' },
      };
      expect(isSorobanRpcErrorResponse(response)).toBe(false);
    });

    it('returns false for non-object values', () => {
      expect(isSorobanRpcErrorResponse(null)).toBe(false);
      expect(isSorobanRpcErrorResponse(undefined)).toBe(false);
      expect(isSorobanRpcErrorResponse('string')).toBe(false);
      expect(isSorobanRpcErrorResponse(42)).toBe(false);
    });

    it('returns false for objects with error set to null', () => {
      expect(isSorobanRpcErrorResponse({ error: null })).toBe(false);
    });
  });

  describe('isSorobanRpcSuccessResponse', () => {
    it('returns true for a valid success response', () => {
      const response: SorobanRpcResponse = {
        jsonrpc: '2.0',
        id: '1',
        result: { transaction: 'AAAA...' },
      };
      expect(isSorobanRpcSuccessResponse(response)).toBe(true);
    });

    it('returns false for a valid error response', () => {
      const response: SorobanRpcResponse = {
        jsonrpc: '2.0',
        id: '1',
        error: { code: -32000, message: 'Transaction failed' },
      };
      expect(isSorobanRpcSuccessResponse(response)).toBe(false);
    });

    it('returns false for non-object values', () => {
      expect(isSorobanRpcSuccessResponse(null)).toBe(false);
      expect(isSorobanRpcSuccessResponse(undefined)).toBe(false);
    });
  });
});

describe('Soroban RPC response handling consistency', () => {
  const errorResponseFixture: SorobanRpcResponse = {
    jsonrpc: '2.0',
    id: 'test-1',
    error: { code: -32600, message: 'Invalid request', data: { extra: 'details' } },
  };

  const successResponseFixture: SorobanRpcResponse = {
    jsonrpc: '2.0',
    id: 'test-2',
    result: { transaction: 'AAAAAG15dXNy...', transaction_xdr: 'AAAAAG15dXNy...' },
  };

  it('isSorobanRpcErrorResponse correctly discriminates the error fixture', () => {
    expect(isSorobanRpcErrorResponse(errorResponseFixture)).toBe(true);
    expect(isSorobanRpcSuccessResponse(errorResponseFixture)).toBe(false);
  });

  it('isSorobanRpcSuccessResponse correctly discriminates the success fixture', () => {
    expect(isSorobanRpcSuccessResponse(successResponseFixture)).toBe(true);
    expect(isSorobanRpcErrorResponse(successResponseFixture)).toBe(false);
  });

  it('both type guards agree on a malformed response (neither matches)', () => {
    const malformed = { jsonrpc: '2.0', id: 'x' } as SorobanRpcResponse;
    expect(isSorobanRpcErrorResponse(malformed)).toBe(false);
    expect(isSorobanRpcSuccessResponse(malformed)).toBe(false);
  });

  it('extractUnsignedXdr works with the success result from the shared response type', () => {
    const xdr = extractUnsignedXdr(successResponseFixture.result);
    expect(xdr).toBe('AAAAAG15dXNy...');
  });
});
