/**
 * lib/wallet/connectHandshake.ts
 *
 * Freighter → SEP-10 challenge → sign → verify handshake shared by every
 * wallet-connect entry point.
 *
 * Bounded performance guarantees added in this revision:
 *  - The entire handshake is raced against CONNECT_TIMEOUT_MS. If Freighter
 *    hangs (e.g. a stuck signing dialog) the promise rejects with a typed
 *    "connect_timeout" error rather than stalling indefinitely.
 *  - Each individual network request (challenge, verify) is raced against
 *    REQUEST_TIMEOUT_MS via its own AbortController.
 *  - All thrown errors include a `reason: WalletFailureReason` property so
 *    callers can act on the specific failure mode without string matching.
 *  - Structured telemetry is emitted via the optional `onTelemetry` callback
 *    on every significant path. No wallet addresses, XDR, or signed
 *    transactions are forwarded.
 */

import { isAccountId } from "@/lib/validation/stellar";
import {
  WALLET_BOUNDS,
  type WalletFailureReason,
  type WalletTelemetryEvent,
} from "@/types/wallet";

export type StellarNetwork = "PUBLIC" | "TESTNET";

declare global {
  interface Window {
    stellar?: {
      getPublicKey: () => Promise<string>;
      signTransaction: (xdr: string, opts?: { network: string }) => Promise<string>;
      // Optional: not all wallet providers expose multiple accounts.
      getAccounts?: () => Promise<string[]>;
    };
  }
}

// ---------------------------------------------------------------------------
// Typed error class so callers can distinguish failure reasons
// ---------------------------------------------------------------------------

export class WalletConnectError extends Error {
  readonly reason: WalletFailureReason;

