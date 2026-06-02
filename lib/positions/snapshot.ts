/**
 * Positions Snapshot Utilities
 *
 * This module provides utilities for managing historical position snapshots,
 * including data validation, bucketing by time intervals, and type definitions.
 */

import { z } from 'zod';

/**
 * Supported time intervals for grouping snapshots
 */
export const INTERVAL_OPTIONS = ['1h', '1d', '7d', '30d'] as const;
export type Interval = (typeof INTERVAL_OPTIONS)[number];

/**
 * Position snapshot record
 */
export interface PositionSnapshot {
  id: string;
  walletAddress: string;
  timestamp: number; // Unix timestamp (milliseconds)
  supplied: number; // Total supplied balance in USD
  borrowed: number; // Total borrowed balance in USD
  effectiveSupplyApy: number; // Weighted average supply APY (%)
  effectiveBorrowApy: number; // Weighted average borrow APY (%)
  createdAt: number; // Snapshot creation timestamp
}

/**
 * Response format for historical snapshots
 */
export interface SnapshotHistoryResponse {
  walletAddress: string;
  snapshots: Array<{
    timestamp: number;
    supplied: number;
    borrowed: number;
    effectiveSupplyApy: number;
    effectiveBorrowApy: number;
  }>;
  interval: Interval;
  bucketCount: number;
}

/**
 * Request query parameters validation schema
 */
export const PositionHistoryParamsSchema = z.object({
  from: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Start timestamp in milliseconds (default: 90 days ago)'),
  to: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('End timestamp in milliseconds (default: now)'),
  interval: z
    .enum(INTERVAL_OPTIONS)
    .default('1d')
    .describe('Bucketing interval: 1h, 1d, 7d, 30d'),
});

export type PositionHistoryParams = z.infer<typeof PositionHistoryParamsSchema>;

/**
 * Get interval duration in milliseconds
 */
export function getIntervalDuration(interval: Interval): number {
  const durations: Record<Interval, number> = {
    '1h': 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  return durations[interval];
}

/**
 * Validate and normalize query parameters
 * @throws ValidationError if parameters are invalid
 */
export function validateAndNormalizeParams(
  params: Record<string, unknown>
): PositionHistoryParams {
  const now = Date.now();
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

  const parsed = PositionHistoryParamsSchema.parse({
    from: params.from,
    to: params.to,
    interval: params.interval,
  });

  // Apply defaults
  const from = parsed.from ?? ninetyDaysAgo;
  const to = parsed.to ?? now;

  // Validate time range
  if (from >= to) {
    throw new Error('from must be earlier than to');
  }

  // Validate maximum range (365 days)
  const maxRange = 365 * 24 * 60 * 60 * 1000;
  if (to - from > maxRange) {
    throw new Error('time range cannot exceed 365 days');
  }

  return {
    from,
    to,
    interval: parsed.interval,
  };
}

/**
 * Bucket snapshots into time intervals
 * Returns the first snapshot of each bucket
 */
export function bucketSnapshots(
  snapshots: PositionSnapshot[],
  from: number,
  to: number,
  interval: Interval
): PositionSnapshot[] {
  if (snapshots.length === 0) {
    return [];
  }

  const intervalDuration = getIntervalDuration(interval);
  const sortedSnapshots = [...snapshots].sort(
    (a, b) => a.timestamp - b.timestamp
  );

  const buckets = new Map<number, PositionSnapshot>();

  for (const snapshot of sortedSnapshots) {
    // Skip snapshots outside the requested range
    if (snapshot.timestamp < from || snapshot.timestamp > to) {
      continue;
    }

    // Calculate bucket start time
    const bucketStart = Math.floor(snapshot.timestamp / intervalDuration) * intervalDuration;

    // Store the first snapshot of each bucket
    if (!buckets.has(bucketStart)) {
      buckets.set(bucketStart, snapshot);
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Calculate average metrics for snapshots in a time bucket
 * Useful for aggregating multiple snapshots into a single bucketed value
 */
export function aggregateSnapshotsInBucket(snapshots: PositionSnapshot[]): {
  supplied: number;
  borrowed: number;
  effectiveSupplyApy: number;
  effectiveBorrowApy: number;
} {
  if (snapshots.length === 0) {
    return {
      supplied: 0,
      borrowed: 0,
      effectiveSupplyApy: 0,
      effectiveBorrowApy: 0,
    };
  }

  const avgSupplied = snapshots.reduce((sum, s) => sum + s.supplied, 0) / snapshots.length;
  const avgBorrowed = snapshots.reduce((sum, s) => sum + s.borrowed, 0) / snapshots.length;
  const avgSupplyApy =
    snapshots.reduce((sum, s) => sum + s.effectiveSupplyApy, 0) / snapshots.length;
  const avgBorrowApy =
    snapshots.reduce((sum, s) => sum + s.effectiveBorrowApy, 0) / snapshots.length;

  return {
    supplied: avgSupplied,
    borrowed: avgBorrowed,
    effectiveSupplyApy: avgSupplyApy,
    effectiveBorrowApy: avgBorrowApy,
  };
}

/**
 * Generate mock snapshots for a wallet within a time range
 * Used for testing and demo purposes until database is set up
 */
export function generateMockSnapshots(
  walletAddress: string,
  from: number,
  to: number,
  count: number = 90
): PositionSnapshot[] {
  const snapshots: PositionSnapshot[] = [];
  const interval = (to - from) / (count - 1);

  for (let i = 0; i < count; i++) {
    const timestamp = Math.round(from + i * interval);

    // Generate realistic varying data
    const volatility = 0.15; // 15% variation
    const baseSupplied = 5000 + Math.sin(i / 10) * 1000;
    const baseBorrowed = 2000 + Math.cos(i / 15) * 500;
    const supplyApy = 2.5 + Math.random() * volatility;
    const borrowApy = 8.5 + Math.random() * volatility;

    snapshots.push({
      id: `snapshot-${walletAddress}-${timestamp}`,
      walletAddress,
      timestamp,
      supplied: Math.max(100, baseSupplied + Math.random() * 500 - 250),
      borrowed: Math.max(0, baseBorrowed + Math.random() * 200 - 100),
      effectiveSupplyApy: Math.max(0, supplyApy),
      effectiveBorrowApy: Math.max(0, borrowApy),
      createdAt: timestamp,
    });
  }

  return snapshots;
}
