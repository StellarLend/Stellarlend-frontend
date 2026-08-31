/**
 * Commitment Creation Diagnostics & Telemetry
 *
 * Tracks latency, failure modes, recovery paths, and resource usage for
 * commitment creation flows. Designed to expose actionable diagnostics
 * without leaking secrets or sensitive wallet information.
 *
 * Structure:
 * - Event tracking (start/end/error)
 * - Latency metrics (in milliseconds)
 * - Error categorization and recovery paths
 * - Resource usage bounds enforcement
 * - Structured logging for investigation
 */

import { ERROR_BOUNDS, FailureMode } from "./commitment-creation-invariants";

/** ============================================================================
 * METRIC TYPES
 * ============================================================================ */

export interface TimingMetric {
  startTimeMs: number;
  endTimeMs?: number;
  durationMs?: number;
}

export interface ErrorMetric {
  code: FailureMode;
  message: string;
  retriable: boolean;
  recoveryHint?: string;
  attemptNumber?: number;
  stackTrace?: string[];
}

export interface ResourceMetric {
  fetchCount: number;
  signatureCount: number;
  persistenceCount: number;
  pollIterations: number;
  estimatedBytesUsed: number;
}

export interface CreateDiagnostics {
  sessionId: string;
  startTimeMs: number;
  /** Current operation being tracked */
  operation?: string;
  /** Timing for fetch operations */
  fetchTiming: TimingMetric[];
  /** Timing for wallet signature operations */
  signatureTiming: TimingMetric[];
  /** Timing for persistence operations */
  persistenceTiming: TimingMetric[];
  /** All errors that occurred */
  errors: ErrorMetric[];
  /** Current failure mode (if any) */
  currentFailure: ErrorMetric | null;
  /** Resource usage metrics */
  resources: ResourceMetric;
  /** Timestamp of last user interaction */
  lastInteractionTimeMs: number;
  /** Count of user interactions (resume attempts, discard, etc) */
  interactionCount: number;
  /** Number of network reconnections detected */
  reconnectionCount: number;
  /** Number of route changes during operation */
  routeChangeCount: number;
}

/** ============================================================================
 * DIAGNOSTIC EVENT TRACKING
 * ============================================================================ */

export class DiagnosticsTracker {
  private diagnostics: CreateDiagnostics;

  constructor(sessionId?: string) {
    this.diagnostics = {
      sessionId: sessionId ?? this.generateSessionId(),
      startTimeMs: Date.now(),
      fetchTiming: [],
      signatureTiming: [],
      persistenceTiming: [],
      errors: [],
      currentFailure: null,
      resources: {
        fetchCount: 0,
        signatureCount: 0,
        persistenceCount: 0,
        pollIterations: 0,
        estimatedBytesUsed: 0,
      },
      lastInteractionTimeMs: Date.now(),
      interactionCount: 0,
      reconnectionCount: 0,
      routeChangeCount: 0,
    };
  }

  /** ========================================================================
   * Timing Operations
   * ======================================================================== */

  startFetchTiming(): void {
    this.diagnostics.fetchTiming.push({ startTimeMs: Date.now() });
    this.diagnostics.resources.fetchCount++;
    this.diagnostics.operation = "fetch";
  }

  endFetchTiming(success: boolean = true): number {
    const last = this.diagnostics.fetchTiming[this.diagnostics.fetchTiming.length - 1];
    if (last && !last.endTimeMs) {
      last.endTimeMs = Date.now();
      last.durationMs = last.endTimeMs - last.startTimeMs;
      return last.durationMs;
    }
    return 0;
  }

  startSignatureTiming(): void {
    this.diagnostics.signatureTiming.push({ startTimeMs: Date.now() });
    this.diagnostics.resources.signatureCount++;
    this.diagnostics.operation = "signature";
  }

  endSignatureTiming(success: boolean = true): number {
    const last = this.diagnostics.signatureTiming[this.diagnostics.signatureTiming.length - 1];
    if (last && !last.endTimeMs) {
      last.endTimeMs = Date.now();
      last.durationMs = last.endTimeMs - last.startTimeMs;
      return last.durationMs;
    }
    return 0;
  }

  startPersistenceTiming(): void {
    this.diagnostics.persistenceTiming.push({ startTimeMs: Date.now() });
    this.diagnostics.resources.persistenceCount++;
    this.diagnostics.operation = "persistence";
  }

