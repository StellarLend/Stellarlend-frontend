/**
 * Client-side telemetry for wallet provider and session recovery.
 * Provides structured diagnostics for latency, failure, and recovery paths
 * without leaking wallet addresses, secrets, or session tokens.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WalletTelemetryEventType =
  | "rehydration_started"
  | "rehydration_succeeded"
  | "rehydration_failed"
  | "rehydration_aborted"
  | "connect_started"
  | "connect_succeeded"
  | "connect_failed"
  | "connect_rejected_concurrent"
  | "disconnect_started"
  | "disconnect_succeeded"
  | "disconnect_failed"
  | "session_fetch_timeout"
  | "session_fetch_error"
  | "account_switch"
  | "network_mismatch";

export interface WalletTelemetryEvent {
  type: WalletTelemetryEventType;
  timestamp: number;
  /** Opaque correlation ID — never a wallet address or session token. */
  correlationId?: string;
  latencyMs?: number;
  errorType?: string;
  /** Sanitized human-readable message, no sensitive values. */
  errorMessage?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface WalletDiagnostics {
  health: "healthy" | "degraded" | "critical";
  metrics: {
    successRate: number;
    averageRehydrationLatencyMs: number;
    averageConnectLatencyMs: number;
    totalEvents: number;
    failureCount: number;
  };
  issues: Array<{ severity: "warning" | "error" | "critical"; message: string }>;
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const WALLET_BOUNDS = {
  /** Max ms to wait for a session rehydration fetch before aborting. */
  SESSION_FETCH_TIMEOUT_MS: 8_000,
  /** Max ms to wait for the full connect handshake before aborting. */
  CONNECT_TIMEOUT_MS: 30_000,
  /** Max number of accounts accepted from the wallet provider. */
  MAX_ACCOUNTS: 20,
  /** Telemetry ring-buffer cap to prevent unbounded memory growth. */
  TELEMETRY_MAX_EVENTS: 200,
} as const;

// ---------------------------------------------------------------------------
// Sanitization helpers
// ---------------------------------------------------------------------------

const STELLAR_PUBKEY_RE = /\bG[A-Z2-7]{55}\b/g;
const STELLAR_SECRET_RE = /\bS[A-Z2-7]{55}\b/g;
const JWT_RE = /\b(?:Bearer\s+[A-Za-z0-9\-_.=]+|eyJ[A-Za-z0-9\-_]+(?:\.[A-Za-z0-9\-_]+){1,2})\b/g;
const HEX64_RE = /\b[a-f0-9]{64}\b/gi;

function sanitizeString(value: string): string {
  return value
    .replace(STELLAR_SECRET_RE, "[REDACTED_SECRET]")
    .replace(STELLAR_PUBKEY_RE, "[REDACTED_ADDRESS]")
    .replace(JWT_RE, "[REDACTED_TOKEN]")
    .replace(HEX64_RE, "[REDACTED_HASH]");
}

function sanitizeEvent(event: WalletTelemetryEvent): WalletTelemetryEvent {
  const out: WalletTelemetryEvent = { ...event };
  if (out.errorMessage) out.errorMessage = sanitizeString(out.errorMessage);
  if (out.metadata) {
    const clean: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(out.metadata)) {
      clean[k] = typeof v === "string" ? sanitizeString(v) : v;
    }
    out.metadata = clean;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class WalletTelemetryService {
  private readonly buffer: WalletTelemetryEvent[] = [];
  private readonly max: number;

  constructor(maxEvents = WALLET_BOUNDS.TELEMETRY_MAX_EVENTS) {
    this.max = maxEvents;
  }

  record(event: WalletTelemetryEvent): void {
    const sanitized = sanitizeEvent(event);

    // Ring buffer — drop oldest when full.
    if (this.buffer.length >= this.max) {
      this.buffer.shift();
    }
    this.buffer.push(sanitized);

    if (process.env.NODE_ENV === "development") {
      this.logToConsole(sanitized);
    }
  }

  getEvents(): ReadonlyArray<WalletTelemetryEvent> {
    return this.buffer.slice();
  }

  clear(): void {
    this.buffer.length = 0;
  }

  generateDiagnostics(): WalletDiagnostics {
    const events = this.buffer;
    const issues: WalletDiagnostics["issues"] = [];
    const recommendations: string[] = [];

    const rehydrationLatencies: number[] = [];
    const connectLatencies: number[] = [];
    let failureCount = 0;
    let successCount = 0;

    for (const e of events) {
      if (e.type === "rehydration_succeeded" && e.latencyMs != null) {
        rehydrationLatencies.push(e.latencyMs);
        successCount++;
      }
      if (e.type === "connect_succeeded" && e.latencyMs != null) {
        connectLatencies.push(e.latencyMs);
        successCount++;
      }
      if (
        e.type === "rehydration_failed" ||
        e.type === "connect_failed" ||
        e.type === "disconnect_failed" ||
        e.type === "session_fetch_error" ||
        e.type === "session_fetch_timeout"
      ) {
        failureCount++;
      }
    }

    const total = successCount + failureCount;
    const successRate = total > 0 ? (successCount / total) * 100 : 100;

    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const avgRehydration = avg(rehydrationLatencies);
    const avgConnect = avg(connectLatencies);

    // Determine health
    let health: WalletDiagnostics["health"] = "healthy";

    if (successRate < 50) {
      health = "critical";
      issues.push({ severity: "critical", message: `Success rate ${successRate.toFixed(0)}% below 50%` });
      recommendations.push("Investigate backend session endpoint and network conditions.");
    } else if (successRate < 80) {
      health = "degraded";
      issues.push({ severity: "warning", message: `Success rate ${successRate.toFixed(0)}% below 80%` });
      recommendations.push("Review recent failures; consider tightening session timeout.");
    }

    if (avgRehydration > WALLET_BOUNDS.SESSION_FETCH_TIMEOUT_MS * 0.8) {
      if (health === "healthy") health = "degraded";
      issues.push({
        severity: "warning",
        message: `Average rehydration latency ${Math.round(avgRehydration)}ms approaching timeout`,
      });
      recommendations.push("Increase SESSION_FETCH_TIMEOUT_MS or optimize /api/auth/session.");
    }

    const timeoutCount = events.filter((e) => e.type === "session_fetch_timeout").length;
    if (timeoutCount > 0) {
      if (health === "healthy") health = "degraded";
      issues.push({ severity: "error", message: `${timeoutCount} session fetch timeout(s) recorded` });
      recommendations.push("Check /api/auth/session p99 response time.");
    }

    const concurrentRejects = events.filter((e) => e.type === "connect_rejected_concurrent").length;
    if (concurrentRejects > 0) {
      issues.push({
        severity: "warning",
        message: `${concurrentRejects} concurrent connect attempt(s) rejected`,
      });
    }

    return {
      health,
      metrics: {
        successRate,
        averageRehydrationLatencyMs: avgRehydration,
        averageConnectLatencyMs: avgConnect,
        totalEvents: events.length,
        failureCount,
      },
      issues,
      recommendations,
    };
  }

  private logToConsole(event: WalletTelemetryEvent): void {
    const ts = new Date(event.timestamp).toISOString();
    const level =
      event.type.includes("failed") || event.type.includes("error") || event.type.includes("timeout")
        ? "warn"
        : "log";
    // eslint-disable-next-line no-console
    console[level](`[wallet:telemetry] ${ts} ${event.type}`, {
      ...(event.latencyMs != null && { latencyMs: event.latencyMs }),
      ...(event.errorType && { errorType: event.errorType }),
      ...(event.errorMessage && { errorMessage: event.errorMessage }),
      ...(event.metadata && { metadata: event.metadata }),
    });
  }
}

// ---------------------------------------------------------------------------
// Singleton + hook
// ---------------------------------------------------------------------------

let _instance: WalletTelemetryService | undefined;

export function getWalletTelemetryService(): WalletTelemetryService {
  if (!_instance) _instance = new WalletTelemetryService();
  return _instance;
}

/** Reset the singleton — used in tests only. */
export function _resetWalletTelemetryService(): void {
  _instance = undefined;
}
