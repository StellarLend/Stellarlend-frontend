import { describe, expect, it } from 'vitest';
import { xdr, scValToNative } from '@stellar/stellar-sdk';
import { decodeProtocolMetricsScVal } from './protocol';

describe('decodeProtocolMetricsScVal', () => {
  it('decodes mock RPC simulateTransaction retval with real XDR ScVal map', () => {
    // Rust ProtocolMetrics: { total_borrow: i128, total_supply: i128, utilization_bps: u32, ledger: u32 }
    const metricsMap = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('total_borrow'),
        val: xdr.ScVal.scvI128(new xdr.Int128Parts({ lo: 12_345_0000000n, hi: 0n })),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('total_supply'),
        val: xdr.ScVal.scvI128(new xdr.Int128Parts({ lo: 50_000_0000000n, hi: 0n })),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('utilization_bps'),
        val: xdr.ScVal.scvU32(2469),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('ledger'),
        val: xdr.ScVal.scvU32(987654),
      }),
    ]);

    const base64 = metricsMap.toXDR('base64');
    const parsedScVal = xdr.ScVal.fromXDR(base64, 'base64');
    const native = scValToNative(parsedScVal);

    const metrics = decodeProtocolMetricsScVal(native);

    expect(metrics.totalBorrow).toBe(12_345_0000000n);
    expect(metrics.totalSupply).toBe(50_000_0000000n);
    expect(metrics.utilizationBps).toBe(2469);
    expect(metrics.ledger).toBe(987654);
  });

  it('correctly decodes i128 values larger than 2^53 without precision loss', () => {
    const largeValue = (1n << 70n) + 987654321n;
    const hi = largeValue >> 64n;
    const lo = BigInt.asUintN(64, largeValue);

    const metricsMap = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('total_borrow'),
        val: xdr.ScVal.scvI128(new xdr.Int128Parts({ lo, hi })),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('total_supply'),
        val: xdr.ScVal.scvI128(new xdr.Int128Parts({ lo, hi })),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('utilization_bps'),
        val: xdr.ScVal.scvU32(10000),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('ledger'),
        val: xdr.ScVal.scvU32(1000),
      }),
    ]);

    const base64 = metricsMap.toXDR('base64');
    const parsedScVal = xdr.ScVal.fromXDR(base64, 'base64');
    const native = scValToNative(parsedScVal);

    const metrics = decodeProtocolMetricsScVal(native);

    expect(metrics.totalBorrow).toBe(largeValue);
    expect(metrics.totalSupply).toBe(largeValue);
    expect(typeof metrics.totalSupply).toBe('bigint');
  });

  it('handles zero supply with utilization 0 (no division by zero)', () => {
    const metricsMap = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('total_borrow'),
        val: xdr.ScVal.scvI128(new xdr.Int128Parts({ lo: 0n, hi: 0n })),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('total_supply'),
        val: xdr.ScVal.scvI128(new xdr.Int128Parts({ lo: 0n, hi: 0n })),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('utilization_bps'),
        val: xdr.ScVal.scvU32(5000),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('ledger'),
        val: xdr.ScVal.scvU32(50),
      }),
    ]);

    const base64 = metricsMap.toXDR('base64');
    const parsedScVal = xdr.ScVal.fromXDR(base64, 'base64');
    const native = scValToNative(parsedScVal);

    const metrics = decodeProtocolMetricsScVal(native);

    expect(metrics.totalSupply).toBe(0n);
    expect(metrics.totalBorrow).toBe(0n);
    expect(metrics.utilizationBps).toBe(0);
    expect(metrics.ledger).toBe(50);
  });
});
