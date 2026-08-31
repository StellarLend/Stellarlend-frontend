/**
 * Commitment Creation Invariants
 *
 * Defines explicit bounds, state transitions, and failure modes for the commitment
 * creation and draft persistence feature. These invariants ensure safe resume,
 * cancellation, and degradation behavior across client validation, wallet signing,
 * and persistence layers.
 *
 * Design tradeoffs:
 * - Strict bounds prevent resource exhaustion but require careful UX error handling
 * - Polling bounds trade responsiveness for network stability
 * - Concurrent request limits prevent race conditions but require request queuing
 */

/** ============================================================================
 * AMOUNT & FINANCIAL BOUNDS
 * ============================================================================ */

export const COMMITMENT_AMOUNT_BOUNDS = {
  /** Minimum commitment amount in XLM (Stellar native asset) */
  MIN_AMOUNT: 1,
  /** Maximum commitment amount - prevents overflow in number calculations */
  MAX_AMOUNT: Number.MAX_SAFE_INTEGER,
  /** Precision decimals for amount validation */
  DECIMAL_PLACES: 7,
} as const;

export const INTEREST_RATE_BOUNDS = {
  /** Minimum annual interest rate in percentage points */
  MIN_RATE: 0.1,
  /** Maximum annual interest rate in percentage points */
  MAX_RATE: 1000,
} as const;

export const DURATION_BOUNDS = {
  /** Minimum commitment duration in days */
  MIN_DAYS: 1,
  /** Maximum commitment duration in days (10 years) */
  MAX_DAYS: 3650,
} as const;

export const COLLATERAL_BOUNDS = {
  /** Minimum collateral amount */
  MIN_AMOUNT: 1,
  /** Maximum collateral amount */
  MAX_AMOUNT: Number.MAX_SAFE_INTEGER,
} as const;

/** ============================================================================
 * NETWORK & POLLING BOUNDS
 * ============================================================================ */

export const POLLING_BOUNDS = {
  /** Initial retry delay in milliseconds (with exponential backoff) */
  INITIAL_RETRY_DELAY_MS: 1000,
  /** Maximum retry delay in milliseconds */
  MAX_RETRY_DELAY_MS: 30000,
  /** Exponential backoff multiplier */
  BACKOFF_MULTIPLIER: 1.5,
  /** Maximum number of retry attempts for fetch operations */
  MAX_RETRIES: 5,
  /** Poll interval for draft status checks in milliseconds */
  POLL_INTERVAL_MS: 5000,
  /** Maximum polling duration in milliseconds (5 minutes) */
  MAX_POLL_DURATION_MS: 300000,
  /** Stale data threshold - consider draft stale after this duration (60 seconds) */
  STALE_DATA_THRESHOLD_MS: 60000,
} as const;

/** ============================================================================
 * REQUEST CONCURRENCY & DEDUPLICATION
 * ============================================================================ */

export const CONCURRENCY_BOUNDS = {
  /** Maximum concurrent fetch requests for draft data */
  MAX_CONCURRENT_FETCHES: 3,
  /** Maximum concurrent wallet signature operations */
  MAX_CONCURRENT_SIGNATURES: 1,
  /** Request deduplication window in milliseconds - identical requests within
      this window are deduplicated */
  DEDUP_WINDOW_MS: 1000,
  /** Maximum pending operations queue size */
  MAX_PENDING_OPERATIONS: 10,
} as const;

/** ============================================================================
 * DRAFT & STATE PERSISTENCE
 * ============================================================================ */

export const DRAFT_BOUNDS = {
  /** Maximum draft ID length to prevent buffer overflows */
  MAX_ID_LENGTH: 128,
  /** Maximum resume token length */
  MAX_TOKEN_LENGTH: 256,
  /** Maximum draft age before it must be re-fetched (24 hours) */
  MAX_DRAFT_AGE_MS: 86400000,
  /** Session storage keys for draft state */
  STORAGE_KEY_PREFIX: "commitment_draft_",
  /** Maximum local storage size for draft (100 KB) */
  MAX_DRAFT_STORAGE_BYTES: 102400,
} as const;

/** ============================================================================
 * ERROR & FAILURE MODES
 * ============================================================================ */

export const ERROR_BOUNDS = {
  /** Maximum error message length to prevent log flooding */
  MAX_ERROR_MESSAGE_LENGTH: 500,
  /** Maximum stack trace depth in telemetry */
  MAX_STACK_DEPTH: 10,
  /** Error recovery timeout in milliseconds */
  RECOVERY_TIMEOUT_MS: 15000,
} as const;

/** ============================================================================
 * WALLET & AUTHORIZATION
 * ============================================================================ */

export const WALLET_BOUNDS = {
  /** Stellar account address format - 56 chars (1 version + 55 base32) */
  ADDRESS_LENGTH: 56,
  /** Address starts with 'G' for public key */
  ADDRESS_PREFIX: "G",
  /** Supported networks */
  VALID_NETWORKS: new Set(["PUBLIC", "TESTNET"]),
  /** Network mismatch recovery timeout */
  NETWORK_MISMATCH_RETRY_MS: 5000,
  /** Maximum wallet state checks before giving up */
  MAX_WALLET_CHECKS: 3,
} as const;