  endPersistenceTiming(success: boolean = true): number {
    const last = this.diagnostics.persistenceTiming[this.diagnostics.persistenceTiming.length - 1];
    if (last && !last.endTimeMs) {
      last.endTimeMs = Date.now();
      last.durationMs = last.endTimeMs - last.startTimeMs;
      return last.durationMs;
    }
    return 0;
  }

  recordPollIteration(): void {
    this.diagnostics.resources.pollIterations++;
  }

  /** ========================================================================
   * Error & Failure Tracking
   * ======================================================================== */

  recordError(
    code: FailureMode,
    message: string,
    options: {
      retriable?: boolean;
      recoveryHint?: string;
      attemptNumber?: number;
      includeStack?: boolean;
    } = {},
  ): void {
    const truncatedMessage = message.slice(0, ERROR_BOUNDS.MAX_ERROR_MESSAGE_LENGTH);
    const stackTrace = options.includeStack
      ? this.captureStackTrace()
      : undefined;

    const error: ErrorMetric = {
      code,
      message: truncatedMessage,
      retriable: options.retriable ?? false,
      recoveryHint: options.recoveryHint,
      attemptNumber: options.attemptNumber,
      stackTrace,
    };

    this.diagnostics.errors.push(error);
    this.diagnostics.currentFailure = error;
  }

  clearCurrentFailure(): void {
    this.diagnostics.currentFailure = null;
  }

  /** ========================================================================
   * Interaction & State Tracking
   * ======================================================================== */

  recordInteraction(): void {
    this.diagnostics.lastInteractionTimeMs = Date.now();
    this.diagnostics.interactionCount++;
  }

  recordReconnection(): void {
    this.diagnostics.reconnectionCount++;
  }

  recordRouteChange(): void {
    this.diagnostics.routeChangeCount++;
  }

  recordBytesUsed(bytes: number): void {
    this.diagnostics.resources.estimatedBytesUsed += bytes;
  }

  /** ========================================================================
   * Aggregated Metrics
   * ======================================================================== */

  /**
   * Get total elapsed time since start
   */
  getElapsedMs(): number {
    return Date.now() - this.diagnostics.startTimeMs;
  }

  /**
   * Get total time spent in fetch operations
   */
  getTotalFetchTimeMs(): number {
    return this.diagnostics.fetchTiming.reduce(
      (sum, timing) => sum + (timing.durationMs ?? 0),
      0,
    );
  }

  /**
   * Get total time spent in signature operations
   */
  getTotalSignatureTimeMs(): number {
    return this.diagnostics.signatureTiming.reduce(
      (sum, timing) => sum + (timing.durationMs ?? 0),
      0,
    );
  }

  /**
   * Get average fetch latency
   */
  getAverageFetchLatencyMs(): number {
    if (this.diagnostics.fetchTiming.length === 0) return 0;
    return this.getTotalFetchTimeMs() / this.diagnostics.fetchTiming.length;
  }

  /**
   * Get average signature latency
   */
  getAverageSignatureLatencyMs(): number {
    if (this.diagnostics.signatureTiming.length === 0) return 0;
    return this.getTotalSignatureTimeMs() / this.diagnostics.signatureTiming.length;
  }

  /**
   * Get retry count (errors marked as retriable)
   */
  getRetryCount(): number {
    return this.diagnostics.errors.filter((e) => e.retriable).length;
  }

  /**
   * Get count of non-retriable errors
   */
  getFatalErrorCount(): number {
    return this.diagnostics.errors.filter((e) => !e.retriable).length;
  }

  /** ========================================================================
   * Diagnostics Report
   * ======================================================================== */

