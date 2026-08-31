"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  CommitmentDetailResponse,
  TelemetryEvent,
  CommitmentStatus,
} from "../../types/commitment";
import { COMMITMENT_BOUNDS } from "../../types/commitment";

interface SettlementReceiptProps {
  commitmentId: string;
  onTelemetry?: (event: TelemetryEvent) => void;
}

type SettlementState =
  | "initializing"
  | "idle"
  | "submitting"
  | "recovering"
  | "success"
  | "error";

export default function SettlementReceipt({
  commitmentId,
  onTelemetry,
}: SettlementReceiptProps) {
  const [data, setData] = useState<CommitmentDetailResponse | null>(null);
  const [state, setState] = useState<SettlementState>("initializing");
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const isMounted = useRef<boolean>(true);
  const fetchCounter = useRef<number>(0);

  const intentKey = `settlement_intent_${commitmentId}`;

  const emitTelemetry = useCallback(
    (event: Omit<TelemetryEvent, "timestamp" | "commitmentId">) => {
      if (onTelemetry) {
        onTelemetry({ ...event, timestamp: Date.now(), commitmentId });
      }
    },
    [commitmentId, onTelemetry]
  );

  const fetchCommitment = useCallback(async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentFetchId = ++fetchCounter.current;
    
    try {
      const response = await fetch(`/api/commitments/${commitmentId}`, {
        signal: controller.signal,
        headers: { "Cache-Control": "no-cache" }
      });
      if (!response.ok) throw new Error("Failed to fetch commitment");
      const json = await response.json();
      
      if (isMounted.current && currentFetchId === fetchCounter.current) {
        setData(json);
      }
      return json as CommitmentDetailResponse;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return null;
      throw err;
    }
  }, [commitmentId]);

  const scheduleRecoveryPoll = useCallback(() => {
    if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
    
    const delay = Math.min(
      COMMITMENT_BOUNDS.POLLING_INITIAL_INTERVAL_MS *
        Math.pow(COMMITMENT_BOUNDS.POLLING_BACKOFF_MULTIPLIER, retryCountRef.current),
      COMMITMENT_BOUNDS.POLLING_MAX_INTERVAL_MS
    );
    
    pollingTimeoutRef.current = setTimeout(async () => {
      retryCountRef.current += 1;
      try {
        const result = await fetchCommitment();
        if (result && result.commitment.status === "settled") {
          localStorage.removeItem(intentKey);
          if (isMounted.current) {
            setState("success");
            setError(null);
          }
        } else if (retryCountRef.current < COMMITMENT_BOUNDS.POLLING_MAX_RETRIES) {
          scheduleRecoveryPoll();
        } else {
          if (isMounted.current) {
            setState("error");
            setError("Recovery timed out. Please try again.");
          }
        }
      } catch (err) {
        if (retryCountRef.current < COMMITMENT_BOUNDS.POLLING_MAX_RETRIES) {
          scheduleRecoveryPoll();
        } else {
          if (isMounted.current) {
            setState("error");
            setError("Failed to recover settlement state.");
          }
        }
      }
    }, delay);
  }, [fetchCommitment, intentKey]);

  useEffect(() => {
    isMounted.current = true;
    
    const initialize = async () => {
      try {
        const result = await fetchCommitment();
        if (!result) return;
        
        const hasIntent = localStorage.getItem(intentKey) !== null;
        
        if (result.commitment.status === "settled") {
          if (hasIntent) localStorage.removeItem(intentKey);
          setState("success");
        } else if (hasIntent) {
          setState("recovering");
          retryCountRef.current = 0;
          scheduleRecoveryPoll();
        } else {
          setState("idle");
        }
      } catch (err) {
        setState("error");
        setError("Failed to initialize.");
      }
    };
    
    initialize();

    return () => {
      isMounted.current = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
    };
  }, [fetchCommitment, intentKey, scheduleRecoveryPoll]);

  const handleSettle = async () => {
    if (state === "submitting" || state === "success") return;
    
    setState("submitting");
    setError(null);
    localStorage.setItem(intentKey, Date.now().toString());
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), COMMITMENT_BOUNDS.REQUEST_TIMEOUT_MS);
      
      const response = await fetch(`/api/commitments/${commitmentId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "settle", commitmentId }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error("Action failed");
      }
      
      const resData = await response.json();
      if (!resData.success) throw new Error("Settlement was not successful.");
      
      localStorage.removeItem(intentKey);
      
      // Update data immediately for UX
      setData(prev => prev ? {
        ...prev,
        commitment: { ...prev.commitment, status: "settled", transactionHash: resData.transactionHash }
      } : null);
      
      setState("success");
      emitTelemetry({ type: "action_completed", action: "settle", status: "settled" });
    } catch (err) {
      // In case of timeout or network failure, we enter recovery mode
      // This prevents silently repeating the on-chain action on retry
      setState("recovering");
      retryCountRef.current = 0;
      scheduleRecoveryPoll();
      emitTelemetry({ type: "action_failed", action: "settle" });
    }
  };

  const handleRetryRecovery = () => {
    setState("recovering");
    retryCountRef.current = 0;
    scheduleRecoveryPoll();
  };

  const handleCancelRecovery = () => {
    localStorage.removeItem(intentKey);
    setState("idle");
    setError(null);
  };

  if (state === "initializing") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Loading settlement data...</p>
      </div>
    );
  }

  const { commitment } = data || {};

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm mb-6">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h3 className="text-xl font-bold text-slate-900">Settlement Receipt</h3>
        {state === "success" && (
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
            Settled
          </span>
        )}
      </div>
      
      {commitment && (
        <div className="grid grid-cols-2 gap-4 text-sm mb-6 bg-slate-50 p-4 rounded-lg">
          <div>
            <span className="block text-slate-500 mb-1">Commitment ID</span>
            <p className="font-mono font-medium truncate" title={commitment.id}>{commitment.id}</p>
          </div>
          <div>
            <span className="block text-slate-500 mb-1">Amount</span>
            <p className="font-medium">{commitment.amount} {commitment.asset}</p>
          </div>
          <div>
            <span className="block text-slate-500 mb-1">Status</span>
            <p className="font-semibold capitalize">{commitment.status}</p>
          </div>
          {commitment.transactionHash && (
            <div>
              <span className="block text-slate-500 mb-1">Transaction Hash</span>
              <p className="font-mono font-medium truncate text-blue-600" title={commitment.transactionHash}>
                {commitment.transactionHash}
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
          {error}
        </div>
      )}

      {state === "idle" && commitment?.status !== "settled" && (
        <button
          onClick={handleSettle}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Settle Commitment
        </button>
      )}

      {state === "submitting" && (
        <div className="flex items-center justify-center p-4 bg-blue-50 text-blue-700 rounded-lg">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Submitting settlement to network...
        </div>
      )}

      {state === "recovering" && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center text-amber-800 mb-2 font-medium">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-amber-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Recovering Settlement State...
          </div>
          <p className="text-sm text-amber-700">
            A previous settlement attempt may still be processing. We are verifying the on-chain status to prevent duplicate transactions.
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="flex gap-4">
          <button
            onClick={handleRetryRecovery}
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Retry Verification
          </button>
          <button
            onClick={handleCancelRecovery}
            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Clear Pending State
          </button>
        </div>
      )}

      {state === "success" && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg text-center">
          <p className="font-medium">Settlement has been confirmed successfully!</p>
          <p className="text-sm mt-1 text-green-700">The receipt details are finalized above.</p>
        </div>
      )}
    </div>
  );
}
