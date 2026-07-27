/**
 * Positions Snapshot Worker
 *
 * This worker is responsible for generating daily snapshots of user positions.
 * It runs as a scheduled job (BullMQ) and stores snapshots in the database.
 *
 * In production, this would be enqueued via:
 * ```
 * const job = await snapshotQueue.add(
 *   'daily-snapshot',
 *   { timestamp: Date.now() },
 *   { repeat: { pattern: '0 0 * * *' } } // Daily at midnight UTC
 * );
 * ```
 */

import { PositionSnapshot, generateMockSnapshots } from '@/lib/positions/snapshot';
import { logger } from '@/lib/logger';

/**
 * In-memory store for position snapshots
 * In production, replace with database queries (Drizzle/PostgreSQL)
 */
const snapshotStore = new Map<string, PositionSnapshot[]>();

/**
 * Initialize snapshot store with sample data for demo purposes
 * In production, this would query the database
 */
function initializeStore(): void {
  if (snapshotStore.size > 0) return;

  // Generate mock data for common demo wallets
  const demoWallets = [
    'GBBD47UZQ5STVBDFRBGC5VMIIXC3YPXIXXLWHQK44SLSQASBQU5YRPY',
    'GAILQ7XLMZQJ2AZSQKNXSGX2JSQXGMTZEFNQLWVMVXSYFXTXWCZVDCA',
    'GA7NQHQE4P4TAQLLNKWQHQGJ42B3RFXXQZ3RDBX2QKHZGN7T62XQHDE',
  ];

  const now = Date.now();
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

  for (const wallet of demoWallets) {
    const snapshots = generateMockSnapshots(wallet, ninetyDaysAgo, now, 90);
    snapshotStore.set(wallet, snapshots);
  }

  logger.info('snapshot store initialized', '/jobs/snapshot.worker.ts', {
    walletCount: demoWallets.length,
    snapshotsPerWallet: 90,
  });
}

/**
 * Get all snapshots for a wallet
 */
export async function getWalletSnapshots(walletAddress: string): Promise<PositionSnapshot[]> {
  initializeStore();
  return snapshotStore.get(walletAddress) || [];
}

/**
 * Record a new position snapshot for a wallet
 * Called by the daily snapshot job
 */
export async function recordSnapshot(snapshot: PositionSnapshot): Promise<void> {
  initializeStore();

  const walletSnapshots = snapshotStore.get(snapshot.walletAddress) || [];
  walletSnapshots.push(snapshot);

  // Keep sorted by timestamp
  walletSnapshots.sort((a, b) => a.timestamp - b.timestamp);

  // Keep only the last 365 snapshots per wallet
  if (walletSnapshots.length > 365) {
    walletSnapshots.splice(0, walletSnapshots.length - 365);
  }

  snapshotStore.set(snapshot.walletAddress, walletSnapshots);

  logger.info('snapshot recorded', '/jobs/snapshot.worker.ts', {
    walletAddress: snapshot.walletAddress,
    timestamp: snapshot.timestamp,
    supplied: snapshot.supplied,
    borrowed: snapshot.borrowed,
  });
}

/**
 * Main worker handler
 * This function is invoked by BullMQ for each job
 *
 * In production flow:
 * 1. Job is triggered (manually or on schedule)
 * 2. Fetch current positions for all wallets from smart contract or indexer
 * 3. Calculate effective APYs from market data
 * 4. Record snapshots in database
 * 5. Return job result
 */
export interface SnapshotJobData {
  timestamp: number;
  walletAddress?: string; // Optional: if provided, snapshot only this wallet
}

export interface SnapshotJobResult {
  snapshotsTaken: number;
  walletsProcessed: number;
  timestamp: number;
  duration: number;
}

export async function handleSnapshotJob(jobData: SnapshotJobData): Promise<SnapshotJobResult> {
  const startTime = Date.now();
  const now = Date.now();

  initializeStore();

  let snapshotsTaken = 0;
  const walletsToProcess = jobData.walletAddress
    ? [jobData.walletAddress]
    : Array.from(snapshotStore.keys());

  try {
    for (const walletAddress of walletsToProcess) {
      // In production:
      // 1. Fetch positions from smart contract
      // 2. Fetch market data for APY calculations
      // 3. Create PositionSnapshot record
      // 4. Insert into database

      // For now, generate a mock snapshot
      const existingSnapshots = await getWalletSnapshots(walletAddress);
      if (existingSnapshots.length > 0) {
        const lastSnapshot = existingSnapshots[existingSnapshots.length - 1];

        // Create a new snapshot with slightly varied data
        const newSnapshot: PositionSnapshot = {
          id: `snapshot-${walletAddress}-${now}`,
          walletAddress,
          timestamp: now,
          supplied: lastSnapshot.supplied * (0.95 + Math.random() * 0.1),
          borrowed: lastSnapshot.borrowed * (0.95 + Math.random() * 0.1),
          effectiveSupplyApy: lastSnapshot.effectiveSupplyApy + (Math.random() - 0.5) * 0.2,
          effectiveBorrowApy: lastSnapshot.effectiveBorrowApy + (Math.random() - 0.5) * 0.2,
          createdAt: now,
        };

        await recordSnapshot(newSnapshot);
        snapshotsTaken++;
      }
    }

    const duration = Date.now() - startTime;

    logger.info('snapshot job completed', '/jobs/snapshot.worker.ts', {
      snapshotsTaken,
      walletsProcessed: walletsToProcess.length,
      duration,
    });

    return {
      snapshotsTaken,
      walletsProcessed: walletsToProcess.length,
      timestamp: now,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('snapshot job failed', '/jobs/snapshot.worker.ts', {
      error: error instanceof Error ? error.message : String(error),
      duration,
    });
    throw error;
  }
}

/**
 * Purge old snapshots (older than 365 days)
 * Can be called as a maintenance job
 */
export async function purgeOldSnapshots(): Promise<{ deleted: number }> {
  const cutoffTime = Date.now() - 365 * 24 * 60 * 60 * 1000;
  let deleted = 0;

  for (const [wallet, snapshots] of snapshotStore.entries()) {
    const filtered = snapshots.filter((s) => s.timestamp > cutoffTime);
    const removedCount = snapshots.length - filtered.length;
    deleted += removedCount;

    if (filtered.length === 0) {
      snapshotStore.delete(wallet);
    } else {
      snapshotStore.set(wallet, filtered);
    }
  }

  logger.info('old snapshots purged', '/jobs/snapshot.worker.ts', { deleted });
  return { deleted };
}

/**
 * Get statistics about the snapshot store
 * Useful for monitoring
 */
export function getStoreStats(): {
  totalSnapshots: number;
  walletsTracked: number;
  oldestSnapshot?: number;
  newestSnapshot?: number;
} {
  initializeStore();

  let totalSnapshots = 0;
  let oldestSnapshot: number | undefined;
  let newestSnapshot: number | undefined;

  for (const snapshots of snapshotStore.values()) {
    totalSnapshots += snapshots.length;
    if (snapshots.length > 0) {
      const first = snapshots[0].timestamp;
      const last = snapshots[snapshots.length - 1].timestamp;
      oldestSnapshot = oldestSnapshot ? Math.min(oldestSnapshot, first) : first;
      newestSnapshot = newestSnapshot ? Math.max(newestSnapshot, last) : last;
    }
  }

  return {
    totalSnapshots,
    walletsTracked: snapshotStore.size,
    oldestSnapshot,
    newestSnapshot,
  };
}