  /**
   * Generate a structured diagnostic report for logging/analysis
   * Does NOT include secrets (wallet addresses, tokens, etc)
   */
  generateReport(): {
    sessionId: string;
    totalElapsedMs: number;
    operationCounts: {
      fetches: number;
      signatures: number;
      persistences: number;
      pollIterations: number;
    };
    latencies: {
      averageFetchMs: number;
      averageSignatureMs: number;
      totalFetchMs: number;
      totalSignatureMs: number;
      totalPersistenceMs: number;
    };
    errors: {
      total: number;
      retriable: number;
      fatal: number;
      byCode: Record<string, number>;
    };
    resources: {
      estimatedBytesUsed: number;
      withinBounds: boolean;
    };
    interactions: {
      userInteractionCount: number;
      reconnectionCount: number;
      routeChangeCount: number;
    };
    currentState: {
      hasFailure: boolean;
      failureCode?: FailureMode;
      failureRetriable?: boolean;
      recoveryHint?: string;
    };
  } {
    const errorsByCode = this.diagnostics.errors.reduce(
      (acc, error) => {
        acc[error.code] = (acc[error.code] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      sessionId: this.diagnostics.sessionId,
      totalElapsedMs: this.getElapsedMs(),
      operationCounts: {
        fetches: this.diagnostics.resources.fetchCount,
        signatures: this.diagnostics.resources.signatureCount,
        persistences: this.diagnostics.resources.persistenceCount,
        pollIterations: this.diagnostics.resources.pollIterations,
      },
      latencies: {
        averageFetchMs: this.getAverageFetchLatencyMs(),
        averageSignatureMs: this.getAverageSignatureLatencyMs(),
        totalFetchMs: this.getTotalFetchTimeMs(),
        totalSignatureMs: this.getTotalSignatureTimeMs(),
        totalPersistenceMs: this.diagnostics.persistenceTiming.reduce(
          (sum, timing) => sum + (timing.durationMs ?? 0),
          0,
        ),
      },
      errors: {
        total: this.diagnostics.errors.length,
        retriable: this.getRetryCount(),
        fatal: this.getFatalErrorCount(),
        byCode: errorsByCode,
      },
      resources: {
        estimatedBytesUsed: this.diagnostics.resources.estimatedBytesUsed,
        withinBounds: true, // Would need to enforce max here
      },
      interactions: {
        userInteractionCount: this.diagnostics.interactionCount,
        reconnectionCount: this.diagnostics.reconnectionCount,
        routeChangeCount: this.diagnostics.routeChangeCount,
      },
      currentState: {
        hasFailure: this.diagnostics.currentFailure !== null,
        failureCode: this.diagnostics.currentFailure?.code,
        failureRetriable: this.diagnostics.currentFailure?.retriable,
        recoveryHint: this.diagnostics.currentFailure?.recoveryHint,
      },
    };
  }

  /**
   * Export diagnostics for debugging (for developers only, with caution)
   * May contain sensitive information - use only in dev console
   */
  exportForDebugging(): CreateDiagnostics {
    return { ...this.diagnostics };
  }

  /** ========================================================================
   * Internal Helpers
   * ======================================================================== */

  private generateSessionId(): string {
    return `create_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private captureStackTrace(): string[] {
    const stack = new Error().stack ?? "";
    return stack
      .split("\n")
      .slice(2) // Skip first two frames
      .slice(0, ERROR_BOUNDS.MAX_STACK_DEPTH)
      .map((line) => line.trim());
  }
}

/**
 * Global diagnostics instance (shared across the create flow)
 */
let globalDiagnostics: DiagnosticsTracker | null = null;

/**
 * Initialize or get the global diagnostics tracker
 */
export function getGlobalDiagnostics(sessionId?: string): DiagnosticsTracker {
  if (!globalDiagnostics) {
    globalDiagnostics = new DiagnosticsTracker(sessionId);
  }
  return globalDiagnostics;
}

/**
 * Reset the global diagnostics (useful for testing or new sessions)
 */
export function resetGlobalDiagnostics(): void {
  globalDiagnostics = null;
}

/**
 * Common recovery hints for different failure modes
 */
export const RECOVERY_HINTS: Record<FailureMode, string> = {
  [FailureMode.NONE]: "No error",
  [FailureMode.NETWORK]: "Check internet connection and try again",
  [FailureMode.SERVER]: "Server is temporarily unavailable; try again in a few moments",
  [FailureMode.WALLET_DISCONNECTED]: "Reconnect your wallet to continue",
  [FailureMode.NETWORK_MISMATCH]:
    "Switch your wallet to the correct network (check draft creation network)",
  [FailureMode.UNAUTHORIZED]:
    "Only the draft creator can resume this draft; connect with the correct wallet",
  [FailureMode.VALIDATION]: "Check that all fields are filled in correctly",
  [FailureMode.CANCELLED]: "Operation was cancelled",
  [FailureMode.TIMEOUT]: "Operation took too long; try again",
  [FailureMode.MALFORMED_RESPONSE]:
    "Server response was invalid; contact support if this persists",
  [FailureMode.UNKNOWN]: "An unexpected error occurred; try refreshing the page",
};

/**
 * Determine if a failure mode is retriable
 */
export function isFailureRetriable(mode: FailureMode): boolean {
  const retriableFailures = [
    FailureMode.NETWORK,
    FailureMode.SERVER,
    FailureMode.TIMEOUT,
  ];
  return retriableFailures.includes(mode);
}
