/**
 * Bounded commitment polling hook with exponential backoff
 * Implements circuit breaker pattern and proper cleanup
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  Commitment,
  CommitmentDetailResponse,
  CircuitBreakerState,
  TelemetryEvent,
} from "@/types/commitment";
import { COMMITMENT_BOUNDS } from "@/types/commitment";

interface UseCommitmentPollingOptions {
  commitmentId: string;
  enabled?: boolean;
  onTelemetry?: (event: TelemetryEvent) => void;
}

interface UseCommitmentPollingReturn {
  commitment: Commitment | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  stopPolling: () => void;
  startPolling: () => void;
}

/**
 * Hook for polling commitment status with bounded behavior
 * - Exponential backoff with configurable limits
 * - Circuit breaker to prevent cascading failures
 * - Automatic cleanup on unmount or route change
 * - Concurrent request limiting
 * - Structured telemetry for observability
 */
export function useCommitmentPolling({
  commitmentId,
  enabled = true,
  onTelemetry,
}: UseCommitmentPollingOptions): UseCommitmentPollingReturn {
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Polling state
  const pollingIntervalRef = useRef(COMMITMENT_BOUNDS.POLLING_INITIAL_INTERVAL_MS);
  const retryCountRef = useRef(0);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const concurrentRequestsRef = useRef(0);
  const isPollingRef = useRef(false);

  // Circuit breaker state
  const circuitBreakerRef = useRef<CircuitBreakerState>({
    isOpen: false,
    failureCount: 0,
    lastFailureTime: 0,
  });

  // Emit telemetry event
  const emitTelemetry = useCallback(
    (event: Omit<TelemetryEvent, "timestamp" | "commitmentId">) => {
      if (onTelemetry) {
        onTelemetry({
          ...event,
          timestamp: Date.now(),
          commitmentId,
        });
      }
    },
    [commitmentId, onTelemetry],
  );

  // Check if circuit breaker should reset
  const shouldResetCircuitBreaker = useCallback(() => {
    const breaker = circuitBreakerRef.current;
    if (
      breaker.isOpen &&
      Date.now() - breaker.lastFailureTime > COMMITMENT_BOUNDS.CIRCUIT_BREAKER_RESET_MS
    ) {
      breaker.isOpen = false;
      breaker.failureCount = 0;
      emitTelemetry({
        type: "circuit_breaker_closed",
        metadata: { reason: "timeout_expired" },
      });
      return true;
    }
    return false;
  }, [emitTelemetry]);

  // Handle circuit breaker failure
  const recordFailure = useCallback(() => {
    const breaker = circuitBreakerRef.current;
    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();

    if (breaker.failureCount >= COMMITMENT_BOUNDS.CIRCUIT_BREAKER_THRESHOLD && !breaker.isOpen) {
      breaker.isOpen = true;
      emitTelemetry({
        type: "circuit_breaker_opened",
        metadata: {
          failureCount: breaker.failureCount,
        },
      });
    }
  }, [emitTelemetry]);

  // Reset circuit breaker on success
  const recordSuccess = useCallback(() => {
    const breaker = circuitBreakerRef.current;
    if (breaker.failureCount > 0 || breaker.isOpen) {
      breaker.failureCount = 0;
      breaker.isOpen = false;
      emitTelemetry({
        type: "circuit_breaker_closed",
        metadata: { reason: "request_succeeded" },
      });
    }
  }, [emitTelemetry]);

  // Fetch commitment details with timeout and concurrency control
  const fetchCommitment = useCallback(async (): Promise<void> => {
    // Check circuit breaker
    if (circuitBreakerRef.current.isOpen) {
      shouldResetCircuitBreaker();
      if (circuitBreakerRef.current.isOpen) {
        const err = new Error("Circuit breaker is open");
        setError(err);
        emitTelemetry({
          type: "polling_error",
          errorType: "circuit_breaker_open",
          errorMessage: "Too many consecutive failures",
        });
        return;
      }
    }

    // Enforce concurrent request limit
    if (concurrentRequestsRef.current >= COMMITMENT_BOUNDS.MAX_CONCURRENT_REQUESTS) {
      emitTelemetry({
        type: "polling_error",
        errorType: "concurrent_limit_exceeded",
        errorMessage: `Max ${COMMITMENT_BOUNDS.MAX_CONCURRENT_REQUESTS} concurrent requests`,
      });
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    concurrentRequestsRef.current++;

    const startTime = Date.now();

    try {
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, COMMITMENT_BOUNDS.REQUEST_TIMEOUT_MS);

      const response = await fetch(`/api/commitments/${commitmentId}`, {
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
      });

      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;
      emitTelemetry({
        type: "api_latency",
        latencyMs: latency,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Rate limited");
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CommitmentDetailResponse = await response.json();

      // Track state transitions
      if (commitment && commitment.status !== data.commitment.status) {
        emitTelemetry({
          type: "state_transition",
          status: data.commitment.status,
          metadata: {
            previousStatus: commitment.status,
            newStatus: data.commitment.status,
          },
        });
      }

      setCommitment(data.commitment);
      setError(null);
      setIsLoading(false);

      // Reset polling interval and retry count on success
      pollingIntervalRef.current = COMMITMENT_BOUNDS.POLLING_INITIAL_INTERVAL_MS;
      retryCountRef.current = 0;
      recordSuccess();
    } catch (err) {
      const error = err as Error;

      // Don't treat abort as error
      if (error.name === "AbortError") {
        return;
      }

      recordFailure();
      retryCountRef.current++;

      const sanitizedError = new Error(
        error.message.replace(/[a-f0-9]{64}/gi, "[REDACTED]"), // Remove potential secrets
      );

      setError(sanitizedError);
      setIsLoading(false);

      emitTelemetry({
        type: "polling_error",
        errorType: error.name,
        errorMessage: sanitizedError.message,
        metadata: {
          retryCount: retryCountRef.current,
          isCircuitOpen: circuitBreakerRef.current.isOpen,
        },
      });

      // Implement exponential backoff
      if (retryCountRef.current < COMMITMENT_BOUNDS.POLLING_MAX_RETRIES) {
        pollingIntervalRef.current = Math.min(
          pollingIntervalRef.current * COMMITMENT_BOUNDS.POLLING_BACKOFF_MULTIPLIER,
          COMMITMENT_BOUNDS.POLLING_MAX_INTERVAL_MS,
        );
      } else {
        // Stop polling after max retries
        isPollingRef.current = false;
        emitTelemetry({
          type: "polling_stopped",
          metadata: {
            reason: "max_retries_exceeded",
            retryCount: retryCountRef.current,
          },
        });
      }
    } finally {
      concurrentRequestsRef.current--;
      abortControllerRef.current = null;
    }
  }, [
    commitmentId,
    commitment,
    emitTelemetry,
    recordFailure,
    recordSuccess,
    shouldResetCircuitBreaker,
  ]);

  // Start polling
  const startPolling = useCallback(() => {
    if (!isPollingRef.current) {
      isPollingRef.current = true;
      retryCountRef.current = 0;
      pollingIntervalRef.current = COMMITMENT_BOUNDS.POLLING_INITIAL_INTERVAL_MS;
      emitTelemetry({
        type: "polling_started",
      });
    }
  }, [emitTelemetry]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (isPollingRef.current) {
      isPollingRef.current = false;
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      emitTelemetry({
        type: "polling_stopped",
        metadata: { reason: "manual_stop" },
      });
    }
  }, [emitTelemetry]);

  // Manual refetch
  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchCommitment();
  }, [fetchCommitment]);

  // Polling effect
  useEffect(() => {
    if (!enabled || !commitmentId) {
      stopPolling();
      return;
    }

    startPolling();

    const poll = async () => {
      if (!isPollingRef.current) return;

      await fetchCommitment();

      if (isPollingRef.current) {
        timeoutIdRef.current = setTimeout(poll, pollingIntervalRef.current);
      }
    };

    // Initial fetch
    poll();

    // Cleanup on unmount or dependency change
    return () => {
      stopPolling();
    };
  }, [enabled, commitmentId, fetchCommitment, startPolling, stopPolling]);

  return {
    commitment,
    isLoading,
    error,
    refetch,
    stopPolling,
    startPolling,
  };
}
