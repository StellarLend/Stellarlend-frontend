import type { AssetSymbol, TransactionType } from "@/types/enums";

export interface InFlightTransaction {
  hash: string;
  type: TransactionType;
  amount: number;
  asset: AssetSymbol;
  date?: string;
  time?: string;
  timestamp: number;
}

type Listener = () => void;

let inFlightTxs: InFlightTransaction[] = [];
const listeners: Set<Listener> = new Set();

function notify() {
  listeners.forEach((listener) => listener());
}

export function addInFlightTx(
  tx: Omit<InFlightTransaction, "timestamp"> & { timestamp?: number },
): InFlightTransaction {
  const newTx: InFlightTransaction = {
    ...tx,
    timestamp: tx.timestamp ?? Date.now(),
  };
  // Prevent duplicate insertion for the same hash
  const existingIndex = inFlightTxs.findIndex((item) => item.hash === tx.hash);
  if (existingIndex >= 0) {
    inFlightTxs[existingIndex] = newTx;
  } else {
    inFlightTxs.unshift(newTx);
  }
  notify();
  return newTx;
}

export function removeInFlightTx(hash: string): void {
  const initialLen = inFlightTxs.length;
  inFlightTxs = inFlightTxs.filter((item) => item.hash !== hash);
  if (inFlightTxs.length !== initialLen) {
    notify();
  }
}

export function getInFlightTxs(): InFlightTransaction[] {
  return [...inFlightTxs];
}

export function subscribeInFlightTxs(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearInFlightTxs(): void {
  inFlightTxs = [];
  notify();
}
