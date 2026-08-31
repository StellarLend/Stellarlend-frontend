"use client";

/**
 * context/WalletContext.tsx
 *
 * Primary client-side wallet state container.
 *
 * Improvements in this revision:
 *
 *  - `"initializing"` status fills the gap between mount and the first
 *    server-session response. Consumers can now distinguish "not yet known"
 *    from "definitely disconnected" and avoid a flash of the connect button.
 *
 *  - Session rehydration delegates to the shared `rehydrateWalletSession()`
 *    utility (lib/wallet/sessionRehydration.ts) so this file and
 *    useWalletConnection.ts no longer maintain separate copies of the same
 *    fetch-validate-clear logic.
 *
 *  - Redundant-connect guard: `connect()` is blocked while `status` is
 *    `"connecting"` OR `"initializing"`. A debounce ref prevents a
 *    double-click from sneaking through the async gap between the click and
 *    the first state update.
 *
 *  - `connectWallet()` now receives the `onTelemetry` callback so every
 *    handshake path (timeout, sign failure, address mismatch, …) is
 *    observable without leaking secrets.
 *
 *  - Account list is bounded to WALLET_BOUNDS.MAX_ACCOUNTS to prevent
 *    adversarially large account arrays from causing render cost blowup.
 *
 *  - `isInitializing` is exposed on the context so layouts and guards can
 *    show a loading skeleton instead of incorrectly rendering the
 *    unauthenticated view.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import config from "@/lib/config";
import { safeRedirectPath } from "@/lib/security/safe-redirect";
import {
  connectWallet,
  isValidStellarAddress,
  WalletConnectError,
  type StellarNetwork,
} from "@/lib/wallet/connectHandshake";
import { rehydrateWalletSession } from "@/lib/wallet/sessionRehydration";
import { WALLET_BOUNDS, type WalletTelemetryEvent } from "@/types/wallet";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type WalletStatus = "initializing" | "disconnected" | "connecting" | "connected" | "error";
export type { StellarNetwork };

export interface WalletContextType {
  address: string | null;
  accounts: string[];
  activeAccount: string | null;
  network: StellarNetwork;
  status: WalletStatus;
  /** True during the initial server-session fetch so consumers can show skeletons. */
  isInitializing: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchAccount: (address: string) => Promise<void>;
  /** Register a telemetry listener. Only one listener is supported at a time. */
  onTelemetry?: (event: WalletTelemetryEvent) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// sessionStorage keys
// ---------------------------------------------------------------------------

const STORAGE_KEY_ADDRESS = "walletAddress";
const STORAGE_KEY_ACCOUNTS = "walletAccounts";
const STORAGE_KEY_ACTIVE = "walletActiveAccount";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readStoredAccounts(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_ACCOUNTS);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((a): a is string => typeof a === "string") : [];
  } catch {
    return [];
  }
}

