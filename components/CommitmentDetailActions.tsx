import React, { useEffect, useRef, useState } from "react";

export type ActionType = "fund" | "dispute" | "earlyExit" | "settle";

export enum ActionState {
  Idle = "Idle",
  IntentRecorded = "IntentRecorded",
  Executing = "Executing",
  PendingOnChain = "PendingOnChain",
  Confirmed = "Confirmed",
  Failed = "Failed",
  Cancelled = "Cancelled",
}

interface PersistedIntent {
  action: ActionType;
  requestId: string;
  state: ActionState;
  txHash?: string;
}

function genRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

const STORAGE_PREFIX = "commitment_action:";

async function postAction(commitmentId: string, action: ActionType, requestId: string) {
  const res = await fetch(`/api/commitments/${commitmentId}/action`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, requestId }),
  });
  return res.json();
}

async function txStatus(txHash: string) {
  const res = await fetch(`/api/txs/status?txHash=${encodeURIComponent(txHash)}`);
  return res.json();
}

export default function CommitmentDetailActions({
  commitmentId,
  initialStatus,
  canAct = true,
}: {
  commitmentId: string;
  initialStatus?: string;
  canAct?: boolean;
}) {
  const [state, setState] = useState<ActionState>(ActionState.Idle);
  const [currentAction, setCurrentAction] = useState<ActionType | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const currentRequestRef = useRef<string | null>(null);

  // Load persisted intent on mount to recover interrupted operations
  useEffect(() => {
    const key = STORAGE_PREFIX + commitmentId;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed: PersistedIntent = JSON.parse(raw);
        currentRequestRef.current = parsed.requestId;
        setCurrentAction(parsed.action);
        setTxHash(parsed.txHash ?? null);
        setState(parsed.state === ActionState.PendingOnChain ? ActionState.PendingOnChain : parsed.state);
      }
    } catch (e) {
      // ignore
    }
  }, [commitmentId]);

  // Persist whenever key pieces change
  useEffect(() => {
    const key = STORAGE_PREFIX + commitmentId;
    if (state === ActionState.Idle || state === ActionState.Confirmed || state === ActionState.Cancelled) {
      localStorage.removeItem(key);
      return;
    }
    const payload: PersistedIntent = {
      action: currentAction as ActionType,
      requestId: currentRequestRef.current as string,
      state,
      txHash: txHash ?? undefined,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  }, [state, currentAction, txHash, commitmentId]);

  // Poll tx status when pending
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    async function poll() {
      if (!txHash) return;
      try {
        const status = await txStatus(txHash);
        if (cancelled) return;
        if (status?.status === "confirmed") {
          setState(ActionState.Confirmed);
          currentRequestRef.current = null;
          setTxHash(null);
        } else if (status?.status === "failed") {
          setState(ActionState.Failed);
        } else {
          timer = window.setTimeout(poll, 1500);
        }
      } catch (e) {
        if (cancelled) return;
        timer = window.setTimeout(poll, 2000);
      }
    }
    if (state === ActionState.PendingOnChain && txHash) poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [state, txHash]);

  async function handleAction(action: ActionType) {
    if (!canAct) return;
    // Prevent duplicate submissions
    if (state === ActionState.Executing || state === ActionState.PendingOnChain) return;

    const requestId = genRequestId();
    currentRequestRef.current = requestId;
    setCurrentAction(action);
    setState(ActionState.Executing);

    try {
      const resp = await postAction(commitmentId, action, requestId);
      // Ensure response matches current requestId to avoid stale updates
      if (resp?.requestId !== currentRequestRef.current) {
        // Stale response — ignore
        return;
      }
      if (resp?.status === "accepted" && resp?.txHash) {
        setTxHash(resp.txHash);
        setState(ActionState.PendingOnChain);
      } else if (resp?.status === "completed") {
        setState(ActionState.Confirmed);
        currentRequestRef.current = null;
      } else {
        setState(ActionState.Failed);
      }
    } catch (e) {
      setState(ActionState.Failed);
    }
  }

  function renderButtons() {
    const disabled = !canAct || state === ActionState.Executing || state === ActionState.PendingOnChain;
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => handleAction("fund")} disabled={disabled}>
          Fund
        </button>
        <button onClick={() => handleAction("dispute")} disabled={disabled}>
          Dispute
        </button>
        <button onClick={() => handleAction("earlyExit")} disabled={disabled}>
          Early Exit
        </button>
        <button onClick={() => handleAction("settle")} disabled={disabled}>
          Settle
        </button>
      </div>
    );
  }

  return (
    <div>
      <div>Commitment status: {initialStatus ?? "unknown"}</div>
      <div>Action state: {state}</div>
      {state === ActionState.PendingOnChain && txHash && (
        <div>
          Pending on-chain: <a href={`https://explorer/tx/${txHash}`}>{txHash}</a>
        </div>
      )}
      {state === ActionState.Failed && <div style={{ color: "crimson" }}>Action failed — please retry or inspect transaction</div>}
      {renderButtons()}
    </div>
  );
}
