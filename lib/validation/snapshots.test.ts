import { describe, it, expect } from 'vitest';
import {
  assertValidWalletAddress,
  parsePositionSnapshot,
  parseSnapshotJobData,
  SnapshotValidationError,
  MAX_AMOUNT,
} from '@/lib/validation/snapshots';

const VALID_WALLET = 'GATTYSMDCYWYAWNJZXY2RGNHDZ7ZDEKRGJY4JOMHMDU6LANVFCI2U45X';

const validSnapshot = {
  id: 'snapshot-1',
  walletAddress: VALID_WALLET,
  timestamp: Date.now(),
  supplied: 5000,
  borrowed: 2000,
  effectiveSupplyApy: 2.5,
  effectiveBorrowApy: 8.5,
  createdAt: Date.now(),
};

describe('assertValidWalletAddress', () => {
  it('accepts a valid Stellar account ID', () => {
    expect(() => assertValidWalletAddress(VALID_WALLET)).not.toThrow();
  });

  it('rejects malformed wallet identities', () => {
    expect(() => assertValidWalletAddress('GBTEST123')).toThrow(SnapshotValidationError);
    expect(() => assertValidWalletAddress('not-an-address')).toThrow(SnapshotValidationError);
    expect(() => assertValidWalletAddress('')).toThrow(SnapshotValidationError);
    expect(() => assertValidWalletAddress(42 as any)).toThrow(SnapshotValidationError);
  });
});

describe('parsePositionSnapshot', () => {
  it('accepts a valid snapshot', () => {
    expect(() => parsePositionSnapshot(validSnapshot)).not.toThrow();
  });

  it('rejects NaN amounts', () => {
    expect(() => parsePositionSnapshot({ ...validSnapshot, supplied: NaN })).toThrow(
      /invalid snapshot/
    );
  });

  it('rejects negative balances', () => {
    expect(() => parsePositionSnapshot({ ...validSnapshot, borrowed: -1 })).toThrow(
      /invalid snapshot/
    );
  });

  it('rejects non-finite APY values', () => {
    expect(() =>
      parsePositionSnapshot({ ...validSnapshot, effectiveSupplyApy: Infinity })
    ).toThrow(/invalid snapshot/);
  });

  it('rejects absurd amounts above the sanity cap', () => {
    expect(() => parsePositionSnapshot({ ...validSnapshot, supplied: MAX_AMOUNT + 1 })).toThrow(
      /invalid snapshot/
    );
  });

  it('rejects invalid wallet identity', () => {
    expect(() =>
      parsePositionSnapshot({ ...validSnapshot, walletAddress: 'GBTEST123' })
    ).toThrow(/invalid snapshot/);
  });

  it('rejects impossible timestamps (replay/tampering)', () => {
    const future = Date.now() + 100 * 24 * 60 * 60 * 1000;
    expect(() => parsePositionSnapshot({ ...validSnapshot, timestamp: future })).toThrow(
      /invalid snapshot/
    );
    expect(() =>
      parsePositionSnapshot({ ...validSnapshot, timestamp: Date.UTC(1999, 0, 1) })
    ).toThrow(/invalid snapshot/);
    expect(() => parsePositionSnapshot({ ...validSnapshot, timestamp: -5 })).toThrow(
      /invalid snapshot/
    );
  });

  it('rejects unknown fields (tampering)', () => {
    expect(() =>
      parsePositionSnapshot({ ...validSnapshot, network: 'mainnet' } as any)
    ).toThrow(/invalid snapshot/);
  });

  it('rejects empty or oversized ids', () => {
    expect(() => parsePositionSnapshot({ ...validSnapshot, id: '' })).toThrow(/invalid snapshot/);
    expect(() =>
      parsePositionSnapshot({ ...validSnapshot, id: 'x'.repeat(129) })
    ).toThrow(/invalid snapshot/);
  });
});

describe('parseSnapshotJobData', () => {
  const now = Date.now();

  it('accepts valid job data', () => {
    expect(() => parseSnapshotJobData({ timestamp: now })).not.toThrow();
    expect(() =>
      parseSnapshotJobData({ timestamp: now, walletAddress: VALID_WALLET })
    ).not.toThrow();
  });

  it('rejects job data without a timestamp', () => {
    expect(() => parseSnapshotJobData({} as any)).toThrow(/invalid snapshot job data/);
    expect(() => parseSnapshotJobData({ timestamp: 'now' } as any)).toThrow(
      /invalid snapshot job data/
    );
  });

  it('rejects job data with an invalid wallet identity', () => {
    expect(() =>
      parseSnapshotJobData({ timestamp: now, walletAddress: 'GBTEST123' })
    ).toThrow(/invalid snapshot job data/);
  });

  it('rejects job data with unknown fields (tampering)', () => {
    expect(() =>
      parseSnapshotJobData({ timestamp: now, network: 'mainnet' } as any)
    ).toThrow(/invalid snapshot job data/);
  });
});