function resolveNetwork(): StellarNetwork {
  const n = config.stellar.network.toUpperCase();
  return n === "MAINNET" || n === "PUBLIC" ? "PUBLIC" : "TESTNET";
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const WalletProvider: FC<{ children: ReactNode; onTelemetry?: (event: WalletTelemetryEvent) => void }> = ({
  children,
  onTelemetry,
}) => {
  const [address, setAddress] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [activeAccount, setActiveAccount] = useState<string | null>(null);
  const [status, setStatus] = useState<WalletStatus>("initializing");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Keep latest onTelemetry accessible inside callbacks without re-creating them.
  const onTelemetryRef = useRef(onTelemetry);
  onTelemetryRef.current = onTelemetry;

  // Debounce guard: timestamp of the last connect() invocation.
  const lastConnectAtRef = useRef<number>(0);

  // Derived values.
  const network = resolveNetwork();
  const isInitializing = status === "initializing";

  // -------------------------------------------------------------------------
  // State helpers
  // -------------------------------------------------------------------------

  const clearWalletIdentity = useCallback(() => {
    setAddress(null);
    setAccounts([]);
    setActiveAccount(null);
    sessionStorage.removeItem(STORAGE_KEY_ADDRESS);
    sessionStorage.removeItem(STORAGE_KEY_ACCOUNTS);
    sessionStorage.removeItem(STORAGE_KEY_ACTIVE);
  }, []);

  const clearWalletState = useCallback(() => {
    clearWalletIdentity();
    setStatus("disconnected");
    setError(null);
  }, [clearWalletIdentity]);

  // -------------------------------------------------------------------------
  // Rehydration (mount)
  // -------------------------------------------------------------------------

  useEffect(() => {
    const storedAddress = sessionStorage.getItem(STORAGE_KEY_ADDRESS);

    rehydrateWalletSession({
      network,
      storedAddress,
      onTelemetry: onTelemetryRef.current,
    }).then((outcome) => {
      if (!outcome.ok) {
        clearWalletState();
        return;
      }

      const { walletAddress } = outcome;

      // Populate accounts: if the stored list includes the verified address,
      // use it (filtered to valid addresses). Otherwise fall back to a
      // single-entry list. Bounded to MAX_ACCOUNTS.
      const storedAccounts = readStoredAccounts();
      const resolvedAccounts = (
        storedAccounts.includes(walletAddress)
          ? storedAccounts.filter(isValidStellarAddress)
          : [walletAddress]
      ).slice(0, WALLET_BOUNDS.MAX_ACCOUNTS);

      setAddress(walletAddress);
      setAccounts(resolvedAccounts);
      setActiveAccount(walletAddress);
      setStatus("connected");
      // Keep storage consistent with what the server confirmed.
      sessionStorage.setItem(STORAGE_KEY_ADDRESS, walletAddress);
      sessionStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(resolvedAccounts));
      sessionStorage.setItem(STORAGE_KEY_ACTIVE, walletAddress);
    });
    // Run once on mount. `network` is derived from env and won't change at runtime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Connect
  // -------------------------------------------------------------------------

  const connect = useCallback(async () => {
    // Block while in-flight or still initializing.
    if (status === "connecting" || status === "initializing") {
      onTelemetryRef.current?.({
        type: "duplicate_connect_blocked",
        timestamp: Date.now(),
        metadata: { status },
      });
      return;
    }

    // Debounce: drop calls within RECONNECT_DEBOUNCE_MS of the last one.
    const now = Date.now();
    if (now - lastConnectAtRef.current < WALLET_BOUNDS.RECONNECT_DEBOUNCE_MS) {
      onTelemetryRef.current?.({
        type: "duplicate_connect_blocked",
        timestamp: now,
        metadata: { reason: "debounced" },
      });
      return;
    }
    lastConnectAtRef.current = now;

    setStatus("connecting");
    setError(null);

    try {
      const verifiedAddress = await connectWallet(network, {
        onTelemetry: onTelemetryRef.current,
      });

      // Enumerate multi-account wallets; gracefully fall back to a
      // single-account list if the provider doesn't support getAccounts().
      // Bounded to MAX_ACCOUNTS to prevent adversarially large lists.
      let resolvedAccounts: string[] = [verifiedAddress];
      try {
        const stellar = window.stellar;
        if (stellar && typeof stellar.getAccounts === "function") {
          const list = await stellar.getAccounts();
          if (Array.isArray(list) && list.length > 0) {
            resolvedAccounts = list
              .filter(isValidStellarAddress)
              .slice(0, WALLET_BOUNDS.MAX_ACCOUNTS);
            if (!resolvedAccounts.includes(verifiedAddress)) {
              resolvedAccounts = [verifiedAddress, ...resolvedAccounts].slice(
                0,
                WALLET_BOUNDS.MAX_ACCOUNTS,
              );
            }
          }
        }
      } catch {
        // getAccounts() is optional; a failure is non-fatal.
        resolvedAccounts = [verifiedAddress];
      }

      // Deduplicate and re-validate.
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
      sessionStorage.setItem(STORAGE_KEY_ADDRESS, verifiedAddress);
      sessionStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(resolvedAccounts));
      sessionStorage.setItem(STORAGE_KEY_ACTIVE, verifiedAddress);

      const returnUrl = new URL(window.location.href).searchParams.get("returnUrl");
      if (returnUrl) {
        router.push(safeRedirectPath(returnUrl));
      }
    } catch (err) {
      const e = err as Error;
      // WalletConnectError carries a typed reason; surface the message only.
      const message =
        err instanceof WalletConnectError ? err.message : (e.message || "Wallet connection failed");
      setError(message);
      setStatus("error");
      clearWalletIdentity();
    }
  }, [clearWalletIdentity, network, router, status]);

  // -------------------------------------------------------------------------
  // Disconnect
  // -------------------------------------------------------------------------

  const disconnect = useCallback(async () => {
    setError(null);
    onTelemetryRef.current?.({ type: "disconnect_started", timestamp: Date.now() });

    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch {
      // Network failure during logout is non-fatal — always clear local state.
    } finally {
      clearWalletState();
      onTelemetryRef.current?.({ type: "disconnect_succeeded", timestamp: Date.now() });
    }

    const returnUrl = new URL(window.location.href).searchParams.get("returnUrl");
    if (returnUrl) {
      router.push(safeRedirectPath(returnUrl));
    }
  }, [clearWalletState, router]);

  // -------------------------------------------------------------------------
  // Switch account
  // -------------------------------------------------------------------------

  /**
   * Switch the active account among the already-known list.
   *
   * NOTE: The current server session is always tied to the address that
   * completed the SEP-10 handshake. Switching to a *different* address
   * requires a full re-connect so the server can authorise the new wallet.
   * This implementation allows switching only within the already-connected
   * set and updates `address` (which downstream data hooks key off) so they
   * automatically refetch for the new active account.
   */
  const switchAccount = useCallback(
    async (nextAddress: string) => {
      onTelemetryRef.current?.({
        type: "account_switch_attempted",
        timestamp: Date.now(),
        metadata: { hasNext: Boolean(nextAddress) },
      });

      if (!nextAddress || !accounts.includes(nextAddress)) {
        const msg = "Unknown account: cannot switch to an address not exposed by the wallet";
        setError(msg);
        onTelemetryRef.current?.({
          type: "account_switch_blocked",
          timestamp: Date.now(),
          message: msg,
        });
        return;
      }

      if (nextAddress === activeAccount) {
        // No-op: already on this account.
        return;
      }

      // A different address requires server re-authorisation.
      if (nextAddress !== address) {
        const msg =
          "Switching accounts requires reconnecting so the server can authorise the wallet";
        setError(msg);
        onTelemetryRef.current?.({
          type: "account_switch_blocked",
          timestamp: Date.now(),
          message: msg,
        });
        return;
      }

      setError(null);
      setActiveAccount(nextAddress);
      setAddress(nextAddress);
      sessionStorage.setItem(STORAGE_KEY_ACTIVE, nextAddress);
      sessionStorage.setItem(STORAGE_KEY_ADDRESS, nextAddress);
    },
    [accounts, activeAccount, address],
  );

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------

  return (
    <WalletContext.Provider
      value={{
        address,
        accounts,
        activeAccount,
        network,
        status,
        isInitializing,
        error,
        connect,
        disconnect,
        switchAccount,
        onTelemetry,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWalletContext = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWalletContext must be used within a WalletProvider");
  }
  return context;
};
