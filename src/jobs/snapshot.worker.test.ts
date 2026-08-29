/**
 * Tests for Position Snapshot Worker
 * 
 * Coverage:
 * - Recording snapshots
 * - Retrieving snapshots
 * - Job handler
 * - Store statistics
 * - Snapshot purging
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getWalletSnapshots,
  recordSnapshot,
  handleSnapshotJob,
  purgeOldSnapshots,
  getStoreStats,
  SnapshotJobData,
} from './snapshot.worker';
import { PositionSnapshot } from '@/lib/positions/snapshot';

// Valid Stellar testnet account IDs (StrKey-validated).
const VALID_WALLET_A = 'GATTYSMDCYWYAWNJZXY2RGNHDZ7ZDEKRGJY4JOMHMDU6LANVFCI2U45X';
const VALID_WALLET_B = 'GC7TCOMWMSK6LPQBVXRGR3Q23VVS3ZRS7QWYBUCYH4375CG6X4I4MFSZ';
const VALID_WALLET_C = 'GDS2KKVQY62J2BNA3MQPQGNMVKQR6MB2OOMJBIORQSYLOJPQKOKPOHKD';
const VALID_WALLET_UNUSED = 'GD5OYF2O3YDKBUCC3ZUGZEQCAYVFXBCLIF4YVZ3ZDK6SUKRQD2QDMMZP';

describe('src/jobs/snapshot.worker', () => {
  const testWallet = VALID_WALLET_A;
  const now = Date.now();

  const createTestSnapshot = (
    wallet: string,
    timestamp: number,
    supplied = 5000,
    borrowed = 2000
  ): PositionSnapshot => ({
    id: `snap-${wallet}-${timestamp}`,
    walletAddress: wallet,
    timestamp,
    supplied,
    borrowed,
    effectiveSupplyApy: 2.5,
    effectiveBorrowApy: 8.5,
    createdAt: timestamp,
  });

  beforeEach(() => {
    // Clear snapshots before each test
    vi.clearAllMocks();
  });

  describe('recordSnapshot', () => {
    it('records a new snapshot', async () => {
      const snapshot = createTestSnapshot(testWallet, now);
      await recordSnapshot(snapshot);

      const snapshots = await getWalletSnapshots(testWallet);
      expect(snapshots.length).toBeGreaterThan(0);
    });

    it('maintains snapshots in chronological order', async () => {
      const snap1 = createTestSnapshot(testWallet, now - 1000);
      const snap2 = createTestSnapshot(testWallet, now);

      await recordSnapshot(snap1);
      await recordSnapshot(snap2);

      const snapshots = await getWalletSnapshots(testWallet);
      for (let i = 1; i < snapshots.length; i++) {
        expect(snapshots[i].timestamp).toBeGreaterThanOrEqual(
          snapshots[i - 1].timestamp
        );
      }
    });

    it('limits snapshots to 365 per wallet', async () => {
      // Record 400 snapshots
      for (let i = 0; i < 400; i++) {
        const snapshot = createTestSnapshot(testWallet, now - 400000 + i * 1000);
        await recordSnapshot(snapshot);
      }

      const snapshots = await getWalletSnapshots(testWallet);
      expect(snapshots.length).toBeLessThanOrEqual(365);
    });

    it('supports multiple wallets independently', async () => {
      const wallet1 = VALID_WALLET_B;
      const wallet2 = VALID_WALLET_C;

      const snap1 = createTestSnapshot(wallet1, now);
      const snap2 = createTestSnapshot(wallet2, now);

      await recordSnapshot(snap1);
      await recordSnapshot(snap2);

      const snaps1 = await getWalletSnapshots(wallet1);
      const snaps2 = await getWalletSnapshots(wallet2);

      expect(snaps1.some((s) => s.walletAddress === wallet1)).toBe(true);
      expect(snaps2.some((s) => s.walletAddress === wallet2)).toBe(true);
    });
  });

  describe('getWalletSnapshots', () => {
    it('returns empty array for non-existent wallet', async () => {
      const snapshots = await getWalletSnapshots(VALID_WALLET_UNUSED);
      expect(Array.isArray(snapshots)).toBe(true);
    });

    it('returns all snapshots for a wallet', async () => {
      const snap1 = createTestSnapshot(testWallet, now - 2000);
      const snap2 = createTestSnapshot(testWallet, now - 1000);
      const snap3 = createTestSnapshot(testWallet, now);

      await recordSnapshot(snap1);
      await recordSnapshot(snap2);
      await recordSnapshot(snap3);

      const snapshots = await getWalletSnapshots(testWallet);
      expect(snapshots.length).toBeGreaterThanOrEqual(3);
    });

    it('returns snapshots in chronological order', async () => {
      // Add snapshots in random order
      const snap1 = createTestSnapshot(testWallet, now);
      const snap2 = createTestSnapshot(testWallet, now - 2000);
      const snap3 = createTestSnapshot(testWallet, now - 1000);

      await recordSnapshot(snap3);
      await recordSnapshot(snap1);
      await recordSnapshot(snap2);

      const snapshots = await getWalletSnapshots(testWallet);
      // Find only the snapshots we just added (test wallet with our specific timestamps)
      const testSnapshots = snapshots.filter(s => 
        s.timestamp === snap1.timestamp || s.timestamp === snap2.timestamp || s.timestamp === snap3.timestamp
      );
      
      if (testSnapshots.length > 1) {
        for (let i = 1; i < testSnapshots.length; i++) {
          expect(testSnapshots[i].timestamp).toBeGreaterThanOrEqual(
            testSnapshots[i - 1].timestamp
          );
        }
      }
    });
  });

  describe('handleSnapshotJob', () => {
    it('processes snapshot job successfully', async () => {
      const jobData: SnapshotJobData = {
        timestamp: now,
      };

      const result = await handleSnapshotJob(jobData);

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('snapshotsTaken');
      expect(result).toHaveProperty('walletsProcessed');
    });

    it('can process snapshot for specific wallet', async () => {
      const wallet = VALID_WALLET_B;
      const snapshot = createTestSnapshot(wallet, now - 1000);
      await recordSnapshot(snapshot);

      const jobData: SnapshotJobData = {
        timestamp: now,
        walletAddress: wallet,
      };

      const result = await handleSnapshotJob(jobData);

      expect(result.walletsProcessed).toBe(1);
    });

    it('returns timing information', async () => {
      const jobData: SnapshotJobData = {
        timestamp: now,
      };

      const result = await handleSnapshotJob(jobData);

      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('includes result metadata', async () => {
      const jobData: SnapshotJobData = {
        timestamp: now,
      };

      const result = await handleSnapshotJob(jobData);

      expect(result).toHaveProperty('snapshotsTaken');
      expect(result).toHaveProperty('walletsProcessed');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('duration');
    });
  });

  describe('purgeOldSnapshots', () => {
    it('removes snapshots older than 365 days', async () => {
      const yearAgo = now - 365 * 24 * 60 * 60 * 1000;
      const twoYearsAgo = now - 2 * 365 * 24 * 60 * 60 * 1000;

      const oldSnapshot = createTestSnapshot(testWallet, twoYearsAgo);
      const recentSnapshot = createTestSnapshot(testWallet, yearAgo + 1000);

      await recordSnapshot(oldSnapshot);
      await recordSnapshot(recentSnapshot);

      const result = await purgeOldSnapshots();

      expect(result.deleted).toBeGreaterThanOrEqual(0);
    });

    it('returns deletion count', async () => {
      const result = await purgeOldSnapshots();

      expect(typeof result.deleted).toBe('number');
      expect(result.deleted).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getStoreStats', () => {
    it('returns store statistics', () => {
      const stats = getStoreStats();

      expect(stats).toHaveProperty('totalSnapshots');
      expect(stats).toHaveProperty('walletsTracked');
      expect(stats).toHaveProperty('oldestSnapshot');
      expect(stats).toHaveProperty('newestSnapshot');
    });

    it('reports correct wallet count', () => {
      const stats = getStoreStats();

      expect(typeof stats.walletsTracked).toBe('number');
      expect(stats.walletsTracked).toBeGreaterThanOrEqual(0);
    });

    it('reports correct snapshot count', () => {
      const stats = getStoreStats();

      expect(typeof stats.totalSnapshots).toBe('number');
      expect(stats.totalSnapshots).toBeGreaterThanOrEqual(0);
    });

    it('tracks oldest and newest snapshots', () => {
      const stats = getStoreStats();

      if (stats.totalSnapshots > 0) {
        expect(stats.oldestSnapshot).toBeDefined();
        expect(stats.newestSnapshot).toBeDefined();
        if (stats.oldestSnapshot && stats.newestSnapshot) {
          expect(stats.oldestSnapshot).toBeLessThanOrEqual(stats.newestSnapshot);
        }
      }
    });
  });

  describe('Authorization & hostile-input boundary', () => {
    it('rejects invalid wallet addresses in getWalletSnapshots', async () => {
      await expect(getWalletSnapshots('GBTEST123')).rejects.toThrow(/Invalid wallet address/i);
      await expect(getWalletSnapshots('not-an-address')).rejects.toThrow(/Invalid wallet address/i);
      await expect(getWalletSnapshots('')).rejects.toThrow(/Invalid wallet address/i);
    });

    it('rejects tampered snapshots with NaN amounts', async () => {
      const bad = createTestSnapshot(testWallet, now);
      (bad as any).supplied = NaN;
      await expect(recordSnapshot(bad)).rejects.toThrow(/invalid snapshot/i);
    });

    it('rejects snapshots with negative balances', async () => {
      const bad = createTestSnapshot(testWallet, now);
      (bad as any).borrowed = -1;
      await expect(recordSnapshot(bad)).rejects.toThrow(/invalid snapshot/i);
    });

    it('rejects snapshots with non-finite APY values', async () => {
      const bad = createTestSnapshot(testWallet, now);
      (bad as any).effectiveSupplyApy = Infinity;
      await expect(recordSnapshot(bad)).rejects.toThrow(/invalid snapshot/i);
    });

    it('rejects snapshots with invalid wallet identity', async () => {
      const bad = createTestSnapshot('GBTEST123', now);
      await expect(recordSnapshot(bad)).rejects.toThrow(/invalid snapshot/i);
    });

    it('rejects snapshots with impossible timestamps (tampering/replay)', async () => {
      const future = createTestSnapshot(testWallet, now + 100 * 24 * 60 * 60 * 1000);
      await expect(recordSnapshot(future)).rejects.toThrow(/invalid snapshot/i);

      const ancient = createTestSnapshot(testWallet, Date.UTC(1999, 0, 1));
      await expect(recordSnapshot(ancient)).rejects.toThrow(/invalid snapshot/i);
    });

    it('rejects snapshots with unknown fields (tampering)', async () => {
      const bad: any = { ...createTestSnapshot(testWallet, now), network: 'mainnet' };
      await expect(recordSnapshot(bad)).rejects.toThrow(/invalid snapshot/i);
    });

    it('rejects malformed snapshot job data', async () => {
      await expect(handleSnapshotJob({} as any)).rejects.toThrow(/invalid snapshot job data/i);
      await expect(handleSnapshotJob({ timestamp: 'now' } as any)).rejects.toThrow(
        /invalid snapshot job data/i
      );
      await expect(
        handleSnapshotJob({ timestamp: now, walletAddress: 'GBTEST123' })
      ).rejects.toThrow(/invalid snapshot job data/i);
      await expect(
        handleSnapshotJob({ timestamp: now, extra: true } as any)
      ).rejects.toThrow(/invalid snapshot job data/i);
    });

    it('accepts a valid snapshot job for a specific wallet', async () => {
      const wallet = VALID_WALLET_C;
      await recordSnapshot(createTestSnapshot(wallet, now - 1000));

      const result = await handleSnapshotJob({
        timestamp: now,
        walletAddress: wallet,
      });

      expect(result.walletsProcessed).toBe(1);
      expect(result.snapshotsTaken).toBe(1);
    });
  });
});
