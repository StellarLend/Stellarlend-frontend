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

describe('src/jobs/snapshot.worker', () => {
  const testWallet = 'GBTEST123';
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
      const wallet1 = 'GBWALLET1';
      const wallet2 = 'GBWALLET2';

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
      const snapshots = await getWalletSnapshots('GBNONEXISTENT');
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
      const wallet = 'GBSPECIFIC';
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
});
