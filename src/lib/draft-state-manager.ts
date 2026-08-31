/**
 * Draft State Manager
 *
 * Manages draft state transitions, polling, request deduplication, and
 * concurrent operation limits. Ensures safe resume and cancellation behavior
 * across network reconnects and rapid user interactions.
 *
 * Key responsibilities:
 * - Enforce state machine invariants
 * - Deduplicate concurrent requests
 * - Manage polling with exponential backoff
 * - Prevent redundant fetches during route changes
 * - Track operation counts against concurrency limits
 */

import {
  CONCURRENCY_BOUNDS,
  DRAFT_BOUNDS,
  DraftState,
  POLLING_BOUNDS,
  FailureMode,
  VALID_STATE_TRANSITIONS,
  calculateNextRetryDelay,
  validateAmountInvariant,
  validateDraftIdInvariant,
  validateStateTransition,
  validateWalletAddressInvariant,
} from "./commitment-creation-invariants";
import { DiagnosticsTracker, getGlobalDiagnostics } from "./create-diagnostics";

/** ============================================================================
 * DRAFT STATE
 * ============================================================================ */

export interface DraftData {
  id: string;
  owner: string;
  network: "PUBLIC" | "TESTNET";
  amount: number;
  interestRate?: number;
  duration?: number;
  collateralAsset?: string;
  collateralAmount?: number;
  token?: string;
  integrity?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DraftStateSnapshot {
  state: DraftState;
  data: DraftData | null;
  failureMode: FailureMode;
  lastError: Error | null;
  attemptNumber: number;
  lastFetchTimeMs: number | null;
  isStale: boolean;
}

/** ============================================================================
 * REQUEST DEDUPLICATION
 * ============================================================================ */

interface PendingRequest {
  id: string;
  createdAtMs: number;
  promise: Promise<DraftData>;
}

/** ============================================================================
 * DRAFT STATE MANAGER
 * ============================================================================ */

export class DraftStateManager {
  private state: DraftState = DraftState.IDLE;
  private data: DraftData | null = null;
  private failureMode: FailureMode = FailureMode.NONE;
  private lastError: Error | null = null;
  private attemptNumber: number = 0;
  private lastFetchTimeMs: number | null = null;

  private pendingFetches: Map<string, PendingRequest> = new Map();
  private pendingSignatures: Map<string, Promise<string>> = new Map();
  private activeOperations: string[] = [];

  private diagnostics: DiagnosticsTracker;
  private pollTimeoutId: NodeJS.Timeout | null = null;

  constructor(diagnostics?: DiagnosticsTracker) {
    this.diagnostics = diagnostics ?? getGlobalDiagnostics();
  }

  /** ========================================================================
   * State Access
   * ======================================================================== */

  /**
   * Get current state snapshot (immutable view)
   */
  getSnapshot(): DraftStateSnapshot {
    return {
      state: this.state,
      data: this.data ? { ...this.data } : null,
      failureMode: this.failureMode,
      lastError: this.lastError,
      attemptNumber: this.attemptNumber,
      lastFetchTimeMs: this.lastFetchTimeMs,
      isStale: this.isDataStale(),
    };
  }

  /**
   * Get current state
   */
  getState(): DraftState {
    return this.state;
  }

  /**
   * Get current failure mode
   */
  getFailureMode(): FailureMode {
    return this.failureMode;
  }

  /**
   * Get last error
   */
  getLastError(): Error | null {
    return this.lastError;
  }

  /**
   * Get draft data (if available)
   */
  getData(): DraftData | null {
    return this.data ? { ...this.data } : null;
  }

  /**
   * Check if data is stale
   */
  private isDataStale(): boolean {
    if (this.lastFetchTimeMs === null) {
      return true;
    }

    return Date.now() - this.lastFetchTimeMs > POLLING_BOUNDS.STALE_DATA_THRESHOLD_MS;
  }

  /** ========================================================================
   * State Transitions
   * ======================================================================== */

  /**
   * Transition to a new state with validation
   * @throws Error if transition is invalid
   */
  private transitionTo(newState: DraftState): void {
    try {
      validateStateTransition(this.state, newState);
    } catch (error) {
      const err =
        error instanceof Error
          ? error
          : new Error(String(error));
      this.failureMode = FailureMode.UNKNOWN;
      this.lastError = err;
      throw err;
    }

    this.state = newState;
  }

  /**
   * Transition to FETCHING state and prepare to fetch
   */
  async transitionToFetching(): Promise<void> {
    this.transitionTo(DraftState.FETCHING);
    this.attemptNumber = 0;
    this.failureMode = FailureMode.NONE;
    this.lastError = null;
  }

  /**
   * Transition to LOADED state after successful fetch
   */
  setLoaded(data: DraftData): void {
    this.transitionTo(DraftState.LOADED);
    this.data = data;
    this.lastFetchTimeMs = Date.now();
    this.failureMode = FailureMode.NONE;
    this.lastError = null;
  }

  /**
   * Transition to ACTIVE state (user resumed draft)
   */
  setActive(): void {
    this.transitionTo(DraftState.ACTIVE);
    this.failureMode = FailureMode.NONE;
    this.diagnostics.recordInteraction();
  }

