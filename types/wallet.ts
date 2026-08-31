/**
 * Wallet provider and session recovery types.
 *
 * Defines the explicit state, data, authorization, and failure invariants for
 * the wallet feature. Mirrors the pattern from `types/marketplace.ts` and
 * `types/commitment.ts`: states are explicit, transitions are declared,
 * bounds are centralised, and telemetry is typed.
 *
 * All bound fields are `as const` so callers get literal types and tree-shaking
 * removes unused ones at build time.
 */

// ---------------------------------------------------------------------------
// Status / state types
// ---------------------------------------------------------------------------

/**
 * Authoritative client-side wallet lifecycle. The `initializing` state fills
 * the gap between mount and the first server-session response so consumers
 * can distinguish "not yet known" from "definitely disconnected".
 */
export type WalletStatus =
  | "initializing"
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

/**
 * Reasons a wallet session rehydration or connection can fail. Typed so
 * consumers can act on specific failure modes without string matching.
 */
export type WalletFailureReason =
  | "no_wallet_extension"
  | "no_public_key"
  | "invalid_public_key"
  | "challenge_failed"
  | "sign_failed"
  | "verify_failed"
  | "address_mismatch"
  | "connect_timeout"
  | "rehydration_timeout"
  | "session_expired"
  | "session_wrong_network"
  | "session_invalid"
  | "network_error"
  | "unknown";

// ---------------------------------------------------------------------------
// Explicit bounds — centralised so hooks, context, and tests share one truth
// ---------------------------------------------------------------------------

export const WALLET_BOUNDS = {
  /**
   * Maximum time (ms) allowed for the full connect handshake
   * (getPublicKey → challenge → signTransaction → verify).
   * A stuck Freighter signing dialog will be aborted after this.
   */
  CONNECT_TIMEOUT_MS: 30_000,

  /**
   * Maximum time (ms) allowed for the server-session rehydration fetch
   * on mount. Prevents the app from hanging in `initializing` indefinitely
   * on a slow or unresponsive network.
   */
  REHYDRATION_TIMEOUT_MS: 10_000,

  /**
   * Maximum time (ms) allowed for a single network request inside the
   * connect flow (challenge or verify fetch). Separate from the overall
   * connect timeout so a single slow leg does not consume the whole budget.
   */
  REQUEST_TIMEOUT_MS: 15_000,

  /**
   * Wallet balance data is considered stale after this many ms. After the
   * TTL expires, the next visibility-change or focus event triggers a
   * re-fetch. Prevents showing hours-old balances without a full page reload.
   */
  BALANCE_STALE_AFTER_MS: 60_000,

  /**
   * How many ms to debounce rapid reconnect attempts (e.g. user clicks
   * "Connect" multiple times quickly, or an account-change event fires in
   * a burst). A call within the debounce window is silently dropped.
   */
  RECONNECT_DEBOUNCE_MS: 500,

  /**
   * Maximum number of simultaneous in-flight wallet auth requests.
   * Prevents a rapid-click storm from opening duplicate handshakes.
   */
  MAX_CONCURRENT_CONNECT_REQUESTS: 1,

  /**
   * Maximum number of accounts the multi-account enumeration is allowed
   * to return. Any list longer than this is truncated to prevent memory
   * and render cost from adversarially large account lists.
   */
  MAX_ACCOUNTS: 20,

  /**
   * Stellar public-key length (56 chars, G-prefixed) used for inline
   * validation across the wallet feature without importing the full
   * validation library.
   */
  STELLAR_ADDRESS_LENGTH: 56,
} as const;

// ---------------------------------------------------------------------------
// Telemetry — structured, no secrets
// ---------------------------------------------------------------------------

export type WalletTelemetryEventType =
  | "connect_started"
  | "connect_succeeded"
  | "connect_failed"
  | "connect_timeout"
  | "disconnect_started"
  | "disconnect_succeeded"
  | "rehydration_started"
  | "rehydration_succeeded"
  | "rehydration_failed"
  | "rehydration_timeout"
  | "duplicate_connect_blocked"
  | "account_switch_attempted"
  | "account_switch_blocked"
  | "balance_fetch_started"
  | "balance_fetch_succeeded"
  | "balance_fetch_failed"
  | "balance_stale"
  | "session_expired_detected"
  | "latency";

/**
 * Structured telemetry event. All fields that might carry wallet addresses
 * or transaction data must be sanitised before being placed in `metadata`
 * (see `sanitiseWalletMessage` in `lib/wallet/telemetry.ts`).
 */
export interface WalletTelemetryEvent {
  type: WalletTelemetryEventType;
  timestamp: number;
  /** Latency of the completed operation in ms (present for `latency` events). */
  latencyMs?: number;
  /** Sanitised failure code — no secrets. */
  failureReason?: WalletFailureReason;
  /** Sanitised human-readable description — no secrets, no addresses. */
  message?: string;
  /** Safe structured metadata. Values must be string | number | boolean. */
  metadata?: Record<string, string | number | boolean>;
}

// ---------------------------------------------------------------------------
// Session rehydration result (returned by lib/wallet/sessionRehydration.ts)
// ---------------------------------------------------------------------------

export type RehydrationOutcome =
  | { ok: true; walletAddress: string; network: string; expiresAt: Date | null }
  | { ok: false; reason: WalletFailureReason; message: string };
