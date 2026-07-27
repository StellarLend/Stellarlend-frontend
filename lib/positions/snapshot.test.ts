/**
 * Tests for Position Snapshot Utilities
 * 
 * Coverage:
 * - Parameter validation and normalization
 * - Interval bucketing
 * - Aggregation functions
 * - Mock data generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getIntervalDuration,
  validateAndNormalizeParams,
  bucketSnapshots,
  aggregateSnapshotsInBucket,
  generateMockSnapshots,
  PositionSnapshot,
  INTERVAL_OPTIONS,
} from './snapshot';

describe('lib/positions/snapshot', () => {
  describe('getIntervalDuration', () => {
    it('returns correct duration for 1h interval', () => {
      expect(getIntervalDuration('1h')).toBe(60 * 60 * 1000);
    });

    it('returns correct duration for 1d interval', () => {
      expect(getIntervalDuration('1d')).toBe(24 * 60 * 60 * 1000);
    });

    it('returns correct duration for 7d interval', () => {
      expect(getIntervalDuration('7d')).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('returns correct duration for 30d interval', () => {
      expect(getIntervalDuration('30d')).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('handles all interval options', () => {
      for (const interval of INTERVAL_OPTIONS) {
        expect(getIntervalDuration(interval)).toBeGreaterThan(0);
      }
    });
  });

  describe('validateAndNormalizeParams', () => {
    const now = Date.now();

    it('uses default from (90 days ago) when not provided', () => {
      const params = validateAndNormalizeParams({});
      const expectedFrom = now - 90 * 24 * 60 * 60 * 1000;
      expect(params.from).toBeGreaterThanOrEqual(expectedFrom - 1000);
      expect(params.from).toBeLessThanOrEqual(expectedFrom + 1000);
    });

    it('uses default to (now) when not provided', () => {
      const params = validateAndNormalizeParams({});
      expect(params.to).toBeGreaterThanOrEqual(now - 1000);
      expect(params.to).toBeLessThanOrEqual(now + 1000);
    });

    it('uses default interval (1d) when not provided', () => {
      const params = validateAndNormalizeParams({});
      expect(params.interval).toBe('1d');
    });

    it('accepts explicit from, to, and interval', () => {
      const from = now - 30 * 24 * 60 * 60 * 1000;
      const to = now;
      const interval = '7d';

      const params = validateAndNormalizeParams({ from, to, interval });
      expect(params.from).toBe(from);
      expect(params.to).toBe(to);
      expect(params.interval).toBe(interval);
    });

    it('rejects when from >= to', () => {
      const from = now;
      const to = now - 1000;

      expect(() => {
        validateAndNormalizeParams({ from, to });
      }).toThrow('from must be earlier than to');
    });

    it('rejects when range exceeds 365 days', () => {
      const from = now - 400 * 24 * 60 * 60 * 1000;
      const to = now;

      expect(() => {
        validateAndNormalizeParams({ from, to });
      }).toThrow('time range cannot exceed 365 days');
    });

    it('rejects invalid interval', () => {
      expect(() => {
        validateAndNormalizeParams({ interval: 'invalid' });
      }).toThrow();
    });

    it('rejects negative timestamps', () => {
      expect(() => {
        validateAndNormalizeParams({ from: -1 });
      }).toThrow();
    });
  });

  describe('bucketSnapshots', () => {
    const baseTime = 1700000000000;
    const wallet = 'GBTEST';

    const createSnapshot = (timestamp: number, supplied = 1000, borrowed = 500): PositionSnapshot => ({
      id: `snap-${timestamp}`,
      walletAddress: wallet,
      timestamp,
      supplied,
      borrowed,
      effectiveSupplyApy: 2.5,
      effectiveBorrowApy: 8.5,
      createdAt: timestamp,
    });

    it('returns empty array for empty snapshots', () => {
      const result = bucketSnapshots([], baseTime, baseTime + 86400000, '1d');
      expect(result).toEqual([]);
    });

    it('filters snapshots outside requested range', () => {
      const snapshots = [
        createSnapshot(baseTime - 100000),
        createSnapshot(baseTime + 10000),
        createSnapshot(baseTime + 100000),
        createSnapshot(baseTime + 1000000),
      ];

      const result = bucketSnapshots(
        snapshots,
        baseTime,
        baseTime + 200000,
        '1d'
      );

      // Both baseTime + 10000 and baseTime + 100000 fall in the same 1d bucket
      // so only the first one is returned
      expect(result.length).toBe(1);
      expect(result[0].timestamp).toBeGreaterThanOrEqual(baseTime);
      expect(result[result.length - 1].timestamp).toBeLessThanOrEqual(baseTime + 200000);
    });

    it('returns first snapshot of each 1d bucket', () => {
      const dayMs = 24 * 60 * 60 * 1000;
      const snapshots = [
        createSnapshot(baseTime, 1000),
        createSnapshot(baseTime + 1000, 1100), // same day
        createSnapshot(baseTime + dayMs + 1000, 1200), // next day
        createSnapshot(baseTime + dayMs * 2 + 1000, 1300), // day after
      ];

      const result = bucketSnapshots(snapshots, baseTime, baseTime + dayMs * 3, '1d');

      expect(result.length).toBe(3);
      expect(result[0].supplied).toBe(1000); // First of first bucket
      expect(result[1].supplied).toBe(1200); // First of second bucket
      expect(result[2].supplied).toBe(1300); // First of third bucket
    });

    it('handles 1h bucketing correctly', () => {
      const hourMs = 60 * 60 * 1000;
      const snapshots = [
        createSnapshot(baseTime),
        createSnapshot(baseTime + hourMs + 1000),
        createSnapshot(baseTime + hourMs * 2 + 1000),
      ];

      const result = bucketSnapshots(
        snapshots,
        baseTime,
        baseTime + hourMs * 3,
        '1h'
      );

      expect(result.length).toBe(3);
    });

    it('handles 7d bucketing correctly', () => {
      const dayMs = 24 * 60 * 60 * 1000;
      const weekMs = dayMs * 7;
      const snapshots = [
        createSnapshot(baseTime),
        createSnapshot(baseTime + dayMs * 3),
        createSnapshot(baseTime + weekMs + dayMs),
        createSnapshot(baseTime + weekMs * 2),
      ];

      const result = bucketSnapshots(snapshots, baseTime, baseTime + weekMs * 3, '7d');

      expect(result.length).toBe(3);
    });

    it('sorts results by timestamp', () => {
      const snapshots = [
        createSnapshot(baseTime + 200000),
        createSnapshot(baseTime),
        createSnapshot(baseTime + 100000),
      ];

      const result = bucketSnapshots(snapshots, baseTime, baseTime + 300000, '1d');

      for (let i = 1; i < result.length; i++) {
        expect(result[i].timestamp).toBeGreaterThanOrEqual(result[i - 1].timestamp);
      }
    });
  });

  describe('aggregateSnapshotsInBucket', () => {
    const wallet = 'GBTEST';

    const createSnapshot = (supplied: number, borrowed: number): PositionSnapshot => ({
      id: `snap-${Date.now()}`,
      walletAddress: wallet,
      timestamp: Date.now(),
      supplied,
      borrowed,
      effectiveSupplyApy: 2.5,
      effectiveBorrowApy: 8.5,
      createdAt: Date.now(),
    });

    it('returns zero values for empty array', () => {
      const result = aggregateSnapshotsInBucket([]);
      expect(result.supplied).toBe(0);
      expect(result.borrowed).toBe(0);
      expect(result.effectiveSupplyApy).toBe(0);
      expect(result.effectiveBorrowApy).toBe(0);
    });

    it('returns exact values for single snapshot', () => {
      const snapshot = createSnapshot(1000, 500);
      const result = aggregateSnapshotsInBucket([snapshot]);
      expect(result.supplied).toBe(1000);
      expect(result.borrowed).toBe(500);
    });

    it('calculates averages correctly', () => {
      const snapshots = [
        createSnapshot(1000, 500),
        createSnapshot(3000, 700),
      ];
      const result = aggregateSnapshotsInBucket(snapshots);
      expect(result.supplied).toBe(2000); // (1000 + 3000) / 2
      expect(result.borrowed).toBe(600); // (500 + 700) / 2
    });

    it('handles multiple snapshots', () => {
      const snapshots = [
        createSnapshot(100, 50),
        createSnapshot(200, 100),
        createSnapshot(300, 150),
        createSnapshot(400, 200),
      ];
      const result = aggregateSnapshotsInBucket(snapshots);
      expect(result.supplied).toBe(250); // (100+200+300+400)/4
      expect(result.borrowed).toBe(125); // (50+100+150+200)/4
    });
  });

  describe('generateMockSnapshots', () => {
    const wallet = 'GBTEST';
    const from = 1700000000000;
    const to = 1702592000000; // ~30 days later

    it('generates correct number of snapshots', () => {
      const count = 30;
      const snapshots = generateMockSnapshots(wallet, from, to, count);
      expect(snapshots.length).toBe(count);
    });

    it('distributes timestamps across range', () => {
      const snapshots = generateMockSnapshots(wallet, from, to, 50);
      expect(snapshots[0].timestamp).toBeGreaterThanOrEqual(from);
      expect(snapshots[snapshots.length - 1].timestamp).toBeLessThanOrEqual(to);
    });

    it('generates increasing timestamps', () => {
      const snapshots = generateMockSnapshots(wallet, from, to, 50);
      for (let i = 1; i < snapshots.length; i++) {
        expect(snapshots[i].timestamp).toBeGreaterThanOrEqual(snapshots[i - 1].timestamp);
      }
    });

    it('sets wallet address correctly', () => {
      const snapshots = generateMockSnapshots(wallet, from, to, 10);
      for (const snapshot of snapshots) {
        expect(snapshot.walletAddress).toBe(wallet);
      }
    });

    it('generates positive balances', () => {
      const snapshots = generateMockSnapshots(wallet, from, to, 50);
      for (const snapshot of snapshots) {
        expect(snapshot.supplied).toBeGreaterThan(0);
        expect(snapshot.borrowed).toBeGreaterThanOrEqual(0);
      }
    });

    it('generates realistic APY values', () => {
      const snapshots = generateMockSnapshots(wallet, from, to, 50);
      for (const snapshot of snapshots) {
        expect(snapshot.effectiveSupplyApy).toBeGreaterThanOrEqual(0);
        expect(snapshot.effectiveBorrowApy).toBeGreaterThanOrEqual(0);
        expect(snapshot.effectiveSupplyApy).toBeLessThan(20); // Realistic bound
        expect(snapshot.effectiveBorrowApy).toBeLessThan(50); // Realistic bound
      }
    });

    it('generates unique IDs', () => {
      const snapshots = generateMockSnapshots(wallet, from, to, 50);
      const ids = new Set(snapshots.map((s) => s.id));
      expect(ids.size).toBe(snapshots.length);
    });

    it('uses default count of 90', () => {
      const snapshots = generateMockSnapshots(wallet, from, to);
      expect(snapshots.length).toBe(90);
    });
  });
});
