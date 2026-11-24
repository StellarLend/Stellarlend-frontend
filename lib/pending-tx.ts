/**
 * Persistent pending-transaction store.
 *
 * Writes one record per submitted transaction to localStorage immediately
 * after a Soroban hash is returned and before polling starts.  On reload, any
 * record still in "pending" status can be resumed.
 *
 * Storage layout (v1):
 *   Key:   stellarlend-pending-tx:v1:<network>:<address>
 *   Value: { v: 1, txs: PendingTxEntry[] }
 *
 * Safety rules:
 *  - Storage unavailable or corrupt → no crash; feature silently degrades.
 *  - Different networks and addresses never share entries.
 *  - Entries older than PRUNE_AGE_MS (24 h) are pruned on every write/read.
 *  - A duplicate is defined as: same address + same action + same asset with
 *    any entry still in "pending" status.
 */

import type { LendingAction, LendingTxStatus } from "@/lib/lending-client";

// ─── constants ────────────────────────────────────────────────────────────────

export const PENDING_TX_VERSION = 1 as const;
export const PRUNE_AGE_MS = 24 * 60 * 60 * 1_000; // 24 hours

// ─── types ────────────────────────────────────────────────────────────────────

export type PendingTxEntry = {
  /** Transaction hash returned by sendTransaction. */
  hash: string;
  action: LendingAction;
  /** Asset symbol (e.g. "XLM"). */
  asset: string;
  /** Raw amount in base units as a decimal string (bigint-serialisable). */
  amount: string;
  /** Unix timestamp (ms) when sendTransaction returned the hash. */
  submittedAt: number;
  status: LendingTxStatus;
  /** Error message if status is "failed" or "timeout". */
  errorMessage?: string;
};

type StoredV1 = { v: 1; txs: PendingTxEntry[] };

// ─── storage key ─────────────────────────────────────────────────────────────

export function pendingTxStorageKey(network: string, address: string): string {
  return `stellarlend-pending-tx:v1:${network}:${address}`;
}

// ─── schema validation ────────────────────────────────────────────────────────

function isEntry(x: unknown): x is PendingTxEntry {
  if (typeof x !== "object" || x === null) return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.hash === "string" && e.hash.length > 0 &&
    typeof e.action === "string" &&
    typeof e.asset === "string" &&
    typeof e.amount === "string" &&
    typeof e.submittedAt === "number" &&
    typeof e.status === "string"
  );
}

function isStoredV1(data: unknown): data is StoredV1 {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return d.v === 1 && Array.isArray(d.txs);
}

// ─── pruning ─────────────────────────────────────────────────────────────────

function prune(entries: PendingTxEntry[], now = Date.now()): PendingTxEntry[] {
  return entries.filter((e) => now - e.submittedAt < PRUNE_AGE_MS);
}

// ─── safe localStorage helpers ───────────────────────────────────────────────

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Quota exceeded or storage unavailable — degrade silently.
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Load all entries for the given network+address combination, pruning stale
 * entries.  Returns an empty array when storage is unavailable or corrupt.
 */
export function loadPendingTxs(
  network: string,
  address: string,
  now = Date.now(),
): PendingTxEntry[] {
  const key = pendingTxStorageKey(network, address);
  const raw = safeGet(key);
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupt JSON — clear the slot and start fresh.
    safeRemove(key);
    return [];
  }

  if (!isStoredV1(parsed)) {
    safeRemove(key);
    return [];
  }

  // Filter out malformed entries before pruning.
  const valid = parsed.txs.filter(isEntry);
  return prune(valid, now);
}

/**
 * Persist the full entry list for a network+address combination.
 * Automatically prunes entries older than 24 h before writing.
 */
export function savePendingTxs(
  network: string,
  address: string,
  entries: PendingTxEntry[],
  now = Date.now(),
): void {
  const key = pendingTxStorageKey(network, address);
  const pruned = prune(entries, now);
  if (pruned.length === 0) {
    safeRemove(key);
    return;
  }
  const payload: StoredV1 = { v: PENDING_TX_VERSION, txs: pruned };
  safeSet(key, JSON.stringify(payload));
}

/**
 * Write a single new entry.  If an entry with the same hash already exists it
 * is replaced (idempotent).
 */
export function upsertPendingTx(
  network: string,
  address: string,
  entry: PendingTxEntry,
  now = Date.now(),
): void {
  const existing = loadPendingTxs(network, address, now);
  const without = existing.filter((e) => e.hash !== entry.hash);
  savePendingTxs(network, address, [...without, entry], now);
}

/**
 * Update status (and optionally errorMessage) for an entry identified by hash.
 * No-ops silently if the entry is not found.
 */
export function updatePendingTxStatus(
  network: string,
  address: string,
  hash: string,
  status: LendingTxStatus,
  errorMessage?: string,
  now = Date.now(),
): void {
  const existing = loadPendingTxs(network, address, now);
  const updated = existing.map((e) =>
    e.hash === hash ? { ...e, status, ...(errorMessage !== undefined ? { errorMessage } : {}) } : e,
  );
  savePendingTxs(network, address, updated, now);
}

/**
 * Remove a single entry by hash.
 */
export function removePendingTx(
  network: string,
  address: string,
  hash: string,
  now = Date.now(),
): void {
  const existing = loadPendingTxs(network, address, now);
  savePendingTxs(network, address, existing.filter((e) => e.hash !== hash), now);
}

/**
 * Returns true when there is already a pending entry for the same
 * address + action + asset combination — used to block duplicate submissions.
 */
export function hasDuplicatePending(
  network: string,
  address: string,
  action: LendingAction,
  asset: string,
  now = Date.now(),
): boolean {
  const entries = loadPendingTxs(network, address, now);
  return entries.some(
    (e) => e.status === "pending" && e.action === action && e.asset === asset,
  );
}
