/**
 * lib/wallet/sessionRehydration.ts
 *
 * Shared session-rehydration logic used by both `WalletContext` and
 * `useWalletConnection`. Previously each hook contained an identical copy of
 * this fetch-validate-clear flow; keeping a single implementation prevents
 * the two entry points from drifting apart again (which was the root cause of
 * the public-key validation divergence noted in connectHandshake.ts).
 *
 * Bounded performance guarantees:
 *  - The rehydration fetch is raced against REHYDRATION_TIMEOUT_MS via an
 *    AbortController. A slow or unresponsive server never leaves the app
 *    stuck in `"initializing"` indefinitely.
 *  - The function returns a typed `RehydrationOutcome` instead of throwing,
 *    so callers never need a bare try/catch and can pattern-match on `ok`.
 *  - No wallet addresses or session tokens are forwarded to telemetry; only
 *    the sanitised failure reason and latency are emitted.
 */

import {
  validateClientSessionResponse,
  assertWalletMatchesSession,
  type SessionBoundaryFailure,
} from "@/lib/auth/session-boundary";
import type { StellarNetwork } from "@/lib/wallet/connectHandshake";
import {
  WALLET_BOUNDS,
  type RehydrationOutcome,
  type WalletFailureReason,
  type WalletTelemetryEvent,
} from "@/types/wallet";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emit(
  onTelemetry: ((e: WalletTelemetryEvent) => void) | undefined,
  event: Omit<WalletTelemetryEvent, "timestamp">,
): void {
  onTelemetry?.({ ...event, timestamp: Date.now() });
}

/** Map a SessionBoundaryFailure code to a WalletFailureReason. */
function mapBoundaryReason(reason: SessionBoundaryFailure): WalletFailureReason {
  switch (reason) {
    case "expired-session":
      return "session_expired";
    case "wrong-network":
      return "session_wrong_network";
    case "wallet-mismatch":
      return "address_mismatch";
    case "missing-session":
    case "inactive-session":
    case "missing-user":
    case "missing-user-id":
    case "invalid-wallet":
    case "invalid-network":
    case "invalid-issued-at":
    case "invalid-expires-at":
      return "session_invalid";
    default:
      return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RehydrateWalletSessionOptions {
  /**
   * The Stellar network this client is configured for. The server session
   * must report the same network or the rehydration is rejected.
   */
  network: StellarNetwork;
  /**
   * The address found in sessionStorage (treated as untrusted candidate).
   * If present, the server session's wallet must match it exactly.
   */
  storedAddress: string | null;
  /** Receive structured diagnostics for the rehydration path. */
  onTelemetry?: (event: WalletTelemetryEvent) => void;
  /**
   * Override the rehydration timeout (ms). Defaults to
   * WALLET_BOUNDS.REHYDRATION_TIMEOUT_MS. Primarily for tests.
   */
  timeoutMs?: number;
}

/**
 * Fetch and validate the server session to rehydrate client wallet state.
 *
 * Always resolves (never throws) — failure cases return `{ ok: false, reason, message }`.
 * Callers should call `clearWalletState()` whenever `ok` is false.
 */
export async function rehydrateWalletSession(
  options: RehydrateWalletSessionOptions,
): Promise<RehydrationOutcome> {
  const {
    network,
    storedAddress,
    onTelemetry,
    timeoutMs = WALLET_BOUNDS.REHYDRATION_TIMEOUT_MS,
  } = options;

  const startTime = Date.now();
  emit(onTelemetry, { type: "rehydration_started" });

  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("/api/auth/session", {
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
    });
    clearTimeout(timerId);

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      emit(onTelemetry, {
        type: "rehydration_failed",
        latencyMs,
        failureReason: "network_error",
        message: `Session fetch returned ${response.status}`,
      });
      return { ok: false, reason: "network_error", message: "No active session on server" };
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      emit(onTelemetry, {
        type: "rehydration_failed",
        latencyMs,
        failureReason: "session_invalid",
        message: "Session response was not valid JSON",
      });
      return { ok: false, reason: "session_invalid", message: "Malformed session response" };
    }

    // Strict boundary validation: network, active flag, wallet address format,
    // expiry, and clock-skew checks all happen inside validateClientSessionResponse.
    let session: ReturnType<typeof validateClientSessionResponse>;
    try {
      session = validateClientSessionResponse(data, network);
    } catch (err) {
      const boundaryError = err as { reason?: SessionBoundaryFailure };
      const reason = mapBoundaryReason(boundaryError.reason ?? ("unknown" as SessionBoundaryFailure));
      emit(onTelemetry, {
        type: "rehydration_failed",
        latencyMs,
        failureReason: reason,
        message: `Session boundary validation failed: ${boundaryError.reason ?? "unknown"}`,
      });
      return { ok: false, reason, message: `Session validation failed: ${boundaryError.reason ?? "unknown"}` };
    }

    // Guard against tampered / stale sessionStorage.
    try {
      assertWalletMatchesSession(storedAddress, session.walletAddress);
    } catch {
      emit(onTelemetry, {
        type: "rehydration_failed",
        latencyMs,
        failureReason: "address_mismatch",
        message: "Stored address does not match server session",
      });
      return {
        ok: false,
        reason: "address_mismatch",
        message: "Stored wallet address does not match the server session",
      };
    }

    emit(onTelemetry, {
      type: "rehydration_succeeded",
      latencyMs,
      metadata: { network: session.network },
    });

    return {
      ok: true,
      walletAddress: session.walletAddress,
      network: session.network,
      expiresAt: session.expiresAt,
    };
  } catch (err) {
    clearTimeout(timerId);
    const latencyMs = Date.now() - startTime;
    const e = err as Error;

    if (e.name === "AbortError") {
      emit(onTelemetry, {
        type: "rehydration_timeout",
        latencyMs,
        failureReason: "rehydration_timeout",
        message: "Session rehydration timed out",
      });
      return { ok: false, reason: "rehydration_timeout", message: "Session rehydration timed out" };
    }

    emit(onTelemetry, {
      type: "rehydration_failed",
      latencyMs,
      failureReason: "network_error",
      message: "Network error during session rehydration",
    });
    return { ok: false, reason: "network_error", message: "Network error during session rehydration" };
  }
}
