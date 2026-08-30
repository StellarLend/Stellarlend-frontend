/**
 * useMarketplacePurchase
 *
 * Drives the marketplace purchase through the state machine declared in
 * `types/marketplace.ts`. It is where the client-side invariants for
 * deterministic, atomic and recoverable purchases live:
 *
 *  - **No duplicate submissions** : while the machine is in `validating`,
 *    `submitting` or `confirming` any further `submit` call is rejected.
 *  - **No stale responses**      : a monotonically increasing request id means
 *    a slow or out-of-order response can never contradict a newer transition.
 *  - **No silent on-chain retries**: the only way to re-run a submission is
 *    `confirmRetry`, which the user must explicitly trigger and which reuses
 *    the same `idempotencyKey` so the server dedupes it.
 *  - **Intent-preserving recovery**: after an ambiguous outcome the machine
 *    moves to `confirming` and keeps the full `PurchaseContext`; the user can
 *    `reconcile()` (authoritative status lookup, performs no action) or
 *    `cancel()`. If reconciliation is inconclusive they stay in `confirming`
 *    until they explicitly choose.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { isInFlight, advance } from "@/lib/marketplace/purchaseStateMachine";
import { validatePurchaseRequest } from "@/lib/marketplace/invariants";
import type {
  MarketplaceListing,
  PurchaseContext,
  PurchaseError,
  PurchaseResult,
  PurchaseState,
} from "@/types/marketplace";

export interface SubmitPurchaseInput {
  listingId: string;
  quantity: string;
  unitPrice: string;
  expectedVersion: number;
  walletAddress: string;
}

export interface UseMarketplacePurchaseReturn {
  phase: PurchaseState;
  /** Derived flags so consumers don't couple to raw states. */
  isIdle: boolean;
  isSubmitting: boolean;
  isConfirming: boolean;
  isSucceeded: boolean;
  isFailed: boolean;
  isCancelled: boolean;
  error: PurchaseError | null;
  result: PurchaseResult | null;
  /** The original intent, preserved across retries and recovery. */
  context: PurchaseContext | null;
  /** Fresh listing available after an inventory/price conflict. */
  freshListing: MarketplaceListing | null;
  submit: (input: SubmitPurchaseInput) => Promise<boolean>;
  /** Recovery: authoritative outcome lookup; never performs an action. */
  reconcile: () => Promise<void>;
  /** Explicit user-triggered re-submission with the same idempotency key. */
  confirmRetry: () => Promise<boolean>;
  cancel: () => void;
  reset: () => void;
}

interface PurchaseEnvelope {
  success: boolean;
  code?: string;
  data?: {
    purchaseId: string;
    transactionHash: string;
    quantityFilled: string;
    listingVersion: number;
    quantityRemaining: string;
  };
  error?: { code: string; message: string; freshListing?: MarketplaceListing };
}

interface StatusEnvelope {
  known: boolean;
  status?: "succeeded" | "failed";
  data?: PurchaseResult;
  error?: { code: string; message: string; freshListing?: MarketplaceListing };
}

/**
 * A non-2xx, non-5xx response is a *definitive* rejection: the server decided
 * and did not run the action. A 5xx or a network/timeout drop is ambiguous --
 * the action may or may not have reached the ledger.
 */
function isDefinitiveRejection(status: number): boolean {
  return status >= 400 && status < 500;
}

function makeIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `p_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 16)}`;
}

