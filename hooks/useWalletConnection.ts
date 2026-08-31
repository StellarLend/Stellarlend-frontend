import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import config from "@/lib/config";
import { safeRedirectPath } from "@/lib/security/safe-redirect";
import { connectWallet, type StellarNetwork } from "@/lib/wallet/connectHandshake";
import {
  assertWalletMatchesSession,
  validateClientSessionResponse,
} from "@/lib/auth/session-boundary";
import {
  getWalletTelemetryService,
  WALLET_BOUNDS,
} from "@/lib/telemetry/walletTelemetry";

export type WalletStatus = "disconnected" | "connecting" | "connected" | "error";
export type { StellarNetwork };

// ---------------------------------------------------------------------------
// Internal timeout-aware fetch
// ---------------------------------------------------------------------------

async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timerId);
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useWalletConnection = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const router = useRouter();

  // Guards — use refs so they are never stale inside async callbacks.
  const rehydrationDoneRef = useRef(false);
  const isConnectingRef = useRef(false);

  const network: StellarNetwork =
    config.stellar.network.toUpperCase() === "MAINNET" ||
      config.stellar.network.toUpperCase() === "PUBLIC"
      ? "PUBLIC"
      : "TESTNET";

  // ---------------------------------------------------------------------------
  // Identity helpers — stable, no deps that change after mount
  // ---------------------------------------------------------------------------

  const clearWalletIdentity = useCallback(() => {
    setAddress(null);
    sessionStorage.removeItem("walletAddress");
  }, []);

  const clearWalletState = useCallback(() => {
    clearWalletIdentity();
    setStatus("disconnected");
  }, [clearWalletIdentity]);

  // ---------------------------------------------------------------------------
  // Rehydration — runs once on mount, deduplicated by rehydrationDoneRef
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Deduplicate: React Strict Mode double-invokes effects; skip the second run.
    if (rehydrationDoneRef.current) return;
    rehydrationDoneRef.current = true;

    const controller = new AbortController();
    const telemetry = getWalletTelemetryService();
    const t0 = Date.now();

    telemetry.record({ type: "rehydration_started", timestamp: t0 });

    let timedOut = false;
    const timerId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, WALLET_BOUNDS.SESSION_FETCH_TIMEOUT_MS);

    const rehydrate = async () => {
      const storedAddress = sessionStorage.getItem("walletAddress");

      try {
        const response = await fetch("/api/auth/session", {
          signal: controller.signal,
        });

        clearTimeout(timerId);

        if (!response.ok) {
          clearWalletState();
          telemetry.record({
            type: "rehydration_failed",
            timestamp: Date.now(),
            latencyMs: Date.now() - t0,
            errorType: "session_not_ok",
            errorMessage: `HTTP ${response.status}`,
          });
          return;
        }

        const data = await response.json();
        const session = validateClientSessionResponse(data, network);
        assertWalletMatchesSession(storedAddress, session.walletAddress);

        setAddress(session.walletAddress);
        setStatus("connected");
        sessionStorage.setItem("walletAddress", session.walletAddress);

        telemetry.record({
          type: "rehydration_succeeded",
          timestamp: Date.now(),
          latencyMs: Date.now() - t0,
        });
      } catch (err: unknown) {
        clearTimeout(timerId);

        if (controller.signal.aborted) {
          if (timedOut) {
            telemetry.record({
              type: "session_fetch_timeout",
              timestamp: Date.now(),
              latencyMs: Date.now() - t0,
              errorMessage: `Timed out after ${WALLET_BOUNDS.SESSION_FETCH_TIMEOUT_MS}ms`,
            });
          } else {
            telemetry.record({ type: "rehydration_aborted", timestamp: Date.now() });
          }
          // Do not update state after unmount/abort.
          return;
        }

        telemetry.record({
          type: "rehydration_failed",
          timestamp: Date.now(),
          latencyMs: Date.now() - t0,
          errorType: err instanceof Error ? err.constructor.name : "UnknownError",
          errorMessage: err instanceof Error ? err.message : "Unknown error",
        });

        clearWalletState();
      } finally {
        setIsInitializing(false);
      }
    };

    rehydrate();

    return () => {
      // Cancel the in-flight fetch if the hook unmounts before it resolves.
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network, clearWalletState]);

  // ---------------------------------------------------------------------------
  // connect — concurrent guard + overall timeout + telemetry
  // ---------------------------------------------------------------------------

  const connect = useCallback(async () => {
    const telemetry = getWalletTelemetryService();

    if (isConnectingRef.current || status === "connecting") {
      telemetry.record({ type: "connect_rejected_concurrent", timestamp: Date.now() });
      return;
    }

    isConnectingRef.current = true;
    setStatus("connecting");
    setError(null);

    const t0 = Date.now();
    telemetry.record({ type: "connect_started", timestamp: t0 });

    // Abort signal for overall connect timeout.
    const controller = new AbortController();
    const timerId = setTimeout(
      () => controller.abort(),
      WALLET_BOUNDS.CONNECT_TIMEOUT_MS,
    );

    try {
      const verifiedAddress = await connectWallet(network);
      clearTimeout(timerId);

      setAddress(verifiedAddress);
      setStatus("connected");
      sessionStorage.setItem("walletAddress", verifiedAddress);

      telemetry.record({
        type: "connect_succeeded",
        timestamp: Date.now(),
        latencyMs: Date.now() - t0,
      });

      const returnUrl = new URL(window.location.href).searchParams.get("returnUrl");
      if (returnUrl) {
        router.push(safeRedirectPath(returnUrl));
      }
    } catch (err: unknown) {
      clearTimeout(timerId);

      const message =
        controller.signal.aborted
          ? `Connect timed out after ${WALLET_BOUNDS.CONNECT_TIMEOUT_MS}ms`
          : err instanceof Error
            ? err.message
            : "Wallet connection failed";

      telemetry.record({
        type: "connect_failed",
        timestamp: Date.now(),
        latencyMs: Date.now() - t0,
        errorType: err instanceof Error ? err.constructor.name : "UnknownError",
        errorMessage: message,
      });

      setError(message);
      setStatus("error");
      clearWalletIdentity();
    } finally {
      isConnectingRef.current = false;
    }
  }, [status, network, router, clearWalletIdentity]);

  // ---------------------------------------------------------------------------
  // disconnect
  // ---------------------------------------------------------------------------

  const disconnect = useCallback(async () => {
    const telemetry = getWalletTelemetryService();
    setError(null);
    telemetry.record({ type: "disconnect_started", timestamp: Date.now() });

    try {
      await fetchWithTimeout(
        "/api/auth/session",
        { method: "DELETE" },
        WALLET_BOUNDS.SESSION_FETCH_TIMEOUT_MS,
      );
      telemetry.record({ type: "disconnect_succeeded", timestamp: Date.now() });
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      telemetry.record({
        type: "disconnect_failed",
        timestamp: Date.now(),
        errorType: isTimeout ? "TimeoutError" : (err instanceof Error ? err.constructor.name : "UnknownError"),
        errorMessage: isTimeout
          ? "Session DELETE timed out"
          : err instanceof Error
            ? err.message
            : undefined,
      });
    } finally {
      // Always clear local state so the user is logged out regardless of server response.
      clearWalletState();
    }

    const returnUrl = new URL(window.location.href).searchParams.get("returnUrl");
    if (returnUrl) {
      router.push(safeRedirectPath(returnUrl));
    }
  }, [clearWalletState, router]);

  return {
    address,
    walletAddress: address,
    network,
    status,
    error,
    isConnected: status === "connected",
    isLoading: isInitializing || status === "connecting",
    connect,
    disconnect,
  };
};
