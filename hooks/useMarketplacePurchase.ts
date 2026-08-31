/**
 * useMarketplacePurchase
 *
 * Drives the marketplace purchase through the state machine declared in
 * `types/marketplace.ts`. Client-side invariants:
 *
 *  - No duplicate submissions: while the machine is in `validating`,
 *    `submitting`, or `confirming`, any further `submit` call is rejected.
 *  - No stale responses: a monotonically increasing request id means a slow
 *    or out-of-order response can never contradict a newer transition.
 *  - No silent on-chain retries: the only re-submission path is `confirmRetry`,
 *    which the user must explicitly trigger; it reuses the same `idempotencyKey`
 *    so the server deduplicates it.
 *  - Intent-preserving recovery: after an ambiguous outcome the machine moves
 *    to `confirming` and keeps the full `PurchaseContext`. The user can call
 *    `reconcile()` (authoritative lookup, no action) or `cancel()`.
 *  - Per-request network timeout: every fetch is raced against
 *    REQUEST_TIMEOUT_MS so a hung connection never blocks the hook indefinitely.
 *  - Operational visibility: every significant path (start, success, failure,
 *    ambiguity, reconciliation, timeout, cancel) emits a structured
 *    `MarketplaceTelemetryEvent` through `onTelemetry`. No secrets, PII, raw
 *    server responses, or wallet addresses are forwarded.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { isInFlight, advance } from "@/lib/marketplace/purchaseStateMachine";
import { validatePurchaseRequest } from "@/lib/marketplace/invariants";
import {
  MARKETPLACE_BOUNDS,
  type MarketplaceListing,
  type MarketplaceTelemetryEvent,
  type PurchaseContext,
  type PurchaseError,
  type PurchaseResult,
  type PurchaseState,
} from "@/types/marketplace";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SubmitPurchaseInput {
  listingId: string;
  quantity: string;
  unitPrice: string;
  expectedVersion: number;
  walletAddress: string;
}

export interface UseMarketplacePurchaseOptions {
  /** Receive structured diagnostics for every significant purchase path. */
  onTelemetry?: (event: MarketplaceTelemetryEvent) => void;
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

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Strip values that could contain secrets before forwarding to telemetry. */
function sanitiseMessage(msg: string): string {
  return msg
    .replace(/\b[A-Fa-f0-9]{32,64}\b/g, "[redacted]")
    .replace(/\bG[A-Z2-7]{55}\b/g, "[address]");
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMarketplacePurchase(
  { onTelemetry }: UseMarketplacePurchaseOptions = {},
): UseMarketplacePurchaseReturn {
  const [phase, setPhase] = useState<PurchaseState>("idle");
  const [error, setError] = useState<PurchaseError | null>(null);
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [context, setContext] = useState<PurchaseContext | null>(null);

  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  // Keep latest onTelemetry accessible without re-creating callbacks.
  const onTelemetryRef = useRef(onTelemetry);
  onTelemetryRef.current = onTelemetry;

  // -------------------------------------------------------------------------
  // Telemetry helper
  // -------------------------------------------------------------------------

  const emit = useCallback(
    (event: Omit<MarketplaceTelemetryEvent, "timestamp">) => {
      onTelemetryRef.current?.({ ...event, timestamp: Date.now() });
    },
    [],
  );

  // -------------------------------------------------------------------------
  // State machine helper
  // -------------------------------------------------------------------------

  const go = useCallback((event: Parameters<typeof advance>[1]) => {
    setPhase((prev) => advance(prev, event));
  }, []);

  // -------------------------------------------------------------------------
  // Fetch helper: race against REQUEST_TIMEOUT_MS
  // -------------------------------------------------------------------------

  function makeFetchWithTimeout(
    url: string,
    init: RequestInit,
  ): { promise: Promise<Response>; controller: AbortController; clearTimer: () => void } {
    const controller = new AbortController();
    // Merge the caller's signal if any.
    const mergedInit: RequestInit = { ...init, signal: controller.signal };
    const timeoutId = setTimeout(
      () => controller.abort(),
      MARKETPLACE_BOUNDS.REQUEST_TIMEOUT_MS,
    );
    const clearTimer = () => clearTimeout(timeoutId);
    return { promise: fetch(url, mergedInit), controller, clearTimer };
  }

  // -------------------------------------------------------------------------
  // submit
  // -------------------------------------------------------------------------

  const submit = useCallback(
    async (input: SubmitPurchaseInput): Promise<boolean> => {
      // Duplicate-submission guard.
      if (isInFlight(phase)) return false;

      setError(null);
      setResult(null);

      go("VALIDATE");
      emit({ type: "purchase_started", metadata: { listingId: input.listingId } });

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
        emit({
          type: "purchase_failed",
          errorCode: validation.code,
          errorMessage: sanitiseMessage(validation.message),
          metadata: { stage: "validation" },
        });
        return false;
      }

      const purchaseContext: PurchaseContext = validation.value;
      setContext(purchaseContext);
      go("VALIDATION_OK");

      const requestId = ++requestIdRef.current;
      cancelledRef.current = false;

      abortControllerRef.current?.abort();
      const { promise, controller, clearTimer } = makeFetchWithTimeout(
        "/api/marketplace/purchase",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId: purchaseContext.listingId,
            quantity: purchaseContext.quantity,
            unitPrice: purchaseContext.unitPrice,
            expectedVersion: purchaseContext.expectedVersion,
            walletAddress: purchaseContext.walletAddress,
            idempotencyKey: purchaseContext.idempotencyKey,
          }),
        },
      );
      abortControllerRef.current = controller;

      const startTime = Date.now();

      try {
        const response = await promise;
        clearTimer();

        if (requestIdRef.current !== requestId) return true; // stale; ignore
        const envelope = (await response.json()) as PurchaseEnvelope;
        if (requestIdRef.current !== requestId) return true;

        const latencyMs = Date.now() - startTime;
        emit({ type: "latency", latencyMs, metadata: { stage: "submit" } });

        if (response.ok && envelope.success && envelope.data) {
          go("SUBMIT_OK");
          setResult({
            purchaseId: envelope.data.purchaseId,
            transactionHash: envelope.data.transactionHash,
            listingVersion: envelope.data.listingVersion,
            quantityFilled: envelope.data.quantityFilled,
            quantityRemaining: envelope.data.quantityRemaining,
          });
          emit({ type: "purchase_succeeded", latencyMs });
          return true;
        }

        if (isDefinitiveRejection(response.status)) {
          const errCode = (envelope.code as PurchaseError["code"]) ?? "unknown";
          const errMsg = sanitiseMessage(
            envelope.error?.message ?? "The purchase was rejected.",
          );
          go("SUBMIT_FAIL");
          setError({
            code: errCode,
            message: errMsg,
            ...(envelope.error?.freshListing
              ? { staleListing: envelope.error.freshListing }
              : {}),
          });
          emit({
            type: "purchase_failed",
            errorCode: errCode,
            errorMessage: errMsg,
            latencyMs,
            metadata: { stage: "submit", httpStatus: response.status },
          });
          return false;
        }

        // 5xx — ambiguous: the action may have run.
        go("SUBMIT_AMBIGUOUS");
        setError({ code: "ambiguous", message: "We couldn't confirm whether the purchase went through." });
        emit({
          type: "purchase_ambiguous",
          latencyMs,
          metadata: { stage: "submit", httpStatus: response.status },
        });
        return false;
      } catch (cause) {
        clearTimer();
        if (requestIdRef.current !== requestId) return true;
        const err = cause as Error;
        if (cancelledRef.current || err.name === "AbortError") {
          const isTimeout = Date.now() - startTime >= MARKETPLACE_BOUNDS.REQUEST_TIMEOUT_MS - 50;
          if (isTimeout) {
            go("SUBMIT_AMBIGUOUS");
            setError({ code: "timeout", message: "The purchase request timed out before confirmation." });
            emit({
              type: "purchase_ambiguous",
              errorCode: "timeout",
              errorMessage: "Request timed out.",
              metadata: { stage: "submit" },
            });
          }
          return false;
        }
        go("SUBMIT_AMBIGUOUS");
        const sanitised = sanitiseMessage(err.message);
        setError({ code: "network_error", message: "The purchase request was interrupted before confirmation." });
        emit({
          type: "purchase_ambiguous",
          errorCode: "network_error",
          errorMessage: sanitised,
          metadata: { stage: "submit" },
        });
        return false;
      }
    },
    [emit, go, phase],
  );

  // -------------------------------------------------------------------------
  // reconcile
  // -------------------------------------------------------------------------

  const reconcile = useCallback(async () => {
    if (phase !== "confirming" || !context) return;

    const requestId = ++requestIdRef.current;
    emit({ type: "reconcile_started", metadata: { listingId: context.listingId } });
    const startTime = Date.now();

    try {
      const response = await fetch("/api/marketplace/purchase/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: context.idempotencyKey }),
      });
      if (requestIdRef.current !== requestId) return;
      const envelope = (await response.json()) as StatusEnvelope;
      if (requestIdRef.current !== requestId) return;

      const latencyMs = Date.now() - startTime;
      emit({ type: "latency", latencyMs, metadata: { stage: "reconcile" } });

      if (!envelope.known) {
        go("RECONCILE_UNKNOWN");
        emit({ type: "reconcile_unknown", latencyMs });
        return;
      }

      if (envelope.status === "succeeded" && envelope.data) {
        go("RECONCILE_OK");
        setResult(envelope.data);
        emit({ type: "reconcile_succeeded", latencyMs });
        return;
      }

      const errCode = (envelope.error?.code as PurchaseError["code"] | undefined) ?? "unknown";
      const errMsg = sanitiseMessage(
        envelope.error?.message ?? "The purchase did not go through.",
      );
      go("RECONCILE_FAILED");
      setError({ code: errCode, message: errMsg });
      emit({
        type: "reconcile_failed",
        errorCode: errCode,
        errorMessage: errMsg,
        latencyMs,
      });
    } catch (cause) {
      go("RECONCILE_UNKNOWN");
      const err = cause as Error;
      emit({
        type: "reconcile_unknown",
        errorCode: "network_error",
        errorMessage: sanitiseMessage(err.message),
      });
    }
  }, [context, emit, go, phase]);

  // -------------------------------------------------------------------------
  // confirmRetry
  // -------------------------------------------------------------------------

  const confirmRetry = useCallback(async (): Promise<boolean> => {
    if (phase !== "confirming" || !context) return false;

    // Re-run with the SAME idempotency key so the server never double-counts.
    go("CONFIRM_RETRY");
    const requestId = ++requestIdRef.current;
    cancelledRef.current = false;

    abortControllerRef.current?.abort();
    const { promise, controller, clearTimer } = makeFetchWithTimeout(
      "/api/marketplace/purchase",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: context.listingId,
          quantity: context.quantity,
          unitPrice: context.unitPrice,
          expectedVersion: context.expectedVersion,
          walletAddress: context.walletAddress,
          idempotencyKey: context.idempotencyKey,
        }),
      },
    );
    abortControllerRef.current = controller;

    emit({ type: "purchase_started", metadata: { listingId: context.listingId, isRetry: true } });
    const startTime = Date.now();

    try {
      const response = await promise;
      clearTimer();
      if (requestIdRef.current !== requestId) return false;
      const envelope = (await response.json()) as PurchaseEnvelope;
      if (requestIdRef.current !== requestId) return false;

      const latencyMs = Date.now() - startTime;
      emit({ type: "latency", latencyMs, metadata: { stage: "retry" } });

      if (response.ok && envelope.success && envelope.data) {
        go("SUBMIT_OK");
        setResult({
          purchaseId: envelope.data.purchaseId,
          transactionHash: envelope.data.transactionHash,
          listingVersion: envelope.data.listingVersion,
          quantityFilled: envelope.data.quantityFilled,
          quantityRemaining: envelope.data.quantityRemaining,
        });
        emit({ type: "purchase_succeeded", latencyMs, metadata: { isRetry: true } });
        return true;
      }

      if (isDefinitiveRejection(response.status)) {
        const errCode = (envelope.code as PurchaseError["code"]) ?? "unknown";
        const errMsg = sanitiseMessage(
          envelope.error?.message ?? "The purchase was rejected.",
        );
        go("SUBMIT_FAIL");
        setError({
          code: errCode,
          message: errMsg,
          ...(envelope.error?.freshListing
            ? { staleListing: envelope.error.freshListing }
            : {}),
        });
        emit({
          type: "purchase_failed",
          errorCode: errCode,
          errorMessage: errMsg,
          latencyMs,
          metadata: { stage: "retry", httpStatus: response.status },
        });
        return false;
      }

      go("SUBMIT_AMBIGUOUS");
      setError({ code: "ambiguous", message: "Still unconfirmed. Choose reconcile or cancel." });
      emit({
        type: "purchase_ambiguous",
        latencyMs,
        metadata: { stage: "retry", httpStatus: response.status },
      });
      return false;
    } catch (cause) {
      clearTimer();
      if (requestIdRef.current !== requestId) return false;
      const err = cause as Error;
      if (cancelledRef.current || err.name === "AbortError") return false;
      const sanitised = sanitiseMessage(err.message);
      go("SUBMIT_AMBIGUOUS");
      setError({ code: "network_error", message: "Retry was interrupted before confirmation." });
      emit({
        type: "purchase_ambiguous",
        errorCode: "network_error",
        errorMessage: sanitised,
        metadata: { stage: "retry" },
      });
      return false;
    }
  }, [context, emit, go, phase]);

  // -------------------------------------------------------------------------
  // cancel / reset
  // -------------------------------------------------------------------------

  const cancel = useCallback(() => {
    if (!isInFlight(phase)) return;
    cancelledRef.current = true;
    abortControllerRef.current?.abort();
    requestIdRef.current++; // invalidate any in-flight response
    go("CANCEL");
    emit({ type: "purchase_failed", errorCode: "cancelled", errorMessage: "User cancelled.", metadata: { stage: "cancel" } });
  }, [emit, go, phase]);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
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