export function useMarketplacePurchase(): UseMarketplacePurchaseReturn {
  const [phase, setPhase] = useState<PurchaseState>("idle");
  const [error, setError] = useState<PurchaseError | null>(null);
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [context, setContext] = useState<PurchaseContext | null>(null);

  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const go = useCallback((event: Parameters<typeof advance>[1]) => {
    setPhase((prev) => advance(prev, event));
  }, []);

  const submit = useCallback(
    async (input: SubmitPurchaseInput): Promise<boolean> => {
      // Duplicate-submission guard: may not start while a flow is live.
      if (isInFlight(phase)) {
        return false;
      }

      setError(null);
      setResult(null);

      // Enter the machine from idle, then walk validating -> submitting.
      go("VALIDATE");

      const idempotencyKey = makeIdempotencyKey();
      const raw = {
        listingId: input.listingId,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        expectedVersion: input.expectedVersion,
        walletAddress: input.walletAddress,
        idempotencyKey,
      };

      const validation = validatePurchaseRequest(raw);
      if (!validation.ok) {
        go("VALIDATION_FAIL");
        setError({ code: validation.code, message: validation.message });
        return false;
      }

      const purchaseContext: PurchaseContext = validation.value;
      setContext(purchaseContext);
      go("VALIDATION_OK");

      const requestId = ++requestIdRef.current;
      cancelledRef.current = false;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch("/api/marketplace/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            listingId: purchaseContext.listingId,
            quantity: purchaseContext.quantity,
            unitPrice: purchaseContext.unitPrice,
            expectedVersion: purchaseContext.expectedVersion,
            walletAddress: purchaseContext.walletAddress,
            idempotencyKey: purchaseContext.idempotencyKey,
          }),
        });

        if (requestIdRef.current !== requestId) return true; // stale; ignore
        const envelope = (await response.json()) as PurchaseEnvelope;
        if (requestIdRef.current !== requestId) return true;

        if (response.ok && envelope.success) {
          go("SUBMIT_OK");
          setResult({
            purchaseId: envelope.data!.purchaseId,
            transactionHash: envelope.data!.transactionHash,
            listingVersion: envelope.data!.listingVersion,
            quantityFilled: envelope.data!.quantityFilled,
            quantityRemaining: envelope.data!.quantityRemaining,
          });
          return true;
        }

        if (isDefinitiveRejection(response.status)) {
          go("SUBMIT_FAIL");
          setError({
            code: (envelope.code as PurchaseError["code"]) ?? "unknown",
            message: envelope.error?.message ?? "The purchase was rejected.",
            ...(envelope.error?.freshListing
              ? { staleListing: envelope.error.freshListing }
              : {}),
          });
          return false;
        }

        // 5xx is ambiguous: the action may have run. Go recover.
        go("SUBMIT_AMBIGUOUS");
        setError({
          code: "ambiguous",
          message: "We couldn't confirm whether the purchase went through.",
        });
        return false;
      } catch (cause) {
        if (requestIdRef.current !== requestId) return true;
        const err = cause as Error;
        // An explicit cancel is handled by `cancel`, not treated as ambiguity.
        if (cancelledRef.current || err.name === "AbortError") {
          return false;
        }
        go("SUBMIT_AMBIGUOUS");
        setError({
          code: "network_error",
          message: "The purchase request was interrupted before confirmation.",
        });
        return false;
      }
    },
    [go, phase],
  );

  const reconcile = useCallback(async () => {
    if (phase !== "confirming" || !context) return;

    const requestId = ++requestIdRef.current;
    try {
      const response = await fetch("/api/marketplace/purchase/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: context.idempotencyKey }),
      });
      if (requestIdRef.current !== requestId) return;
      const envelope = (await response.json()) as StatusEnvelope;
      if (requestIdRef.current !== requestId) return;

      if (!envelope.known) {
        go("RECONCILE_UNKNOWN");
        return;
      }

      if (envelope.status === "succeeded" && envelope.data) {
        go("RECONCILE_OK");
        setResult(envelope.data);
        return;
      }

      go("RECONCILE_FAILED");
      setError({
        code: (envelope.error?.code as PurchaseError["code"] | undefined) ?? "unknown",
        message: envelope.error?.message ?? "The purchase did not go through.",
      });
    } catch {
      go("RECONCILE_UNKNOWN");
    }
  }, [context, go, phase]);

  const confirmRetry = useCallback(async (): Promise<boolean> => {
    if (phase !== "confirming" || !context) return false;

    // Re-run with the SAME idempotency key so the server never double-counts.
    go("CONFIRM_RETRY");
    const requestId = ++requestIdRef.current;
    cancelledRef.current = false;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/marketplace/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          listingId: context.listingId,
          quantity: context.quantity,
          unitPrice: context.unitPrice,
          expectedVersion: context.expectedVersion,
          walletAddress: context.walletAddress,
          idempotencyKey: context.idempotencyKey,
        }),
      });
      if (requestIdRef.current !== requestId) return false;
      const envelope = (await response.json()) as PurchaseEnvelope;
      if (requestIdRef.current !== requestId) return false;

      if (response.ok && envelope.success && envelope.data) {
        go("SUBMIT_OK");
        setResult({
          purchaseId: envelope.data.purchaseId,
          transactionHash: envelope.data.transactionHash,
          listingVersion: envelope.data.listingVersion,
          quantityFilled: envelope.data.quantityFilled,
          quantityRemaining: envelope.data.quantityRemaining,
        });
        return true;
      }

      if (isDefinitiveRejection(response.status)) {
        go("SUBMIT_FAIL");
        setError({
          code: (envelope.code as PurchaseError["code"]) ?? "unknown",
          message: envelope.error?.message ?? "The purchase was rejected.",
          ...(envelope.error?.freshListing
            ? { staleListing: envelope.error.freshListing }
            : {}),
        });
        return false;
      }

      go("SUBMIT_AMBIGUOUS");
      setError({ code: "ambiguous", message: "Still unconfirmed. Choose reconcile or cancel." });
      return false;
    } catch (cause) {
      if (requestIdRef.current !== requestId) return false;
      const err = cause as Error;
      if (cancelledRef.current || err.name === "AbortError") return false;
      go("SUBMIT_AMBIGUOUS");
      setError({ code: "network_error", message: "Retry was interrupted before confirmation." });
      return false;
    }
  }, [context, go, phase]);

  const cancel = useCallback(() => {
    if (!isInFlight(phase)) return;
    cancelledRef.current = true;
    abortControllerRef.current?.abort();
    requestIdRef.current++; // invalidate any in-flight response
    go("CANCEL");
  }, [go, phase]);

  const reset = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setError(null);
    setResult(null);
    setContext(null);
    go("RESET");
  }, [go]);

  // Clean up in-flight requests on unmount.
  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  const freshListing = error?.staleListing ?? null;

  return {
    phase,
    isIdle: phase === "idle",
    isSubmitting: phase === "validating" || phase === "submitting",
    isConfirming: phase === "confirming",
    isSucceeded: phase === "succeeded",
    isFailed: phase === "failed",
    isCancelled: phase === "cancelled",
    error,
    result,
    context,
    freshListing,
    submit,
    reconcile,
    confirmRetry,
    cancel,
    reset,
  };
}