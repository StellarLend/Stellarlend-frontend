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
    };
  }
}

export type WalletStatus = "disconnected" | "connecting" | "connected" | "error";
export type StellarNetwork = "PUBLIC" | "TESTNET";

export interface WalletContextType {
  address: string | null;
  network: StellarNetwork;
  status: WalletStatus;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
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
          } else {
            // Server has no session, clear client state
            setAddress(null);
            setStatus("disconnected");
            sessionStorage.removeItem("walletAddress");
          }
        } else {
          // If session request fails (e.g., unauthorized), clear state
          setAddress(null);
          setStatus("disconnected");
          sessionStorage.removeItem("walletAddress");
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
      if (pubKey.length !== 56 || !pubKey.startsWith("G")) {
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
      setAddress(verifiedAddress);
      setStatus("connected");
      sessionStorage.setItem("walletAddress", verifiedAddress);

      const returnUrl = new URL(window.location.href).searchParams.get("returnUrl");
      if (returnUrl) {
        router.push(safeRedirectPath(returnUrl));
      }
    } catch (err: any) {
      console.error("Wallet connection failed:", err);
      setError(err.message || "Wallet connection failed");
      setStatus("error");
      setAddress(null);
      sessionStorage.removeItem("walletAddress");
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
      setStatus("disconnected");
      sessionStorage.removeItem("walletAddress");
    }

    const returnUrl = new URL(window.location.href).searchParams.get("returnUrl");
    if (returnUrl) {
      router.push(safeRedirectPath(returnUrl));
    }
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        network,
        status,
        error,
        connect,
        disconnect,
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
