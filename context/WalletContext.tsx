"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  FC,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import config from "@/lib/config";
import { safeRedirectPath } from "@/lib/security/safe-redirect";
import {
  connectWallet,
  isValidStellarAddress,
  type StellarNetwork,
} from "@/lib/wallet/connectHandshake";
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

const ACCOUNTS_STORAGE_KEY = "walletAccounts";
const ACTIVE_ACCOUNT_STORAGE_KEY = "walletActiveAccount";

export interface WalletContextType {
  address: string | null;
  accounts: string[];
  activeAccount: string | null;
  network: StellarNetwork;
  status: WalletStatus;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchAccount: (address: string) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function readStoredAccounts(): string[] {
  try {
    const raw = sessionStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((a) => typeof a === "string") : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Timeout-aware fetch helper
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
// Provider
// ---------------------------------------------------------------------------

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [activeAccount, setActiveAccount] = useState<string | null>(null);
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Guards
  const rehydrationDoneRef = useRef(false);
  const isConnectingRef = useRef(false);

  // Abort controller for the in-flight rehydration fetch so we can cancel on
  // unmount before the state updates land.
  const rehydrationAbortRef = useRef<AbortController | null>(null);

  // Map config network to PUBLIC or TESTNET — stable, computed once.
  const network: StellarNetwork =
    config.stellar.network.toUpperCase() === "MAINNET" ||
      config.stellar.network.toUpperCase() === "PUBLIC"
      ? "PUBLIC"
      : "TESTNET";

  // ---------------------------------------------------------------------------
  // Identity helpers
  // ---------------------------------------------------------------------------

  const clearWalletIdentity = useCallback(() => {
    setAddress(null);
    setAccounts([]);
    setActiveAccount(null);
    sessionStorage.removeItem("walletAddress");
    sessionStorage.removeItem(ACCOUNTS_STORAGE_KEY);
    sessionStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
  }, []);

  const clearWalletState = useCallback(() => {
    clearWalletIdentity();
    setStatus("disconnected");
  }, [clearWalletIdentity]);

  // ---------------------------------------------------------------------------
  // Rehydration — runs once on mount, deduplicated by rehydrationDoneRef
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Deduplicate: React Strict Mode can double-invoke effects; only run once.
    if (rehydrationDoneRef.current) return;
    rehydrationDoneRef.current = true;

    const controller = new AbortController();
    rehydrationAbortRef.current = controller;
    const telemetry = getWalletTelemetryService();
    const t0 = Date.now();

    telemetry.record({ type: "rehydration_started", timestamp: t0 });

    const rehydrate = async () => {
      const storedAddress = sessionStorage.getItem("walletAddress");

      let timedOut = false;
      const timerId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, WALLET_BOUNDS.SESSION_FETCH_TIMEOUT_MS);

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

        const storedAccounts = readStoredAccounts();
        const raw = storedAccounts.includes(session.walletAddress)
          ? storedAccounts.filter(isValidStellarAddress)
          : [session.walletAddress];
        // Bound account list size
        const resolvedAccounts = raw.slice(0, WALLET_BOUNDS.MAX_ACCOUNTS);
        setAccounts(resolvedAccounts);
        sessionStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(resolvedAccounts));
        setActiveAccount(session.walletAddress);
        sessionStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, session.walletAddress);

