"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  getInFlightTxs,
  subscribeInFlightTxs,
  removeInFlightTx,
  type InFlightTransaction,
} from "@/lib/tx/inFlightTxStore";
import useTxStatus from "@/lib/tx/useTxStatus";
import { TX_HOOK_STATE } from "@/lib/tx/constants";

function useInFlightTxs() {
  const [pendingTxs, setPendingTxs] = useState<InFlightTransaction[]>(() =>
    getInFlightTxs(),
  );

  useEffect(() => {
    const unsubscribe = subscribeInFlightTxs(() => {
      setPendingTxs(getInFlightTxs());
    });
    return unsubscribe;
  }, []);

  const handleTerminal = useCallback((hash: string) => {
    removeInFlightTx(hash);
  }, []);

  return { pendingTxs, handleTerminal };
}

function ItemTracker({
  hash,
  onTerminal,
}: {
  hash: string;
  onTerminal: (hash: string) => void;
}) {
  const status = useTxStatus(hash);

  useEffect(() => {
    if (!status) return;
    if (
      status.state === TX_HOOK_STATE.COMPLETED ||
      status.state === TX_HOOK_STATE.FAILED
    ) {
      onTerminal(hash);
    }
  }, [status, hash, onTerminal]);

  return null;
}

// Module-level component: its identity never changes across renders, so
// consumers that render <ItemTrackers /> never see it as a "new" component
// type. React can then key-diff the ItemTracker children instead of
// remounting the whole subtree (and resetting every in-flight poll's
// backoff) whenever pendingTxs changes.
export function ItemTrackers() {
  const { pendingTxs, handleTerminal } = useInFlightTxs();

  return (
    <>
      {pendingTxs.map((tx) => (
        <ItemTracker key={tx.hash} hash={tx.hash} onTerminal={handleTerminal} />
      ))}
    </>
  );
}

export function usePendingTransactions() {
  const { pendingTxs } = useInFlightTxs();

  return {
    pendingTxs,
    ItemTrackers,
  };
}
