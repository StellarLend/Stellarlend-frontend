"use client";

import React, { createContext, useContext, useState, useEffect, FC, ReactNode } from "react";
import { useRouter } from "next/navigation";
import config from "@/lib/config";
import { safeRedirectPath } from "@/lib/security/safe-redirect";

declare global {
  interface Window {
    stellar?: {
      getPublicKey: () => Promise<string>;
      signTransaction: (xdr: string, opts?: { network: string }) => Promise<string>;
      // Optional: not all wallet providers expose multiple accounts.
      // When present, used to enumerate accounts for the switcher.
      getAccounts?: () => Promise<string[]>;
    };
  }
}

export type WalletStatus = "disconnected" | "connecting" | "connected" | "error";
export type StellarNetwork = "PUBLIC" | "TESTNET";

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

function isValidStellarAddress(pubKey: string): boolean {
  return pubKey.length === 56 && pubKey.startsWith("G");
}

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

  // Map config network to PUBLIC or TESTNET
  const network: StellarNetwork =
    config.stellar.network.toUpperCase() === "MAINNET" ||
    config.stellar.network.toUpperCase() === "PUBLIC"
      ? "PUBLIC"
      : "TESTNET";

  // Rehydrate state on mount
  useEffect(() => {
    const rehydrate = async () => {
      // 1. Read from sessionStorage first for immediate hydration
      const storedAddress = sessionStorage.getItem("walletAddress");
      if (storedAddress) {
        setAddress(storedAddress);
        setStatus("connected");

        const storedAccounts = readStoredAccounts();
        const storedActive = sessionStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
        const resolvedAccounts = storedAccounts.length > 0 ? storedAccounts : [storedAddress];
        setAccounts(resolvedAccounts);
        setActiveAccount(
          storedActive && resolvedAccounts.includes(storedActive) ? storedActive : storedAddress,
        );
      }

      // 2. Fetch session from server to verify/sync
      try {
        const response = await fetch("/api/auth/session");
        if (response.ok) {
          const data = await response.json();
          const sessionAddress = data?.session?.user?.walletAddress;
          if (sessionAddress) {
            setAddress(sessionAddress);
            setStatus("connected");
            sessionStorage.setItem("walletAddress", sessionAddress);

            const storedAccounts = readStoredAccounts();
            const resolvedAccounts = storedAccounts.includes(sessionAddress)
              ? storedAccounts
              : [sessionAddress];
            setAccounts(resolvedAccounts);
            sessionStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(resolvedAccounts));

            const storedActive = sessionStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
            const nextActive =
              storedActive && resolvedAccounts.includes(storedActive) ? storedActive : sessionAddress;
            setActiveAccount(nextActive);
            sessionStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, nextActive);
          } else {
            // Server has no session, clear client state
            setAddress(null);
            setStatus("disconnected");
            setAccounts([]);
            setActiveAccount(null);
            sessionStorage.removeItem("walletAddress");
            sessionStorage.removeItem(ACCOUNTS_STORAGE_KEY);
            sessionStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
          }
        } else {
          // If session request fails (e.g., unauthorized), clear state
          setAddress(null);
          setStatus("disconnected");
          setAccounts([]);
          setActiveAccount(null);
          sessionStorage.removeItem("walletAddress");
          sessionStorage.removeItem(ACCOUNTS_STORAGE_KEY);
          sessionStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
        }
      } catch (err) {
        console.error("Failed to fetch session during rehydration:", err);
      }
    };

    rehydrate();
  }, []);

  const connect = async () => {
    if (status === "connecting") return;
    setStatus("connecting");
    setError(null);

    try {
      const stellar = window.stellar;
      if (!stellar) {
        throw new Error("Stellar wallet provider (Freighter) not detected");
      }

      // 1. Get client public key
      const pubKey = await stellar.getPublicKey();
      if (!pubKey) {
        throw new Error("No public key returned from wallet");
      }

      // Validate the resolved address is a 56-char Stellar public key before persisting it
      if (!isValidStellarAddress(pubKey)) {
        throw new Error("Invalid Stellar public key");
      }

      // 2. Fetch SEP-10 challenge transaction
      const challengeResponse = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: pubKey }),
      });

      if (!challengeResponse.ok) {
        const errData = await challengeResponse.json();
        throw new Error(errData.error || "Failed to generate challenge");
      }

      const { transaction } = await challengeResponse.json();

      // 3. Sign transaction
      const signedTransaction = await stellar.signTransaction(transaction, {
        network,
      });

      // 4. Verify transaction signature and establish session
      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction: signedTransaction }),
      });

      if (!verifyResponse.ok) {
        const errData = await verifyResponse.json();
        throw new Error(errData.error || "Verification failed");
      }

      const { walletAddress: verifiedAddress } = await verifyResponse.json();

      // 5. Enumerate accounts if the wallet provider supports it; otherwise
      // fall back gracefully to a single-account list.
      let resolvedAccounts: string[] = [verifiedAddress];
      try {
        if (typeof stellar.getAccounts === "function") {
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
      setAddress(null);
      setAccounts([]);
      setActiveAccount(null);
      sessionStorage.removeItem("walletAddress");
      sessionStorage.removeItem(ACCOUNTS_STORAGE_KEY);
      sessionStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
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
      setAddress(null);
      setAccounts([]);
      setActiveAccount(null);
      setStatus("disconnected");
      sessionStorage.removeItem("walletAddress");
      sessionStorage.removeItem(ACCOUNTS_STORAGE_KEY);
      sessionStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
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
