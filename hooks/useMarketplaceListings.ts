/**
 * useMarketplaceListings
 *
 * Fetches marketplace listings with bounded filters and optional auto-polling.
 *
 * Invariants enforced here:
 *  - Stale responses: a monotonically-increasing request id means a slow,
 *    out-of-order response can never clobber a newer result. AbortController
 *    cancels the previous in-flight request before starting a new one.
 *  - Concurrent request cap: at most MAX_CONCURRENT_REQUESTS requests may be
 *    in-flight simultaneously; excess calls emit a telemetry event and no-op.
 *  - Filter validation: candidate filters are run through the same
 *    `normalizeAndValidateFilters` invariants the API uses — an out-of-bounds
 *    filter is reported as `filterErrors` and never sent to the server.
 *  - Bounded polling: auto-refresh uses exponential backoff capped at
 *    POLLING_MAX_INTERVAL_MS. After POLLING_MAX_RETRIES consecutive failures
 *    polling stops and the circuit-breaker opens. The circuit auto-closes after
 *    CIRCUIT_BREAKER_RESET_MS, allowing recovery without a page reload.
 *  - Per-request network timeout: every fetch is raced against
 *    REQUEST_TIMEOUT_MS so a hung connection never blocks the hook indefinitely.
 *  - Operational visibility: every significant path (start, success, failure,
 *    stale drop, circuit-breaker open/close, poll lifecycle) emits a structured
 *    MarketplaceTelemetryEvent through the optional `onTelemetry` callback.
 *    No secrets, PII, or raw server responses are forwarded.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeAndValidateFilters } from "@/lib/marketplace/invariants";
import {
  MARKETPLACE_BOUNDS,
  type MarketplaceCircuitBreakerState,
  type MarketplaceFilters,
  type MarketplaceListing,
  type MarketplaceTelemetryEvent,
} from "@/types/marketplace";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface UseMarketplaceListingsOptions {
  initialFilters?: MarketplaceFilters;
  /** Fetch once on mount and expose manual controls (default). */
  autoFetch?: boolean;
  /**
   * When set to a positive number, the hook polls at that interval (ms).
   * The value is clamped to [POLLING_MIN_INTERVAL_MS, POLLING_MAX_INTERVAL_MS].
   * Omit or set to 0 to disable polling.
   */
  pollingIntervalMs?: number;
  /** Receive structured diagnostics for latency, failure, and recovery paths. */
  onTelemetry?: (event: MarketplaceTelemetryEvent) => void;
}