  /**
   * Transition to ERROR state with failure details
   */
  setError(failureMode: FailureMode, error: Error): void {
    // ERROR state can transition from multiple states
    this.state = DraftState.ERROR;
    this.failureMode = failureMode;
    this.lastError = error;
    this.diagnostics.recordError(
      failureMode,
      error.message,
      {
        retriable: this.failureMode === FailureMode.NETWORK ||
          this.failureMode === FailureMode.SERVER ||
          this.failureMode === FailureMode.TIMEOUT,
        attemptNumber: this.attemptNumber,
        includeStack: true,
      },
    );
  }

  /**
   * Transition to CANCELLED state
   */
  setCancelled(): void {
    if (this.state !== DraftState.CANCELLED) {
      this.transitionTo(DraftState.CANCELLED);
      this.failureMode = FailureMode.CANCELLED;
      this.clearPendingOperations();
    }
  }

  /**
   * Transition to COMPLETED state
   */
  setCompleted(): void {
    this.transitionTo(DraftState.COMPLETED);
    this.failureMode = FailureMode.NONE;
    this.clearPendingOperations();
  }

  /** ========================================================================
   * Fetch Deduplication
   * ======================================================================== */

  /**
   * Fetch draft data with automatic deduplication
   * Multiple concurrent requests for the same draft return the same promise
   */
  async fetchDraft(
    draftId: string,
    fetchFn: (id: string) => Promise<DraftData>,
  ): Promise<DraftData> {
    // Validate draft ID
    validateDraftIdInvariant(draftId);

    // Check deduplication window
    const existing = this.pendingFetches.get(draftId);
    if (existing && Date.now() - existing.createdAtMs < CONCURRENCY_BOUNDS.DEDUP_WINDOW_MS) {
      return existing.promise;
    }

    // Check concurrency limit
    if (this.activeOperations.length >= CONCURRENCY_BOUNDS.MAX_CONCURRENT_FETCHES) {
      throw new Error(
        `Too many concurrent fetches (max: ${CONCURRENCY_BOUNDS.MAX_CONCURRENT_FETCHES})`,
      );
    }

    const operationId = `fetch_${draftId}`;
    this.activeOperations.push(operationId);

    this.diagnostics.startFetchTiming();

    const promise = fetchFn(draftId)
      .then((data) => {
        this.diagnostics.endFetchTiming(true);
        this.lastFetchTimeMs = Date.now();
        this.setLoaded(data);
        return data;
      })
      .catch((error) => {
        this.diagnostics.endFetchTiming(false);

        let failureMode: FailureMode;
        if (error instanceof TypeError || error?.message?.includes("fetch")) {
          failureMode = FailureMode.NETWORK;
        } else if (error?.message?.includes("Unauthorized")) {
          failureMode = FailureMode.UNAUTHORIZED;
        } else if (error?.message?.includes("malformed") || error?.message?.includes("invalid")) {
          failureMode = FailureMode.MALFORMED_RESPONSE;
        } else {
          failureMode = FailureMode.SERVER;
        }

        this.setError(failureMode, error);
        throw error;
      })
      .finally(() => {
        this.activeOperations = this.activeOperations.filter((id) => id !== operationId);
        this.pendingFetches.delete(draftId);
      });

    const request: PendingRequest = {
      id: draftId,
      createdAtMs: Date.now(),
      promise,
    };

    this.pendingFetches.set(draftId, request);
    return promise;
  }

  /**
   * Retry fetch with exponential backoff
   */
  async retryFetch(
    draftId: string,
    fetchFn: (id: string) => Promise<DraftData>,
    maxRetries: number = POLLING_BOUNDS.MAX_RETRIES,
  ): Promise<DraftData> {
    this.attemptNumber = 0;

    while (this.attemptNumber < maxRetries) {
      try {
        return await this.fetchDraft(draftId, fetchFn);
      } catch (error) {
        this.attemptNumber++;

        if (this.attemptNumber >= maxRetries) {
          throw error;
        }

        // Check if error is retriable
        if (
          this.failureMode !== FailureMode.NETWORK &&
          this.failureMode !== FailureMode.SERVER &&
          this.failureMode !== FailureMode.TIMEOUT
        ) {
          throw error;
        }

        const delayMs = calculateNextRetryDelay(this.attemptNumber);
        await this.delay(delayMs);
      }
    }

    throw new Error(`Max retries (${maxRetries}) exceeded`);
  }

  /** ========================================================================
   * Signature Deduplication
   * ======================================================================== */

