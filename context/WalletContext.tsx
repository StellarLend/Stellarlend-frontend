"use client";

import React, { createContext, useContext, useState, useEffect, FC, ReactNode } from "react";
import { useRouter } from "next/navigation";
import config from "@/lib/config";
import { safeRedirectPath } from "@/lib/security/safe-redirect";
import { connectWallet, isValidStellarAddress, type StellarNetwork } from "@/lib/wallet/connectHandshake";
import {
  assertWalletMatchesSession,
  validateClientSessionResponse,
} from "@/lib/auth/session-boundary";

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

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [activeAccount, setActiveAccount] = useState<string | null>(null);
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const clearWalletIdentity = () => {
    setAddress(null);
    setAccounts([]);
    setActiveAccount(null);
    sessionStorage.removeItem("walletAddress");
    sessionStorage.removeItem(ACCOUNTS_STORAGE_KEY);
    sessionStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
  };

  const clearWalletState = () => {
    clearWalletIdentity();
    setStatus("disconnected");
  };

  // Map config network to PUBLIC or TESTNET
  const network: StellarNetwork =
    config.stellar.network.toUpperCase() === "MAINNET" ||
    config.stellar.network.toUpperCase() === "PUBLIC"
      ? "PUBLIC"
      : "TESTNET";

  // Rehydrate state on mount
  useEffect(() => {
    const rehydrate = async () => {
      // Read storage only as a candidate. Sensitive UI is not unlocked until
      // the server confirms the same active wallet session.
      const storedAddress = sessionStorage.getItem("walletAddress");

      // Fetch session from server to verify/sync.
      try {
        const response = await fetch("/api/auth/session");
        if (response.ok) {
          const data = await response.json();
          const session = validateClientSessionResponse(data, network);
          assertWalletMatchesSession(storedAddress, session.walletAddress);

          setAddress(session.walletAddress);
          setStatus("connected");
          sessionStorage.setItem("walletAddress", session.walletAddress);

          const storedAccounts = readStoredAccounts();
          const resolvedAccounts = storedAccounts.includes(session.walletAddress)
            ? storedAccounts.filter(isValidStellarAddress)
            : [session.walletAddress];
          setAccounts(resolvedAccounts);
          sessionStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(resolvedAccounts));

          setActiveAccount(session.walletAddress);
          sessionStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, session.walletAddress);
        } else {
          clearWalletState();
        }
      } catch (err) {
        console.error("Failed to fetch session during rehydration:", err);
        clearWalletState();
      }
    };

    rehydrate();
  }, [network]);

  const connect = async () => {
    if (status === "connecting") return;
    setStatus("connecting");
    setError(null);

    try {
      const verifiedAddress = await connectWallet(network);

      // Enumerate accounts if the wallet provider supports it; otherwise
      // fall back gracefully to a single-account list.
      let resolvedAccounts: string[] = [verifiedAddress];
      try {
        const stellar = window.stellar;
        if (stellar && typeof stellar.getAccounts === "function") {
          const list = await stellar.getAccounts();
          if (Array.isArray(list) && list.length > 0) {
            resolvedAccounts = list.filter(isValidStellarAddress);
            if (!resolvedAccounts.includes(verifiedAddress)) {
              resolvedAccounts = [verifiedAddress, ...resolvedAccounts];
            }
          }
        }
      } catch (accountsErr) {
        console.error("Failed to enumerate wallet accounts:", accountsErr);
        resolvedAccounts = [verifiedAddress];
      }
      resolvedAccounts = Array.from(new Set(resolvedAccounts)).filter(isValidStellarAddress);
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

      const returnUrl = new URL(window.location.href).searchParams.get("returnUrl");
      if (returnUrl) {
        router.push(safeRedirectPath(returnUrl));
      }
    } catch (err: any) {
      console.error("Wallet connection failed:", err);
      setError(err.message || "Wallet connection failed");
      setStatus("error");
      clearWalletIdentity();
    }
  };

  const disconnect = async () => {
    setError(null);
    try {
      await fetch("/api/auth/session", {
        method: "DELETE",
      });
    } catch (err: any) {
      console.error("Logout failed during disconnect:", err);
    } finally {
      // Always clear local state on disconnect to ensure the user is logged out locally
      clearWalletState();
    }

    const returnUrl = new URL(window.location.href).searchParams.get("returnUrl");
    if (returnUrl) {
      router.push(safeRedirectPath(returnUrl));
    }
  };

  // Switch the active account among already-known accounts.
  // Triggers downstream data refresh (positions, balances) by updating
  // `address`, since existing consumers key their fetch effects off it.
  const switchAccount = async (nextAddress: string) => {
    if (!nextAddress || !accounts.includes(nextAddress)) {
      setError("Unknown account: cannot switch to an address not exposed by the wallet");
      return;
    }

    if (nextAddress !== address) {
      setError("Switching accounts requires reconnecting so the server can authorize the wallet");
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
  };

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