export interface UseMarketplaceListingsReturn {
  listings: MarketplaceListing[];
  total: number;
  nextCursor: string | null;
  isLoading: boolean;
  error: { code: string; message: string } | null;
  filters: MarketplaceFilters;
  filterErrors: Record<string, string>;
  /** True while the circuit-breaker is open (polling auto-paused). */
  isCircuitOpen: boolean;
  applyFilters: (patch: Partial<MarketplaceFilters>) => Promise<boolean>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  reset: () => void;
  /** Manually start auto-polling (no-op if pollingIntervalMs is not set). */
  startPolling: () => void;
  /** Manually stop auto-polling. */
  stopPolling: () => void;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ListingsEnvelope {
  success: boolean;
  data?: {
    listings: MarketplaceListing[];
    nextCursor: string | null;
    total: number;
    filters?: unknown;
  };
  error?: { code: string; message: string };
}

const EMPTY_FILTERS: MarketplaceFilters = {
  availability: "available",
  sort: "newest",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toRawFilters(filters: MarketplaceFilters): Record<string, string | undefined> {
  return {
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    asset: filters.asset,
    category: filters.category,
    availability: filters.availability,
    sort: filters.sort,
    cursor: filters.cursor,
    pageSize: filters.pageSize !== undefined ? String(filters.pageSize) : undefined,
  };
}

function buildQuery(filters: MarketplaceFilters): string {
  const params = new URLSearchParams();
  const raw = toRawFilters(filters);
  for (const [key, value] of Object.entries(raw)) {
    if (value !== undefined && value !== "") {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function clampPollingInterval(ms: number): number {
  return Math.min(
    MARKETPLACE_BOUNDS.POLLING_MAX_INTERVAL_MS,
    Math.max(MARKETPLACE_BOUNDS.POLLING_MIN_INTERVAL_MS, ms),
  );
}

function sanitiseMessage(msg: string): string {
  // Strip potential 32-64 char hex sequences (transaction hashes, keys) and
  // Stellar addresses (G... 56 chars) before forwarding to telemetry.
  return msg.replace(/\b[A-Fa-f0-9]{32,64}\b/g, "[redacted]").replace(/\bG[A-Z2-7]{55}\b/g, "[address]");
}

function patchKey(patch: Partial<MarketplaceFilters>): string {
  return Object.keys(patch)[0] ?? "message";
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMarketplaceListings({
  initialFilters,
  autoFetch = true,
  pollingIntervalMs = 0,
  onTelemetry,
}: UseMarketplaceListingsOptions = {}): UseMarketplaceListingsReturn {
  const [filters, setFilters] = useState<MarketplaceFilters>(
    initialFilters ?? EMPTY_FILTERS,
  );
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [filterErrors, setFilterErrors] = useState<Record<string, string>>({});
  const [isCircuitOpen, setIsCircuitOpen] = useState(false);

  // Request identity / concurrency
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const concurrentRef = useRef(0);

  // Polling state
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPollingRef = useRef(false);
  const pollIntervalRef = useRef(
    pollingIntervalMs > 0 ? clampPollingInterval(pollingIntervalMs) : 0,
  );
  const pollRetriesRef = useRef(0);

  // Circuit-breaker (mutable ref — no re-render on internal state change)
  const circuitRef = useRef<MarketplaceCircuitBreakerState>({
    isOpen: false,
    failureCount: 0,
    lastFailureTime: 0,
  });

  // Keep latest filters accessible inside callbacks without stale closure
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Keep latest onTelemetry accessible without re-creating callbacks
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
  // Circuit-breaker helpers
  // -------------------------------------------------------------------------

  const tryResetCircuit = useCallback((): boolean => {
    const cb = circuitRef.current;
    if (
      cb.isOpen &&
      Date.now() - cb.lastFailureTime > MARKETPLACE_BOUNDS.CIRCUIT_BREAKER_RESET_MS
    ) {
      cb.isOpen = false;
      cb.failureCount = 0;
      setIsCircuitOpen(false);
      emit({ type: "circuit_breaker_closed", metadata: { reason: "timeout_expired" } });
      return true;
    }
    return !cb.isOpen;
  }, [emit]);

  const recordCircuitFailure = useCallback(() => {
    const cb = circuitRef.current;
    cb.failureCount++;
    cb.lastFailureTime = Date.now();
    if (
      cb.failureCount >= MARKETPLACE_BOUNDS.CIRCUIT_BREAKER_THRESHOLD &&
      !cb.isOpen
    ) {
      cb.isOpen = true;
      setIsCircuitOpen(true);
      emit({
        type: "circuit_breaker_opened",
        metadata: { failureCount: cb.failureCount },
      });
    }
  }, [emit]);

  const recordCircuitSuccess = useCallback(() => {
    const cb = circuitRef.current;
    if (cb.failureCount > 0 || cb.isOpen) {
      cb.failureCount = 0;
      cb.isOpen = false;
      setIsCircuitOpen(false);
      emit({ type: "circuit_breaker_closed", metadata: { reason: "request_succeeded" } });
    }
    pollRetriesRef.current = 0;
    pollIntervalRef.current =
      pollingIntervalMs > 0
        ? clampPollingInterval(pollingIntervalMs)
        : MARKETPLACE_BOUNDS.POLLING_DEFAULT_INTERVAL_MS;
  }, [emit, pollingIntervalMs]);

  // -------------------------------------------------------------------------
  // Core fetch
  // -------------------------------------------------------------------------

  const fetchPage = useCallback(
    async (spec: MarketplaceFilters, replace: boolean): Promise<void> => {
      // Circuit-breaker: check if still open (or can be auto-closed).
      if (circuitRef.current.isOpen && !tryResetCircuit()) {
        emit({ type: "fetch_failed", errorCode: "circuit_open", errorMessage: "Circuit breaker is open." });
        return;
      }

      // Concurrent request cap.
      if (concurrentRef.current >= MARKETPLACE_BOUNDS.MAX_CONCURRENT_REQUESTS) {
        emit({
          type: "concurrent_limit_exceeded",
          metadata: { limit: MARKETPLACE_BOUNDS.MAX_CONCURRENT_REQUESTS },
        });
        return;
      }

      const requestId = ++requestIdRef.current;

      // Cancel any previously in-flight fetch.
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Per-request network timeout.
      const timeoutId = setTimeout(
        () => controller.abort(),
        MARKETPLACE_BOUNDS.REQUEST_TIMEOUT_MS,
      );

      concurrentRef.current++;
      setIsLoading(true);
      setError(null);

      const startTime = Date.now();
      emit({ type: "fetch_started" });

      try {
        const response = await fetch(
          `/api/marketplace/listings${buildQuery(spec)}`,
          {
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
          },
        );

        clearTimeout(timeoutId);
        const latencyMs = Date.now() - startTime;

        // Stale-response guard.
        if (requestIdRef.current !== requestId) {
          emit({ type: "stale_response_dropped", latencyMs });
          return;
        }

        const body = (await response.json()) as ListingsEnvelope;
        if (requestIdRef.current !== requestId) {
          emit({ type: "stale_response_dropped", latencyMs });
          return;
        }

        emit({ type: "latency", latencyMs });

        if (!response.ok || !body.success || !body.data) {
          const errCode = body.error?.code ?? "unknown";
          const errMsg = sanitiseMessage(body.error?.message ?? "Failed to load listings.");
          setError({ code: errCode, message: errMsg });
          recordCircuitFailure();
          emit({ type: "fetch_failed", errorCode: errCode, errorMessage: errMsg, latencyMs });
          return;
        }

        setListings((prev) =>
          replace ? body.data!.listings : [...prev, ...body.data!.listings],
        );
        setTotal(body.data.total);
        setNextCursor(body.data.nextCursor);
        recordCircuitSuccess();
        emit({ type: "fetch_succeeded", latencyMs, metadata: { total: body.data.total } });
      } catch (cause) {
        clearTimeout(timeoutId);
        if (requestIdRef.current !== requestId) return;
        const err = cause as Error;
        if (err.name === "AbortError") {
          // Distinguish intentional abort (new request superseded) vs timeout.
          const isTimeout = Date.now() - startTime >= MARKETPLACE_BOUNDS.REQUEST_TIMEOUT_MS - 50;
          if (isTimeout) {
            setError({ code: "timeout", message: "Request timed out." });
            recordCircuitFailure();
            emit({ type: "fetch_failed", errorCode: "timeout", errorMessage: "Request timed out." });
          }
          return;
        }
        const sanitised = sanitiseMessage(err.message);
        setError({ code: "network_error", message: sanitised });
        recordCircuitFailure();
        emit({ type: "fetch_failed", errorCode: "network_error", errorMessage: sanitised });
      } finally {
        concurrentRef.current--;
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [emit, recordCircuitFailure, recordCircuitSuccess, tryResetCircuit],
  );

  // -------------------------------------------------------------------------
  // Polling
  // -------------------------------------------------------------------------

  const stopPolling = useCallback(() => {
    if (!isPollingRef.current) return;
    isPollingRef.current = false;
    if (pollingTimerRef.current !== null) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    emit({ type: "poll_stopped", metadata: { reason: "manual" } });
  }, [emit]);

  const scheduleNextPoll = useCallback(() => {
    if (!isPollingRef.current) return;
    pollingTimerRef.current = setTimeout(async () => {
      if (!isPollingRef.current) return;

      // Backoff exhausted → stop polling.
      if (pollRetriesRef.current >= MARKETPLACE_BOUNDS.POLLING_MAX_RETRIES) {
        isPollingRef.current = false;
        emit({
          type: "poll_stopped",
          metadata: { reason: "max_retries_exceeded", retries: pollRetriesRef.current },
        });
        return;
      }

      await fetchPage(filtersRef.current, true);

      // Apply exponential backoff if the circuit recorded a failure.
      if (circuitRef.current.failureCount > 0) {
        pollRetriesRef.current++;
        pollIntervalRef.current = Math.min(
          pollIntervalRef.current * MARKETPLACE_BOUNDS.POLLING_BACKOFF_MULTIPLIER,
          MARKETPLACE_BOUNDS.POLLING_MAX_INTERVAL_MS,
        );
      }

      scheduleNextPoll();
    }, pollIntervalRef.current);
  }, [emit, fetchPage]);

  const startPolling = useCallback(() => {
    if (isPollingRef.current) return;
    if (pollIntervalRef.current <= 0) return; // Polling not configured.
    isPollingRef.current = true;
    pollRetriesRef.current = 0;
    emit({ type: "poll_started", metadata: { intervalMs: pollIntervalRef.current } });
    scheduleNextPoll();
  }, [emit, scheduleNextPoll]);

  // -------------------------------------------------------------------------
  // Public actions
  // -------------------------------------------------------------------------

  const applyFilters = useCallback(
    async (patch: Partial<MarketplaceFilters>): Promise<boolean> => {
      const candidate: MarketplaceFilters = { ...filtersRef.current, ...patch };
      const validation = normalizeAndValidateFilters(toRawFilters(candidate));
      if (!validation.ok) {
        setFilterErrors({ [patchKey(patch)]: validation.message });
        return false;
      }
      setFilterErrors({});
      setFilters(validation.value);
      emit({ type: "filter_applied" });
      await fetchPage(validation.value, true);
      return true;
    },
    [emit, fetchPage],
  );

  const refresh = useCallback(
    () => fetchPage(filtersRef.current, true),
    [fetchPage],
  );

  const loadMore = useCallback(() => {
    if (!nextCursor) return Promise.resolve();
    const spec: MarketplaceFilters = { ...filtersRef.current, cursor: nextCursor };
    return fetchPage(spec, false);
  }, [fetchPage, nextCursor]);

  const reset = useCallback(() => {
    stopPolling();
    setFilters(initialFilters ?? EMPTY_FILTERS);
    setFilterErrors({});
    setListings([]);
    setNextCursor(null);
    setError(null);
  }, [initialFilters, stopPolling]);

  // -------------------------------------------------------------------------
  // Mount / cleanup effects
  // -------------------------------------------------------------------------

  // Initial fetch on mount.
  useEffect(() => {
    if (autoFetch) {
      void fetchPage(filtersRef.current, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start or restart polling whenever the interval option changes.
  useEffect(() => {
    if (pollingIntervalMs > 0) {
      const clamped = clampPollingInterval(pollingIntervalMs);
      pollIntervalRef.current = clamped;
      if (!isPollingRef.current) startPolling();
    } else {
      stopPolling();
    }
    return () => {
      stopPolling();
      abortControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollingIntervalMs]);

  return {
    listings,
    total,
    nextCursor,
    isLoading,
    error,
    filters,
    filterErrors,
    isCircuitOpen,
    applyFilters,
    refresh,
    loadMore,
    reset,
    startPolling,
    stopPolling,
  };
}