        telemetry.record({
          type: "rehydration_succeeded",
          timestamp: Date.now(),
          latencyMs: Date.now() - t0,
        });
      } catch (err: unknown) {
        clearTimeout(timerId);

        // Don't update state after unmount.
        if (controller.signal.aborted) {
          const reason = timedOut ? "session_fetch_timeout" : "rehydration_aborted";
          if (timedOut) {
            telemetry.record({
              type: "session_fetch_timeout",
              timestamp: Date.now(),
              latencyMs: Date.now() - t0,
              errorMessage: `Timed out after ${WALLET_BOUNDS.SESSION_FETCH_TIMEOUT_MS}ms`,
            });
          } else {
            telemetry.record({ type: reason as "rehydration_aborted", timestamp: Date.now() });
          }
          return;
        }

        const message = err instanceof Error ? err.message : "Unknown error";
        telemetry.record({
          type: "rehydration_failed",
          timestamp: Date.now(),
          latencyMs: Date.now() - t0,
          errorType: err instanceof Error ? err.constructor.name : "UnknownError",
          errorMessage: message,
        });

        clearWalletState();
      }
    };

    rehydrate();

    return () => {
      // Cancel the in-flight fetch if the component unmounts before it resolves.
      controller.abort();
      rehydrationAbortRef.current = null;
    };
    // network and clearWalletState are stable after mount; include them to
    // satisfy exhaustive-deps without causing re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network, clearWalletState]);

  // ---------------------------------------------------------------------------
  // connect — concurrent guard + telemetry
  // ---------------------------------------------------------------------------

  const connect = useCallback(async () => {
    const telemetry = getWalletTelemetryService();

    // Deduplicate concurrent connect calls (e.g. double-click).
    if (isConnectingRef.current || status === "connecting") {
      telemetry.record({ type: "connect_rejected_concurrent", timestamp: Date.now() });
      return;
    }

    isConnectingRef.current = true;
    setStatus("connecting");
    setError(null);

    const t0 = Date.now();
    telemetry.record({ type: "connect_started", timestamp: t0 });

    // Overall connect timeout — covers the full handshake (challenge + sign + verify).
    const controller = new AbortController();
    const timerId = setTimeout(
      () => controller.abort(),
      WALLET_BOUNDS.CONNECT_TIMEOUT_MS,
    );

    try {
      const verifiedAddress = await connectWallet(network);
      clearTimeout(timerId);

      // Enumerate accounts; fall back to single-account list on any failure.
      let resolvedAccounts: string[] = [verifiedAddress];
      try {
        const stellar = window.stellar;
        if (stellar && typeof stellar.getAccounts === "function") {
          const list = await stellar.getAccounts();
          if (Array.isArray(list) && list.length > 0) {
            // Bound the list before any further processing.
            const bounded = list.slice(0, WALLET_BOUNDS.MAX_ACCOUNTS);
            const valid = bounded.filter(isValidStellarAddress);
            if (!valid.includes(verifiedAddress)) {
              valid.unshift(verifiedAddress);
            }
            resolvedAccounts = valid;
          }
        }
      } catch {
        resolvedAccounts = [verifiedAddress];
      }

      // Deduplicate and re-bound after merging.
      resolvedAccounts = Array.from(new Set(resolvedAccounts))
        .filter(isValidStellarAddress)
        .slice(0, WALLET_BOUNDS.MAX_ACCOUNTS);

      if (!resolvedAccounts.includes(verifiedAddress)) {
        resolvedAccounts = [verifiedAddress];
      }

      setAddress(verifiedAddress);
      setAccounts(resolvedAccounts);
      setActiveAccount(verifiedAddress);
      setStatus("connected");
      sessionStorage.setItem("walletAddress", verifiedAddress);
      sessionStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(resolvedAccounts));
      sessionStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, verifiedAddress);

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
      const isTimeout =
        err instanceof Error && err.name === "AbortError";
      telemetry.record({
        type: "disconnect_failed",
        timestamp: Date.now(),
        errorType: isTimeout ? "TimeoutError" : (err instanceof Error ? err.constructor.name : "UnknownError"),
        errorMessage: isTimeout ? "Session DELETE timed out" : (err instanceof Error ? err.message : undefined),
      });
    } finally {
      // Always clear local state so the user is logged out locally regardless
      // of whether the server DELETE succeeded.
      clearWalletState();
    }

    const returnUrl = new URL(window.location.href).searchParams.get("returnUrl");
    if (returnUrl) {
      router.push(safeRedirectPath(returnUrl));
    }
  }, [clearWalletState, router]);

  // ---------------------------------------------------------------------------
  // switchAccount
  // ---------------------------------------------------------------------------

  const switchAccount = useCallback(
    async (nextAddress: string) => {
      if (!nextAddress || !accounts.includes(nextAddress)) {
        setError("Unknown account: cannot switch to an address not exposed by the wallet");
        return;
      }

      if (nextAddress !== address) {
        setError(
          "Switching accounts requires reconnecting so the server can authorize the wallet",
        );
        return;
      }

      if (nextAddress === activeAccount) {
        return;
      }

      setError(null);
      setActiveAccount(nextAddress);
      setAddress(nextAddress);
      sessionStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, nextAddress);
      sessionStorage.setItem("walletAddress", nextAddress);

      getWalletTelemetryService().record({
        type: "account_switch",
        timestamp: Date.now(),
      });
    },
    [accounts, address, activeAccount],
  );

  return (
    <WalletContext.Provider
      value={{
        address,
        accounts,
        activeAccount,
        network,
        status,
        error,
        connect,
        disconnect,
        switchAccount,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWalletContext = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWalletContext must be used within a WalletProvider");
  }
  return context;
};