  /**
   * Sign transaction with concurrency limit
   * Multiple signatures for the same transaction are deduplicated
   */
  async signTransaction(
    transactionId: string,
    signFn: () => Promise<string>,
  ): Promise<string> {
    // Check deduplication
    const existing = this.pendingSignatures.get(transactionId);
    if (existing) {
      return existing;
    }

    // Check concurrency limit (max 1 signature at a time)
    if (this.activeOperations.length >= CONCURRENCY_BOUNDS.MAX_CONCURRENT_SIGNATURES) {
      throw new Error("Another signature operation is in progress");
    }

    const operationId = `sign_${transactionId}`;
    this.activeOperations.push(operationId);

    this.diagnostics.startSignatureTiming();

    const promise = signFn()
      .then((signature) => {
        this.diagnostics.endSignatureTiming(true);
        return signature;
      })
      .catch((error) => {
        this.diagnostics.endSignatureTiming(false);
        throw error;
      })
      .finally(() => {
        this.activeOperations = this.activeOperations.filter((id) => id !== operationId);
        this.pendingSignatures.delete(transactionId);
      });

    this.pendingSignatures.set(transactionId, promise);
    return promise;
  }

  /** ========================================================================
   * Persistence & Polling
   * ======================================================================== */

  /**
   * Record persistence operation started
   */
  startPersistence(): void {
    if (this.state !== DraftState.ACTIVE && this.state !== DraftState.PERSISTING) {
      this.transitionTo(DraftState.PERSISTING);
    }
    this.diagnostics.startPersistenceTiming();
  }

  /**
   * Record persistence operation completed
   */
  endPersistence(success: boolean = true): void {
    const durationMs = this.diagnostics.endPersistenceTiming(success);

    if (success) {
      this.failureMode = FailureMode.NONE;
      this.lastError = null;

      // Update last fetch time to mark data as fresh
      this.lastFetchTimeMs = Date.now();

      // Return to ACTIVE state if not in a terminal state
      if (this.state === DraftState.PERSISTING) {
        this.state = DraftState.ACTIVE;
      }
    }
  }

  /**
   * Poll for draft updates with backoff
   * Stops when condition is met or max duration exceeded
   */
  async poll(
    draftId: string,
    fetchFn: (id: string) => Promise<DraftData>,
    condition: (data: DraftData) => boolean,
    options: {
      maxDurationMs?: number;
      onUpdate?: (data: DraftData) => void;
    } = {},
  ): Promise<DraftData> {
    const maxDurationMs = options.maxDurationMs ?? POLLING_BOUNDS.MAX_POLL_DURATION_MS;
    const startTimeMs = Date.now();
    let delayMs = POLLING_BOUNDS.POLL_INTERVAL_MS;

    while (true) {
      const elapsedMs = Date.now() - startTimeMs;

      if (elapsedMs > maxDurationMs) {
        throw new Error(
          `Polling exceeded maximum duration of ${maxDurationMs}ms`,
        );
      }

      try {
        const data = await this.fetchDraft(draftId, fetchFn);
        this.diagnostics.recordPollIteration();

        if (condition(data)) {
          return data;
        }

        if (options.onUpdate) {
          options.onUpdate(data);
        }

        // Exponential backoff up to max delay
        await this.delay(delayMs);
        delayMs = Math.min(
          delayMs * POLLING_BOUNDS.BACKOFF_MULTIPLIER,
          POLLING_BOUNDS.MAX_RETRY_DELAY_MS,
        );
      } catch (error) {
        // Network errors are retriable during polling
        if (
          this.failureMode === FailureMode.NETWORK ||
          this.failureMode === FailureMode.SERVER
        ) {
          const retryDelayMs = calculateNextRetryDelay(this.attemptNumber);
          await this.delay(retryDelayMs);
          this.attemptNumber++;
        } else {
          throw error;
        }
      }
    }
  }

  /** ========================================================================
   * Cleanup & Recovery
   * ======================================================================== */

  /**
   * Clear all pending operations
   */
  private clearPendingOperations(): void {
    this.pendingFetches.clear();
    this.pendingSignatures.clear();
    this.activeOperations = [];

    if (this.pollTimeoutId) {
      clearTimeout(this.pollTimeoutId);
      this.pollTimeoutId = null;
    }
  }

  /**
   * Reset to initial state (for new creation flow)
   */
  reset(): void {
    this.state = DraftState.IDLE;
    this.data = null;
    this.failureMode = FailureMode.NONE;
    this.lastError = null;
    this.attemptNumber = 0;
    this.lastFetchTimeMs = null;
    this.clearPendingOperations();
  }

  /**
   * Cleanup resources (call on component unmount)
   */
  destroy(): void {
    this.clearPendingOperations();
  }

  /** ========================================================================
   * Internal Helpers
   * ======================================================================== */

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.pollTimeoutId = setTimeout(resolve, ms);
    });
  }

  /**
   * Check if manager has any pending operations
   */
  hasPendingOperations(): boolean {
    return this.activeOperations.length > 0 ||
      this.pendingFetches.size > 0 ||
      this.pendingSignatures.size > 0;
  }

  /**
   * Get count of active operations
   */
  getActiveOperationCount(): number {
    return this.activeOperations.length;
  }

  /**
   * Check if at concurrency limit for fetches
   */
  isAtFetchLimit(): boolean {
    return this.activeOperations.filter((id) => id.startsWith("fetch_")).length >=
      CONCURRENCY_BOUNDS.MAX_CONCURRENT_FETCHES;
  }
}
