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
 *
 * Boundary invariants (enforced via `lib/validation/snapshots.ts`):
 * - Wallet identity: every wallet address must be a valid Stellar account ID.
 * - Numeric values: supplied/borrowed must be finite non-negative amounts and
 *   APYs must be finite within a sane range (NaN/Infinity/tampered values are
 *   rejected).
 * - Timestamps must be positive integers within a plausible range.
 * - Job data and snapshot records are parsed strictly: unknown fields are
 *   treated as tampering and rejected.
 */

import { PositionSnapshot, generateMockSnapshots } from '@/lib/positions/snapshot';
import { logger } from '@/lib/logger';
import {
  assertValidWalletAddress,
  parsePositionSnapshot,
  parseSnapshotJobData,
  SnapshotValidationError,
} from '@/lib/validation/snapshots';

const ROUTE = '/jobs/snapshot.worker.ts';

export const MAX_SNAPSHOTS_PER_WALLET = 365;
export const SNAPSHOT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * In-memory store for position snapshots
 * In production, replace with database queries (Drizzle/PostgreSQL)
 */
const snapshotStore = new Map<string, PositionSnapshot[]>();

/**
 * Valid Stellar testnet account IDs used to seed the demo store.
 */
const DEMO_WALLETS = [
  'GC7TCOMWMSK6LPQBVXRGR3Q23VVS3ZRS7QWYBUCYH4375CG6X4I4MFSZ',
  'GDS2KKVQY62J2BNA3MQPQGNMVKQR6MB2OOMJBIORQSYLOJPQKOKPOHKD',
  'GAAI6S3WG746MDGDTNYQ2VNL2DAOUS2FCH4H4MV23H7NQSZANN6KMQT6',
];

/**
 * Initialize snapshot store with sample data for demo purposes
 * In production, this would query the database
 */
function initializeStore(): void {
  if (snapshotStore.size > 0) return;

  const now = Date.now();
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

  for (const wallet of DEMO_WALLETS) {
    const snapshots = generateMockSnapshots(wallet, ninetyDaysAgo, now, 90);
    snapshotStore.set(wallet, snapshots);
  }

  logger.info('snapshot store initialized', ROUTE, {
    walletCount: DEMO_WALLETS.length,
    snapshotsPerWallet: 90,
  });
}

/**
 * Get all snapshots for a wallet
 *
 * The wallet address is validated at the boundary; malformed identities are
 * rejected rather than silently returning data.
 */
export async function getWalletSnapshots(walletAddress: string): Promise<PositionSnapshot[]> {
  assertValidWalletAddress(walletAddress);
  initializeStore();
  return snapshotStore.get(walletAddress) || [];
}

/**
 * Record a new position snapshot for a wallet
 * Called by the daily snapshot job
 *
 * The snapshot record is validated at the boundary so tampered or malformed
 * records (NaN, negative balances, invalid wallets, unknown fields) are
 * rejected instead of polluting the store.
 */
export async function recordSnapshot(snapshot: PositionSnapshot): Promise<void> {
  const validated = parsePositionSnapshot(snapshot);
  initializeStore();

  const walletSnapshots = snapshotStore.get(validated.walletAddress) || [];
  walletSnapshots.push(validated);

  // Keep sorted by timestamp
  walletSnapshots.sort((a, b) => a.timestamp - b.timestamp);

  // Keep only the last 365 snapshots per wallet
  if (walletSnapshots.length > MAX_SNAPSHOTS_PER_WALLET) {
    walletSnapshots.splice(0, walletSnapshots.length - MAX_SNAPSHOTS_PER_WALLET);
  }

  snapshotStore.set(validated.walletAddress, walletSnapshots);

  logger.info('snapshot recorded', ROUTE, {
    walletAddress: validated.walletAddress,
    timestamp: validated.timestamp,
    supplied: validated.supplied,
    borrowed: validated.borrowed,
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

  // Boundary: validate the job payload (timestamp, optional wallet identity,
  // and unknown-field rejection) before performing any work. Hostile or
  // malformed job data fails loudly instead of producing garbage snapshots.
  let validatedJobData;
  try {
    validatedJobData = parseSnapshotJobData(jobData);
  } catch (error) {
    logger.error('snapshot job rejected invalid data', ROUTE, {
      error: error instanceof SnapshotValidationError ? error.message : String(error),
    });
    throw error;
  }

  const now = validatedJobData.timestamp;
  initializeStore();

  let snapshotsTaken = 0;
  const walletsToProcess = validatedJobData.walletAddress
    ? [validatedJobData.walletAddress]
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

    logger.info('snapshot job completed', ROUTE, {
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
    logger.error('snapshot job failed', ROUTE, {
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
  const cutoffTime = Date.now() - SNAPSHOT_RETENTION_MS;
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

  logger.info('old snapshots purged', ROUTE, { deleted });
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