/** ============================================================================
 * STATE MACHINE
 * ============================================================================ */

export enum DraftState {
  /** Initial state - no draft action started */
  IDLE = "idle",
  /** Attempting to fetch/load existing draft */
  FETCHING = "fetching",
  /** Draft fetched and ready to resume */
  LOADED = "loaded",
  /** User resumed draft - in active editing/signing */
  ACTIVE = "active",
  /** Persisting draft changes to server */
  PERSISTING = "persisting",
  /** Submitting signed transaction */
  SUBMITTING = "submitting",
  /** Draft was cancelled */
  CANCELLED = "cancelled",
  /** Draft completed successfully */
  COMPLETED = "completed",
  /** Unrecoverable error occurred */
  ERROR = "error",
}

export enum FailureMode {
  /** No error */
  NONE = "none",
  /** Network connectivity failure */
  NETWORK = "network",
  /** Server returned error response */
  SERVER = "server",
  /** Wallet disconnected during operation */
  WALLET_DISCONNECTED = "wallet_disconnected",
  /** Network mismatch (wallet on different network than draft) */
  NETWORK_MISMATCH = "network_mismatch",
  /** Authorization failure (wrong wallet or draft owner) */
  UNAUTHORIZED = "unauthorized",
  /** Data validation failure */
  VALIDATION = "validation",
  /** Operation cancelled by user */
  CANCELLED = "cancelled",
  /** Timeout exceeded */
  TIMEOUT = "timeout",
  /** Malformed server response */
  MALFORMED_RESPONSE = "malformed_response",
  /** Unknown internal error */
  UNKNOWN = "unknown",
}

/** Valid state transitions */
export const VALID_STATE_TRANSITIONS: Record<DraftState, DraftState[]> = {
  [DraftState.IDLE]: [DraftState.FETCHING, DraftState.ACTIVE, DraftState.CANCELLED],
  [DraftState.FETCHING]: [DraftState.LOADED, DraftState.ERROR, DraftState.CANCELLED],
  [DraftState.LOADED]: [DraftState.ACTIVE, DraftState.CANCELLED, DraftState.ERROR],
  [DraftState.ACTIVE]: [DraftState.PERSISTING, DraftState.SUBMITTING, DraftState.CANCELLED, DraftState.ERROR],
  [DraftState.PERSISTING]: [DraftState.ACTIVE, DraftState.SUBMITTING, DraftState.ERROR, DraftState.CANCELLED],
  [DraftState.SUBMITTING]: [DraftState.COMPLETED, DraftState.ERROR, DraftState.CANCELLED],
  [DraftState.CANCELLED]: [],
  [DraftState.COMPLETED]: [],
  [DraftState.ERROR]: [DraftState.FETCHING, DraftState.IDLE, DraftState.CANCELLED],
};

/** ============================================================================
 * INVARIANT VALIDATORS
 * ============================================================================ */

/**
 * Validates that amount is within acceptable bounds
 * @throws Error if amount is invalid
 */
export function validateAmountInvariant(amount: unknown): number {
  const parsed = typeof amount === "string" ? parseFloat(amount) : Number(amount);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid amount: must be a finite number, got ${String(amount)}`);
  }

  if (parsed < COMMITMENT_AMOUNT_BOUNDS.MIN_AMOUNT) {
    throw new Error(
      `Amount ${parsed} below minimum of ${COMMITMENT_AMOUNT_BOUNDS.MIN_AMOUNT}`,
    );
  }

  if (parsed > COMMITMENT_AMOUNT_BOUNDS.MAX_AMOUNT) {
    throw new Error(
      `Amount ${parsed} exceeds maximum of ${COMMITMENT_AMOUNT_BOUNDS.MAX_AMOUNT}`,
    );
  }

  return parsed;
}

/**
 * Validates that interest rate is within acceptable bounds
 * @throws Error if rate is invalid
 */
export function validateInterestRateInvariant(rate: unknown): number {
  const parsed = typeof rate === "string" ? parseFloat(rate) : Number(rate);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid interest rate: must be a finite number, got ${String(rate)}`);
  }

  if (parsed < INTEREST_RATE_BOUNDS.MIN_RATE) {
    throw new Error(
      `Interest rate ${parsed}% below minimum of ${INTEREST_RATE_BOUNDS.MIN_RATE}%`,
    );
  }

  if (parsed > INTEREST_RATE_BOUNDS.MAX_RATE) {
    throw new Error(
      `Interest rate ${parsed}% exceeds maximum of ${INTEREST_RATE_BOUNDS.MAX_RATE}%`,
    );
  }

  return parsed;
}

/**
 * Validates that duration is within acceptable bounds
 * @throws Error if duration is invalid
 */
