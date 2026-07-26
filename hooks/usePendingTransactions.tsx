"use client";

import React, { useState, useEffect } from "react";
import {
  getInFlightTxs,
  subscribeInFlightTxs,
  removeInFlightTx,
  type InFlightTransaction,
} from "@/lib/tx/inFlightTxStore";
import useTxStatus from "@/lib/tx/useTxStatus";
import { TX_HOOK_STATE } from "@/lib/tx/constants";

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

export function usePendingTransactions() {
  const [pendingTxs, setPendingTxs] = useState<InFlightTransaction[]>(() =>
    getInFlightTxs(),
  );

  useEffect(() => {
    const unsubscribe = subscribeInFlightTxs(() => {
      setPendingTxs(getInFlightTxs());
    });
    return unsubscribe;
  }, []);

  const handleTerminal = (hash: string) => {
    removeInFlightTx(hash);
  };

  return {
    pendingTxs,
    ItemTrackers: () => (
      <>
        {pendingTxs.map((tx) => (
          <ItemTracker key={tx.hash} hash={tx.hash} onTerminal={handleTerminal} />
        ))}
      </>
    ),
  };
}
