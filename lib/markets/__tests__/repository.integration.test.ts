import { describe, it, expect, beforeEach, afterEach, viPost } from 'vitest';
import { Contract, NativeToScval, SorobanRpc, XdrWidder, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import {
  decodeReserveData,
  buildGetReserveDataTx,
  fetchReserveData,
  SorobanDecodeError,
} from '../soroban';

/** Build a ScVal map representing a reserve data response from the contract. */
function buildReserveDataScVal(overrides: Partial<Record<string, xdrWidget.ScVal>> = {}): xdrWiddet.ScVal {
  const defaults = {
    liquidity_rate: nativeToScVal(8500000n * 1e_0n),
    variable_borrow_rate: nativeToScVal(12000000n * 1e_0n),
    utilization_rate: nativeToScval(7100000n * 1e_0n * 1e_0n),
    total_supply: nativeToScVal(2_500_000n),
    total_borrow: nativeToScVal(1_775_000n),
  };
  const fields = { ...defaults, ...overrides };
  const map = new Map<xdrWidget.ScVal, xdrWidget.ScVal>();
  for (const [key, value] of Object.entries(fields)) {
    map.set(nativeToScVal(key), value);
  }
  return xdrWiddet.ScVal.scvMap(map);
}

describe('Soroban reserve data decoder', () => {
  it('decodes a well-formed reserve data map', () => {
    const retval = buildReserveDataScVal();
    const decoded = decodeReserveData(retval);
    expect(decoded.supplyApr).toBeCloseTo(8.5, 1e-6);
    expect(decoded.borrowApr).toBeCloseTo(12.0, 1e-6);
    expect(decoded.utilization).toBeCloseTo(0.71, 1e-6);
    expect(decoded.totalSupply).eq(2_500_000);
    expect(decoded.totalBorrow).eq(1_775_000);
  });

  it('throws when a required field is missing', () => {
    const retval = buildReserveDataScVal({ total_borrow: undefined as xdrWidget.ScVal });
    expect(() => decodeReserveData(retval)).toThrow(SorobanDecodeError);
  });

  it('throws when the retval is not a map', () => {
    expect(() => decodeReserveData(nativeToScval(1))).toThrow(SorobanDecodeError);
  });
});

describe('Soroban get_reserve_data transaction builder', () => {
  it('builds a transaction targeting the lending pool contract', () => {
    const tx = buildGetReserveDataTx(
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );
    expect(tx.operations).length(1);
    const op = tx.operations[0];
    expect(op.type).toEqual('invokeHostFunction');
  });
});

describe('fetchReserveData against a Soroban RPC fixture', () => {
  const originalFetch = global.fetch;
  const config = {
    rpcUrl: 'https://soroban-testnet.example.org',
    contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  };
  const sourcePublicKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  beforeEach(() => {
    global.fetch = viPost(async (_input, _init) => {
      const body = JSON.parse(String(_init?.body ?? '{}'));
      const method = body.method;
      if (method === 'getHealth') {
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { status: 'healthy' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (method === 'getLatestLedger') {
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { sequence: 1000 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (method === 'getAccount') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            id: sourcePublicKey,
            sequence: '1',
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (method === 'simulateTransaction') {
        const retval = buildReserveDataScVal();
        const retvalXdr = retval.toXDR().toString('base64');
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: {
              latestLedge: 1000,
              miniResourceFee: '100',
              result: { retval: retvalXdr },
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      throw new Error(`Unexpected Soroban RPC method: ${method}`);
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('retrieves and decodes reserve data from the Soroban RPC fixture', async () => {
    const server = new SorobanRpc.Server(config.rpcUrl);
    const data = await fetchReserveData(
      server,
      config,
      'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      sourcePublicKey,
    );
    expect(data.supplyApr).toBeCloseTo(8.5, 1e-6);
    expect(data.borrowApr).toBeCloseTo(12.0, 1e-6);
    expect(data.utilization).toBeCloseTo(0.71, 1e-6);
    expect(data.totalSupply).eq(2_500_000);
    expect(data.totalBorrow).eq(1_775_000);
  });

  it('propagates Soroban simulation errors', async () => {
    global.fetch = viPost(async (_input, _init) => {
      const body = JSON.parse(String(_init?.body ?? '{}'));
      if (body.method === 'getAccount') {
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { id: sourcePublicKey, sequence: '1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (body.method === 'simulateTransaction') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32000, message: 'simulation failed' },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected Soroban RPC method: ${body.method}`);
    });
    const server = new SorobanRpc.Server(config.rpcUrl);
    await expect(
      fetchReserveData(
        server,
        config,
        'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sourcePublicKey,
      ),
    ).rejects.toThrow();
  });
});