export function validateDurationInvariant(days: unknown): number {
  const parsed = typeof days === "string" ? parseInt(days, 10) : Number(days);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid duration: must be an integer, got ${String(days)}`);
  }

  if (parsed < DURATION_BOUNDS.MIN_DAYS) {
    throw new Error(
      `Duration ${parsed} days below minimum of ${DURATION_BOUNDS.MIN_DAYS} day`,
    );
  }

  if (parsed > DURATION_BOUNDS.MAX_DAYS) {
    throw new Error(
      `Duration ${parsed} days exceeds maximum of ${DURATION_BOUNDS.MAX_DAYS} days`,
    );
  }

  return parsed;
}

/**
 * Validates that draft ID is within acceptable bounds
 * @throws Error if draft ID is invalid
 */
export function validateDraftIdInvariant(draftId: unknown): string {
  const str = String(draftId ?? "").trim();

  if (!str.length) {
    throw new Error("Draft ID cannot be empty");
  }

  if (str.length > DRAFT_BOUNDS.MAX_ID_LENGTH) {
    throw new Error(
      `Draft ID exceeds maximum length of ${DRAFT_BOUNDS.MAX_ID_LENGTH} characters`,
    );
  }

  // Only alphanumeric, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(str)) {
    throw new Error("Draft ID must contain only alphanumeric characters, hyphens, and underscores");
  }

  return str;
}

/**
 * Validates that state transition is allowed
 * @throws Error if transition is not allowed
 */
export function validateStateTransition(
  from: DraftState,
  to: DraftState,
): void {
  const allowed = VALID_STATE_TRANSITIONS[from];

  if (!allowed?.includes(to)) {
    throw new Error(`Invalid state transition: ${from} -> ${to}`);
  }
}

/**
 * Validates that a polling duration is within bounds
 * @throws Error if duration exceeds limits
 */
export function validatePollingDuration(elapsedMs: number): void {
  if (elapsedMs > POLLING_BOUNDS.MAX_POLL_DURATION_MS) {
    throw new Error(
      `Polling exceeded maximum duration of ${POLLING_BOUNDS.MAX_POLL_DURATION_MS}ms`,
    );
  }
}

/**
 * Calculates next retry delay with exponential backoff
 */
export function calculateNextRetryDelay(attemptNumber: number): number {
  const delay = Math.min(
    POLLING_BOUNDS.INITIAL_RETRY_DELAY_MS *
      Math.pow(POLLING_BOUNDS.BACKOFF_MULTIPLIER, attemptNumber),
    POLLING_BOUNDS.MAX_RETRY_DELAY_MS,
  );

  // Add jitter (±10%) to prevent thundering herd
  const jitter = delay * (0.9 + Math.random() * 0.2);
  return Math.ceil(jitter);
}

/**
 * Determines if data is stale based on last fetch time
 */
export function isDataStale(lastFetchTimeMs: number | null): boolean {
  if (lastFetchTimeMs === null) {
    return true;
  }

  return Date.now() - lastFetchTimeMs > POLLING_BOUNDS.STALE_DATA_THRESHOLD_MS;
}

/**
 * Checks if wallet address matches expected format
 */
export function validateWalletAddressInvariant(address: unknown): string {
  const str = String(address ?? "").trim();

  if (!str.startsWith(WALLET_BOUNDS.ADDRESS_PREFIX)) {
    throw new Error(
      `Wallet address must start with '${WALLET_BOUNDS.ADDRESS_PREFIX}'`,
    );
  }

  if (str.length !== WALLET_BOUNDS.ADDRESS_LENGTH) {
    throw new Error(
      `Wallet address must be exactly ${WALLET_BOUNDS.ADDRESS_LENGTH} characters`,
    );
  }

  // Stellar Base32 alphabet: A-Z 2-7 (no 0, 1, 8, 9)
  if (!/^G[A-Z2-7]{55}$/.test(str)) {
    throw new Error("Wallet address contains invalid characters");
  }

  return str;
}

/**
 * All invariants for a draft operation (comprehensive check)
 */
export interface DraftOperationInvariants {
  amount?: number;
  interestRate?: number;
  duration?: number;
  collateralAmount?: number;
  draftId?: string;
  walletAddress?: string;
  network?: string;
}

/**
 * Validate all invariants for a draft operation
 */
export function validateDraftOperationInvariants(
  invariants: DraftOperationInvariants,
): void {
  if (invariants.amount !== undefined) {
    validateAmountInvariant(invariants.amount);
  }

  if (invariants.interestRate !== undefined) {
    validateInterestRateInvariant(invariants.interestRate);
  }

  if (invariants.duration !== undefined) {
    validateDurationInvariant(invariants.duration);
  }

  if (invariants.collateralAmount !== undefined) {
    validateAmountInvariant(invariants.collateralAmount);
  }

  if (invariants.draftId !== undefined) {
    validateDraftIdInvariant(invariants.draftId);
  }

  if (invariants.walletAddress !== undefined) {
    validateWalletAddressInvariant(invariants.walletAddress);
  }

  if (invariants.network !== undefined) {
    if (!WALLET_BOUNDS.VALID_NETWORKS.has(invariants.network)) {
      throw new Error(`Unsupported network: ${invariants.network}`);
    }
  }
}
