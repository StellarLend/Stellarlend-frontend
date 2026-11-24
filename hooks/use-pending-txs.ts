"use client";
/**
 * usePendingTxs
 *
 * On mount (and whenever address/network changes):
 *  1. Loads pending entries from localStorage.
 *  2. Resumes polling for each entry that is still "pending".
 *  3. Updates storage + notifies the caller via onSettled() on terminal state.
 *
 * Also:
 *  - Syncs across browser tabs via the storage event.
 *  - Exposes hasDuplicatePending() so the trade flow can disable duplicate
 *    submissions.
 *  - Prunes entries older than 24 h on every load.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { rpc } from "@stellar/stellar-sdk";
import { config } from "@/lib/config";
import { getRpcServer, pollTransactionStatus } from "@/lib/rpc-tx";
import { decodeContractError } from "@/lib/errors/decode";
import {
  loadPendingTxs,
  savePendingTxs,
  upsertPendingTx,
  updatePendingTxStatus,
  hasDuplicatePending,
  pendingTxStorageKey,
  type PendingTxEntry,
} from "@/lib/pending-tx";
import type { LendingAction, LendingTxStatus } from "@/lib/lending-client";

// ─── types ────────────────────────────────────────────────────────────────────

export type SettledEntry = PendingTxEntry & {
  /** True if this entry was resumed from storage (not submitted in this session). */
  resumed: boolean;
};

export type UsePendingTxsOptions = {
  /** Stellar address of the connected wallet.  Pass null/undefined when disconnected. */
  address: string | null | undefined;
  /** Called each time a pending tx reaches a terminal state. */
  onSettled?: (entry: SettledEntry) => void;
};

export type UsePendingTxsReturn = {
  /** All in-memory entries (pruned, current session + resumed). */
  entries: PendingTxEntry[];
  /**
   * Write a new entry immediately after the hash is obtained and before the
   * poll loop starts.  Returns the entry so the caller can pass it to resume().
   */
  record: (entry: PendingTxEntry) => void;
  /**
   * Returns true when there is already a live "pending" entry for the same
   * action + asset — used to disable the submit button.
   */
  isDuplicate: (action: LendingAction, asset: string) => boolean;
  /** Remove a single entry (e.g. after the user acknowledges a failed tx). */
  remove: (hash: string) => void;
};

// ─── poll timeout — matches lending-client.ts ────────────────────────────────

const POLL_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 2_000;

// ─── hook ─────────────────────────────────────────────────────────────────────

export function usePendingTxs({
  address,
  onSettled,
}: UsePendingTxsOptions): UsePendingTxsReturn {
  const network = config.network;

  const [entries, setEntries] = useState<PendingTxEntry[]>([]);

  // Stable ref to onSettled so the polling loop never captures a stale closure.
  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  // Per-hash abort controllers so we can cancel polling when the component
  // unmounts or the address changes.
  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  // ── sync state from storage ──────────────────────────────────────────────

  const syncFromStorage = useCallback(() => {
    if (!address) {
      setEntries([]);
      return;
    }
    const loaded = loadPendingTxs(network, address);
    setEntries(loaded);
  }, [network, address]);

  // ── start polling for one entry ──────────────────────────────────────────

  const startPolling = useCallback(
    (entry: PendingTxEntry, resumed: boolean) => {
      if (!address) return;
      // Don't start a second loop if one is already running for this hash.
      if (controllersRef.current.has(entry.hash)) return;

      const ac = new AbortController();
      controllersRef.current.set(entry.hash, ac);

      const rpcServer = getRpcServer();

      // Calculate how much of the timeout is left for resumed entries.
      const elapsed = Date.now() - entry.submittedAt;
      const remaining = Math.max(0, POLL_TIMEOUT_MS - elapsed);

      pollTransactionStatus(entry.hash, {
        server: rpcServer,
        timeoutMs: remaining,
        intervalMs: POLL_INTERVAL_MS,
        signal: ac.signal,
      })
        .then((txResponse) => {
          const terminal: LendingTxStatus =
            txResponse.status === rpc.Api.GetTransactionStatus.SUCCESS
              ? "confirmed"
              : "failed";
          updatePendingTxStatus(network, address, entry.hash, terminal);
          setEntries((prev) =>
            prev.map((e) => (e.hash === entry.hash ? { ...e, status: terminal } : e)),
          );
          onSettledRef.current?.({ ...entry, status: terminal, resumed });
        })
        .catch((err: unknown) => {
          // Silently drop AbortError — component unmounted or address changed.
          if (err instanceof Error && err.name === "AbortError") return;

          const isTimeout =
            err instanceof Error && err.message.includes("timed out");
          const terminal: LendingTxStatus = isTimeout ? "timeout" : "failed";
          const errorMessage = err instanceof Error ? err.message : String(err);
          const decoded = decodeContractError(errorMessage);
          const msg = decoded.message;

          updatePendingTxStatus(network, address, entry.hash, terminal, msg);
          setEntries((prev) =>
            prev.map((e) =>
              e.hash === entry.hash
                ? { ...e, status: terminal, errorMessage: msg }
                : e,
            ),
          );
          onSettledRef.current?.({
            ...entry,
            status: terminal,
            errorMessage: msg,
            resumed,
          });
        })
        .finally(() => {
          controllersRef.current.delete(entry.hash);
        });
    },
    [network, address],
  );

  // ── on mount / address change: load + resume pending entries ────────────

  useEffect(() => {
    if (!address) {
      setEntries([]);
      return;
    }

    const loaded = loadPendingTxs(network, address);
    setEntries(loaded);

    // Resume polling for any entry still in "pending" status.
    for (const entry of loaded) {
      if (entry.status === "pending") {
        startPolling(entry, true);
      }
    }

    return () => {
      // Abort all running polls when address changes or component unmounts.
      for (const ac of controllersRef.current.values()) {
        ac.abort();
      }
      controllersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network, address]);

  // ── cross-tab storage event ──────────────────────────────────────────────

  useEffect(() => {
    if (!address) return;
    const key = pendingTxStorageKey(network, address);

    function onStorageEvent(e: StorageEvent) {
      if (e.key !== key) return;
      syncFromStorage();
    }

    window.addEventListener("storage", onStorageEvent);
    return () => window.removeEventListener("storage", onStorageEvent);
  }, [network, address, syncFromStorage]);

  // ── public API ───────────────────────────────────────────────────────────

  const record = useCallback(
    (entry: PendingTxEntry) => {
      if (!address) return;
      upsertPendingTx(network, address, entry);
      setEntries((prev) => {
        const without = prev.filter((e) => e.hash !== entry.hash);
        return [...without, entry];
      });
      startPolling(entry, false);
    },
    [network, address, startPolling],
  );

  const isDuplicate = useCallback(
    (action: LendingAction, asset: string): boolean => {
      if (!address) return false;
      return hasDuplicatePending(network, address, action, asset);
    },
    [network, address],
  );

  const remove = useCallback(
    (hash: string) => {
      if (!address) return;
      // Abort any running poll for this hash first.
      const ac = controllersRef.current.get(hash);
      if (ac) {
        ac.abort();
        controllersRef.current.delete(hash);
      }
      const next = entries.filter((e) => e.hash !== hash);
      savePendingTxs(network, address, next);
      setEntries(next);
    },
    [network, address, entries],
  );

  return { entries, record, isDuplicate, remove };
}
