/**
 * hooks/useWalletConnection.ts
 *
 * Standalone wallet connection hook (no React Context dependency).
 * Used directly by WalletGate and other components that need wallet state
 * without the full WalletProvider tree.
 *
 * Uses the same shared utilities as WalletContext so the two entry points
 * cannot drift apart:
 *  - `rehydrateWalletSession()` for server-session validation on mount.
 *  - `connectWallet()` for the SEP-10 handshake with typed errors and
 *    an overall CONNECT_TIMEOUT_MS bound.
 *
 * Bounded performance guarantees:
 *  - `isInitializing` is true during the mount rehydration so callers can
 *    show a skeleton instead of flashing the unauthenticated view.
 *  - Rapid connect() calls are debounced by RECONNECT_DEBOUNCE_MS.
 *  - All failure paths emit structured telemetry via `onTelemetry`.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import config from "@/lib/config";
import { safeRedirectPath } from "@/lib/security/safe-redirect";
import {
  connectWallet,
  WalletConnectError,
  type StellarNetwork,
} from "@/lib/wallet/connectHandshake";
import { rehydrateWalletSession } from "@/lib/wallet/sessionRehydration";
import { WALLET_BOUNDS, type WalletTelemetryEvent } from "@/types/wallet";

export type WalletStatus = "initializing" | "disconnected" | "connecting" | "connected" | "error";
export type { StellarNetwork };

export interface UseWalletConnectionOptions {
  onTelemetry?: (event: WalletTelemetryEvent) => void;
}

export const useWalletConnection = ({ onTelemetry }: UseWalletConnectionOptions = {}) => {
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<WalletStatus>("initializing");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onTelemetryRef = useRef(onTelemetry);
  onTelemetryRef.current = onTelemetry;

  const lastConnectAtRef = useRef<number>(0);

  const network: StellarNetwork =
    config.stellar.network.toUpperCase() === "MAINNET" ||
      config.stellar.network.toUpperCase() === "PUBLIC"
      ? "PUBLIC"
      : "TESTNET";

  const clearWalletIdentity = useCallback(() => {
    setAddress(null);
    sessionStorage.removeItem("walletAddress");
  }, []);

  const clearWalletState = useCallback(() => {
    clearWalletIdentity();
    setStatus("disconnected");
    setError(null);
  }, [clearWalletIdentity]);

  // Rehydrate state on mount using the shared utility.
  useEffect(() => {
    const storedAddress = sessionStorage.getItem("walletAddress");

    rehydrateWalletSession({
      network,
      storedAddress,
      onTelemetry: onTelemetryRef.current,
    }).then((outcome) => {
      if (!outcome.ok) {
        clearWalletState();
        return;
      }
      setAddress(outcome.walletAddress);
      setStatus("connected");
      sessionStorage.setItem("walletAddress", outcome.walletAddress);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(async () => {
    if (status === "connecting" || status === "initializing") return;

    const now = Date.now();
    if (now - lastConnectAtRef.current < WALLET_BOUNDS.RECONNECT_DEBOUNCE_MS) return;
    lastConnectAtRef.current = now;

    setStatus("connecting");
    setError(null);

    try {
      const verifiedAddress = await connectWallet(network, {
        onTelemetry: onTelemetryRef.current,
      });
      setAddress(verifiedAddress);
      setStatus("connected");
      sessionStorage.setItem("walletAddress", verifiedAddress);

      const returnUrl = new URL(window.location.href).searchParams.get("returnUrl");
      if (returnUrl) {
        router.push(safeRedirectPath(returnUrl));
      }
    } catch (err) {
      const e = err as Error;
      const message =
        err instanceof WalletConnectError ? err.message : (e.message || "Wallet connection failed");
      setError(message);
      setStatus("error");
      clearWalletIdentity();
    }
  }, [clearWalletIdentity, network, router, status]);

  const disconnect = useCallback(async () => {
    setError(null);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch {
      // non-fatal
    } finally {
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
    isInitializing: status === "initializing",
    isConnected: status === "connected",
    isLoading: status === "initializing" || status === "connecting",
    connect,
    disconnect,
  };
};
