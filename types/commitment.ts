/**
 * Commitment detail action state machine types
 * Defines explicit states, actions, authorization, and failure invariants
 */

/**
 * Commitment status represents the authoritative state from the backend
 */
export type CommitmentStatus =
  | "pending"      // Awaiting initial funding
  | "active"       // Fully funded and running
  | "disputed"     // Under dispute resolution
  | "early_exit"   // Early exit requested
  | "settled"      // Completed normally
  | "defaulted"    // Failed to meet obligations
  | "cancelled";   // Cancelled before activation

/**
 * Available user actions based on commitment status
 */
export type CommitmentActionType = "fund" | "dispute" | "early_exit" | "settle";

/**
 * Action state for UI interaction
 */
export type ActionState = "idle" | "loading" | "success" | "error";

/**
 * Commitment data structure
 */
export interface Commitment {
  id: string;
  status: CommitmentStatus;
  borrower: string;
  lender: string;
  asset: string;
  amount: number;
  interestRate: number;
  duration: number; // days
  collateralAsset: string;
  collateralAmount: number;
  fundedAmount: number;
  outstandingDebt: number;
  createdAt: string;
  updatedAt: string;
  maturityDate?: string;
  transactionHash?: string;
}

/**
 * Action authorization result
 */
export interface ActionAuthorization {
  allowed: boolean;
  reason?: string;
}

/**
 * Explicit bounds for performance and safety
 */
export const COMMITMENT_BOUNDS = {
  // Polling configuration
  POLLING_INITIAL_INTERVAL_MS: 2000,     // Start at 2s
  POLLING_MAX_INTERVAL_MS: 30000,        // Cap at 30s
  POLLING_BACKOFF_MULTIPLIER: 1.5,       // Exponential backoff factor
  POLLING_MAX_RETRIES: 10,                // Stop after 10 failed attempts
  
  // Request timeout and concurrency
  REQUEST_TIMEOUT_MS: 10000,              // 10s timeout per request
  MAX_CONCURRENT_REQUESTS: 2,             // Limit concurrent API calls
  
  // Circuit breaker
  CIRCUIT_BREAKER_THRESHOLD: 5,           // Open circuit after 5 failures
  CIRCUIT_BREAKER_RESET_MS: 60000,        // Reset after 1 minute
  
  // Telemetry
  TELEMETRY_BATCH_SIZE: 10,               // Batch telemetry events
  TELEMETRY_FLUSH_INTERVAL_MS: 5000,      // Flush every 5s
} as const;

/**
 * State machine transition rules
 * Maps current status to allowed actions
 */
export const COMMITMENT_STATE_MACHINE: Record<
  CommitmentStatus,
  CommitmentActionType[]
> = {
  pending: ["fund"],
  active: ["dispute", "early_exit", "settle"],
  disputed: [], // No actions during dispute resolution
  early_exit: ["settle"],
  settled: [],
  defaulted: [],
  cancelled: [],
};

/**
 * Telemetry event types for operational visibility
 */
export type TelemetryEventType =
  | "action_initiated"
  | "action_completed"
  | "action_failed"
  | "polling_started"
  | "polling_stopped"
  | "polling_error"
  | "api_latency"
  | "circuit_breaker_opened"
  | "circuit_breaker_closed"
  | "state_transition";

/**
 * Telemetry event structure (no secrets)
 */
export interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: number;
  commitmentId: string;
  action?: CommitmentActionType;
  status?: CommitmentStatus;
  latencyMs?: number;
  errorType?: string;
  errorMessage?: string; // Sanitized, no sensitive data
  metadata?: Record<string, string | number | boolean>;
}

/**
 * API response for commitment details
 */
export interface CommitmentDetailResponse {
  commitment: Commitment;
  canPerformActions: Record<CommitmentActionType, ActionAuthorization>;
}

/**
 * Action request payload
 */
export interface CommitmentActionRequest {
  commitmentId: string;
  action: CommitmentActionType;
  signedEnvelopeXdr?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Action response
 */
export interface CommitmentActionResponse {
  success: boolean;
  transactionHash?: string;
  newStatus?: CommitmentStatus;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Circuit breaker state
 */
export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
}