  constructor(reason: WalletFailureReason, message: string) {
    super(message);
    this.name = "WalletConnectError";
    this.reason = reason;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isValidStellarAddress(pubKey: string): boolean {
  return isAccountId(pubKey);
}

/** Strip wallet addresses and XDR from messages before forwarding to telemetry. */
function sanitiseMessage(msg: string): string {
  return msg
    .replace(/\bG[A-Z2-7]{55}\b/g, "[address]")
    .replace(/\b[A-Za-z0-9+/]{80,}\b/g, "[xdr]");
}

function emit(
  onTelemetry: ((e: WalletTelemetryEvent) => void) | undefined,
  event: Omit<WalletTelemetryEvent, "timestamp">,
): void {
  onTelemetry?.({ ...event, timestamp: Date.now() });
}

/**
 * Race a promise against a per-request AbortController timeout.
 * Returns the response or throws WalletConnectError("network_error" | "connect_timeout").
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return response;
  } catch (err) {
    const e = err as Error;
    if (e.name === "AbortError") {
      throw new WalletConnectError("connect_timeout", "Network request timed out");
    }
    throw new WalletConnectError("network_error", sanitiseMessage(e.message));
  } finally {
    clearTimeout(timerId);
  }
}

// ---------------------------------------------------------------------------
// Public connect API
// ---------------------------------------------------------------------------

export interface ConnectWalletOptions {
  /** Receive structured diagnostics for every significant connect path. */
  onTelemetry?: (event: WalletTelemetryEvent) => void;
  /**
   * Override the overall handshake timeout (ms). Defaults to
   * WALLET_BOUNDS.CONNECT_TIMEOUT_MS. Primarily for tests.
   */
  timeoutMs?: number;
}

/**
 * Freighter → SEP-10 challenge → sign → verify handshake.
 *
 * Throws `WalletConnectError` on every failure path so callers receive a
 * typed `reason` code alongside the user-surfaceable `message`.
 *
 * The entire flow is bounded by `timeoutMs` (default 30 s). Individual
 * network legs are bounded by WALLET_BOUNDS.REQUEST_TIMEOUT_MS (15 s).
 */
export async function connectWallet(
  network: StellarNetwork,
  { onTelemetry, timeoutMs = WALLET_BOUNDS.CONNECT_TIMEOUT_MS }: ConnectWalletOptions = {},
): Promise<string> {
  const startTime = Date.now();
  emit(onTelemetry, { type: "connect_started" });

  // Race the entire handshake against the overall timeout.
  let timedOut = false;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      timedOut = true;
      reject(new WalletConnectError("connect_timeout", "Wallet connection timed out"));
    }, timeoutMs);
  });

  const handshake = async (): Promise<string> => {
    // 1. Detect Freighter extension.
    const stellar = window.stellar;
    if (!stellar) {
      throw new WalletConnectError(
        "no_wallet_extension",
        "Stellar wallet provider (Freighter) not detected",
      );
    }

    // 2. Get public key.
    let pubKey: string;
    try {
      pubKey = await stellar.getPublicKey();
    } catch (err) {
      const e = err as Error;
      throw new WalletConnectError("no_public_key", sanitiseMessage(e.message));
    }

    if (!pubKey) {
      throw new WalletConnectError("no_public_key", "No public key returned from wallet");
    }
    if (!isValidStellarAddress(pubKey)) {
      throw new WalletConnectError("invalid_public_key", "Invalid Stellar public key");
    }

    // 3. Fetch SEP-10 challenge.
    const challengeResponse = await fetchWithTimeout(
      "/api/auth/challenge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: pubKey }),
      },
      WALLET_BOUNDS.REQUEST_TIMEOUT_MS,
    );

    if (!challengeResponse.ok) {
      let errMsg = "Failed to generate challenge";
      try {
        const errData = (await challengeResponse.json()) as { error?: string };
        errMsg = errData.error ?? errMsg;
      } catch {
        // ignore parse error
      }
      throw new WalletConnectError("challenge_failed", sanitiseMessage(errMsg));
    }

    const { transaction } = (await challengeResponse.json()) as { transaction: string };

    // 4. Sign transaction in Freighter.
    let signedTransaction: string;
    try {
      signedTransaction = await stellar.signTransaction(transaction, { network });
    } catch (err) {
      const e = err as Error;
      throw new WalletConnectError("sign_failed", sanitiseMessage(e.message));
    }

    // 5. Verify signed transaction.
    const verifyResponse = await fetchWithTimeout(
      "/api/auth/verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction: signedTransaction }),
      },
      WALLET_BOUNDS.REQUEST_TIMEOUT_MS,
    );

    if (!verifyResponse.ok) {
      let errMsg = "Verification failed";
      try {
        const errData = (await verifyResponse.json()) as { error?: string };
        errMsg = errData.error ?? errMsg;
      } catch {
        // ignore parse error
      }
      throw new WalletConnectError("verify_failed", sanitiseMessage(errMsg));
    }

    const { walletAddress } = (await verifyResponse.json()) as { walletAddress: string };

    // 6. Validate the returned address.
    if (!isValidStellarAddress(walletAddress)) {
      throw new WalletConnectError(
        "verify_failed",
        "Verification returned an invalid wallet address",
      );
    }
    if (walletAddress !== pubKey) {
      throw new WalletConnectError(
        "address_mismatch",
        "Verified wallet does not match the connected wallet",
      );
    }

    return walletAddress;
  };

  try {
    const walletAddress = await Promise.race([handshake(), timeoutPromise]);
    const latencyMs = Date.now() - startTime;
    emit(onTelemetry, { type: "connect_succeeded", latencyMs });
    return walletAddress;
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    if (err instanceof WalletConnectError) {
      const eventType = timedOut || err.reason === "connect_timeout"
        ? "connect_timeout"
        : "connect_failed";
      emit(onTelemetry, {
        type: eventType,
        latencyMs,
        failureReason: err.reason,
        message: sanitiseMessage(err.message),
      });
      throw err;
    }
    // Re-wrap unexpected errors so callers always get a typed error.
    const e = err as Error;
    const wrapped = new WalletConnectError("unknown", sanitiseMessage(e.message));
    emit(onTelemetry, {
      type: "connect_failed",
      latencyMs,
      failureReason: "unknown",
      message: sanitiseMessage(e.message),
    });
    throw wrapped;
  }
}
