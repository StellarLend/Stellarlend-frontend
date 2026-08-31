/**
 * Protected route authorization telemetry
 *
 * Provides structured diagnostics for authorization latency, failure reasons,
 * and recovery actions. All fields are sanitized: wallet addresses, session
 * tokens, and other secrets are never recorded.
 */

export type AuthorizationOutcome = "granted" | "denied";

export type AuthorizationDenialReason =
  | "missing-session"
  | "missing-user"
  | "missing-user-id"
  | "invalid-wallet"
  | "expired-session"
  | "invalid-issued-at"
  | "invalid-expires-at"
  | "session-error";

/** Explicit bounds for the protected-route feature */
export const PROTECTED_ROUTE_BOUNDS = {
  /** Maximum allowed length for the returnTo query parameter to prevent abuse */
  MAX_RETURN_TO_LENGTH: 512,

  /** Hard ceiling (ms) for getSession + validateServerProtectedSession.
   *  If validation takes longer, the route is considered degraded. */
  SESSION_VALIDATION_TIMEOUT_MS: 5_000,

  /** Maximum number of concurrent session validations across the process.
   *  Limits memory pressure when many requests hit protected routes
   *  simultaneously (e.g. bot traffic). */
  MAX_CONCURRENT_VALIDATIONS: 50,

  /** Allowed prefixes for returnTo to prevent open-redirect abuse.
   *  Only paths starting with one of these prefixes (or matching the
   *  pattern "/") will be honoured. Anything else falls back to the
   *  default returnTo value. */
  ALLOWED_RETURN_TO_PREFIXES: ["/", "/dashboard", "/settings"] as readonly string[],
} as const;

/** Sanitized telemetry record — safe to log and ship to monitoring */
export interface AuthorizationTelemetryRecord {
  outcome: AuthorizationOutcome;
  /** Milliseconds elapsed for the full getSession + validation round-trip */
  latencyMs: number;
  /** Route (returnTo) that was being protected */
  targetRoute: string;
  /** Timestamp (unix ms) of the authorization decision */
  timestamp: number;
  /** Only present when outcome === "denied" */
  denialReason?: AuthorizationDenialReason;
  /** Whether the session was expired vs structurally invalid */
  sessionExpired?: boolean;
  /** Whether the returnTo was sanitized (length or prefix violation) */
  returnToSanitized?: boolean;
}

/** In-memory ring buffer for the most recent authorization events.
 *  Bounded to avoid unbounded growth; older events are evicted. */
const TELEMETRY_RING_SIZE = 200;

const telemetryBuffer: AuthorizationTelemetryRecord[] = [];

/**
 * Redact any Stellar account id (56-char base-32 string) from a value.
 */
function redactAddresses(value: string): string {
  // Match Stellar public keys (start with G or S, 57 chars)
  return value.replace(/\b[GS][A-Z0-9]{55}\b/g, "[REDACTED]");
}

/**
 * Sanitize the returnTo value against configured bounds.
 * Returns the original value if it passes, or the fallback if it fails.
 */
export function sanitizeReturnTo(
  returnTo: string,
  fallback: string,
  bounds: { MAX_RETURN_TO_LENGTH: number; ALLOWED_RETURN_TO_PREFIXES: readonly string[] } = PROTECTED_ROUTE_BOUNDS,
): { value: string; sanitized: boolean } {
  if (returnTo.length > bounds.MAX_RETURN_TO_LENGTH) {
    return { value: fallback, sanitized: true };
  }

  const isAllowedPrefix = bounds.ALLOWED_RETURN_TO_PREFIXES.some(
    (prefix) => returnTo === prefix || returnTo.startsWith(prefix + "/"),
  );

  if (!isAllowedPrefix) {
    return { value: fallback, sanitized: true };
  }

  // Block protocol-relative and absolute URLs
  if (returnTo.startsWith("//") || returnTo.startsWith("http://") || returnTo.startsWith("https://")) {
    return { value: fallback, sanitized: true };
  }

  return { value: returnTo, sanitized: false };
}

/**
 * Record an authorization telemetry event.
 * The record is sanitized (no wallet addresses) and stored in a bounded
 * ring buffer.  In production this would also be flushed to an external
 * monitoring endpoint.
 */
export function recordAuthorizationEvent(
  event: Omit<AuthorizationTelemetryRecord, "timestamp">,
): AuthorizationTelemetryRecord {
  const record: AuthorizationTelemetryRecord = {
    ...event,
    targetRoute: redactAddresses(event.targetRoute),
    timestamp: Date.now(),
  };

  telemetryBuffer.push(record);

  // Evict oldest when ring is full
  if (telemetryBuffer.length > TELEMETRY_RING_SIZE) {
    telemetryBuffer.splice(0, telemetryBuffer.length - TELEMETRY_RING_SIZE);
  }

  // Structured diagnostic log (never leaks secrets)
  const logPayload = {
    outcome: record.outcome,
    latencyMs: record.latencyMs,
    denialReason: record.denialReason,
    sessionExpired: record.sessionExpired,
    returnToSanitized: record.returnToSanitized,
  };

  if (record.outcome === "denied") {
    console.warn("[ProtectedRoute] Authorization denied", logPayload);
  } else {
    console.debug("[ProtectedRoute] Authorization granted", logPayload);
  }

  return record;
}

/**
 * Retrieve the most recent telemetry records (for tests and diagnostics).
 * Returns a shallow copy — callers cannot mutate internal state.
 */
export function getRecentAuthorizationEvents(
  count: number = 20,
): readonly AuthorizationTelemetryRecord[] {
  return telemetryBuffer.slice(-count);
}

/**
 * Clear all buffered telemetry.  Call in test teardown or process shutdown.
 */
export function clearAuthorizationTelemetry(): void {
  telemetryBuffer.length = 0;
}

/**
 * Compute a diagnostic summary from buffered telemetry.
 */
export interface AuthorizationDiagnosticSummary {
  totalAttempts: number;
  granted: number;
  denied: number;
  successRate: number;
  /** Mean latency in ms across all recorded events */
  averageLatencyMs: number;
  /** Denial reasons broken down by count */
  denialBreakdown: Partial<Record<AuthorizationDenialReason, number>>;
  /** Whether any returnTo sanitization has occurred */
  hadSanitizations: boolean;
}

export function getAuthorizationDiagnostics(): AuthorizationDiagnosticSummary {
  const events = telemetryBuffer;
  const totalAttempts = events.length;
  const granted = events.filter((e) => e.outcome === "granted").length;
  const denied = totalAttempts - granted;
  const successRate = totalAttempts > 0 ? granted / totalAttempts : 1;
  const averageLatencyMs =
    totalAttempts > 0
      ? events.reduce((sum, e) => sum + e.latencyMs, 0) / totalAttempts
      : 0;

  const denialBreakdown: Partial<Record<AuthorizationDenialReason, number>> = {};
  for (const event of events) {
    if (event.outcome === "denied" && event.denialReason) {
      denialBreakdown[event.denialReason] =
        (denialBreakdown[event.denialReason] || 0) + 1;
    }
  }

  const hadSanitizations = events.some((e) => e.returnToSanitized);

  return {
    totalAttempts,
    granted,
    denied,
    successRate,
    averageLatencyMs,
    denialBreakdown,
    hadSanitizations,
  };
}
