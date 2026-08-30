/**
 * Position snapshot validation.
 *
 * Enforces wallet identity, numeric, and timestamp invariants at the boundary
 * for the positions snapshot worker and its API consumers. Inputs that fail
 * these checks (invalid Stellar account IDs, NaN/Infinity amounts, negative
 * balances, impossible timestamps, or unknown fields) are treated as tampered
 * or malformed responses and rejected rather than stored or served.
 */

import { z } from 'zod';
import { isAccountId } from '@/lib/validation/stellar';

export const MAX_SNAPSHOT_ID_LENGTH = 128;
/** Sanity cap for supplied/borrowed balances in USD — catches tampered values. */
export const MAX_AMOUNT = 1e15;
/** APYs outside this range indicate corrupted/tampered data. */
export const MAX_APY = 1000;
export const MIN_TIMESTAMP = Date.UTC(2000, 0, 1);
/** Tolerated clock skew for snapshot timestamps (snapshots cannot be far in the future). */
export const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

const walletAddressSchema = z
  .string()
  .refine((address) => isAccountId(address), 'invalid Stellar account ID (expected G...)');

const timestampSchema = z
  .number()
  .int('timestamp must be an integer')
  .positive('timestamp must be positive')
  .refine((t) => t >= MIN_TIMESTAMP, 'timestamp predates 2000-01-01')
  .refine((t) => t <= Date.now() + MAX_FUTURE_SKEW_MS, 'timestamp is too far in the future');

const amountSchema = z
  .number()
  .finite('amount must be finite')
  .nonnegative('amount must be non-negative')
  .max(MAX_AMOUNT, `amount exceeds ${MAX_AMOUNT}`);

const apySchema = z
  .number()
  .finite('APY must be finite')
  .refine((v) => v >= -MAX_APY && v <= MAX_APY, `APY outside [-${MAX_APY}, ${MAX_APY}]`);

/**
 * Strict schema for position snapshot records. `.strict()` rejects unknown
 * fields so tampered records cannot carry extra data into the store.
 */
export const PositionSnapshotSchema = z
  .object({
    id: z
      .string()
      .min(1, 'id must be a non-empty string')
      .max(MAX_SNAPSHOT_ID_LENGTH, `id exceeds ${MAX_SNAPSHOT_ID_LENGTH} characters`),
    walletAddress: walletAddressSchema,
    timestamp: timestampSchema,
    supplied: amountSchema,
    borrowed: amountSchema,
    effectiveSupplyApy: apySchema,
    effectiveBorrowApy: apySchema,
    createdAt: timestampSchema,
  })
  .strict();

export type ValidatedPositionSnapshot = z.infer<typeof PositionSnapshotSchema>;

/**
 * Strict schema for snapshot worker job data. Wallet addresses and timestamps
 * are validated before any work is performed so hostile/malformed jobs fail
 * loudly instead of producing garbage snapshots.
 */
export const SnapshotJobDataSchema = z
  .object({
    timestamp: timestampSchema,
    walletAddress: walletAddressSchema.optional(),
  })
  .strict();

export type ValidatedSnapshotJobData = z.infer<typeof SnapshotJobDataSchema>;

export class SnapshotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotValidationError';
  }
}

/**
 * Asserts that `walletAddress` is a valid Stellar account ID, throwing a
 * {@link SnapshotValidationError} otherwise.
 */
export function assertValidWalletAddress(walletAddress: unknown): asserts walletAddress is string {
  if (typeof walletAddress !== 'string' || !isAccountId(walletAddress)) {
    throw new SnapshotValidationError(
      'Invalid wallet address: expected a valid Stellar account ID (G...)'
    );
  }
}

/**
 * Parses and validates a position snapshot record at the boundary.
 * Throws {@link SnapshotValidationError} on any violation.
 */
export function parsePositionSnapshot(raw: unknown): ValidatedPositionSnapshot {
  const result = PositionSnapshotSchema.safeParse(raw);
  if (!result.success) {
    throw new SnapshotValidationError(
      `invalid snapshot: ${result.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ')}`
    );
  }
  return result.data;
}

/**
 * Parses and validates snapshot job data at the boundary.
 * Throws {@link SnapshotValidationError} on any violation.
 */
export function parseSnapshotJobData(raw: unknown): ValidatedSnapshotJobData {
  const result = SnapshotJobDataSchema.safeParse(raw);
  if (!result.success) {
    throw new SnapshotValidationError(
      `invalid snapshot job data: ${result.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ')}`
    );
  }
  return result.data;
}
