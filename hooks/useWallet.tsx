"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { publicConfig } from "@/lib/config";
import { safeRedirectPath } from "@/lib/security/safe-redirect";

export interface UseWalletResult {
  account: string | null;
  network: string;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

interface WalletState {
  account: string | null;
  isConnecting: boolean;
  error: string | null;
}

const WalletContext = createContext<
  | (UseWalletResult & { isConnecting: boolean; error: string | null })
  | undefined
>(undefined);

const isBrowser = typeof window !== "undefined";

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [state, setState] = useState<WalletState>({
    account: null,
    isConnecting: false,
    error: null,
  });
  const checkedSession = useRef(false);
  const router = useRouter();

  const network = publicConfig.stellar.network;

  useEffect(() => {
    if (!isBrowser || checkedSession.current) return;
    checkedSession.current = true;

    fetch("/api/auth/session")
      .then((res) => {
        if (!res.ok) throw new Error("No session");
        return res.json();
      })
      .then((data) => {
        if (data?.session?.user?.walletAddress) {
          setState((prev) => ({
            ...prev,
            account: data.session.user.walletAddress,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const connect = useCallback(async () => {
    if (!isBrowser) throw new Error("Cannot connect wallet during SSR");
    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const stellar = (window as any).stellar;
      if (!stellar?.getPublicKey) {
        throw new Error("Stellar wallet provider (Freighter) not detected");
      }

      const pubKey = await stellar.getPublicKey();
      if (!pubKey) throw new Error("No public key returned from wallet");

      const challengeRes = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: pubKey }),
      });

      if (!challengeRes.ok) {
        const errData = await challengeRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate challenge");
      }

      const { transaction } = await challengeRes.json();
      const networkPassphrase =
        network === "mainnet" ? "PUBLIC" : "TESTNET";
      const signedTransaction = await stellar.signTransaction(transaction, {
        network: networkPassphrase,
      });

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction: signedTransaction }),
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        throw new Error(errData.error || "Verification failed");
      }

      const { walletAddress: verifiedAddress } = await verifyRes.json();
      setState((prev) => ({
        ...prev,
        account: verifiedAddress,
        isConnecting: false,
      }));

      const returnUrl = new URL(window.location.href).searchParams.get('returnUrl');
      if (returnUrl) {
        router.push(safeRedirectPath(returnUrl));
      }
    } catch (err: any) {
      const msg = err.message || "Wallet connection failed";
      setState((prev) => ({ ...prev, error: msg, isConnecting: false }));
      throw err;
    }
  }, [network, router]);

  const disconnect = useCallback(async () => {
    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const res = await fetch("/api/auth/session", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect");
      setState((prev) => ({
        ...prev,
        account: null,
        isConnecting: false,
      }));
    } catch (err: any) {
      const msg = err.message || "Failed to disconnect";
      setState((prev) => ({ ...prev, error: msg, isConnecting: false }));
      throw err;
    } finally {
      const returnUrl = new URL(window.location.href).searchParams.get('returnUrl');
      if (returnUrl) {
        router.push(safeRedirectPath(returnUrl));
      }
    }
  }, [router]);

  const value = {
    account: state.account,
    network,
    isConnected: state.account !== null,
    connect,
    disconnect,
    isConnecting: state.isConnecting,
    error: state.error,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): UseWalletResult & {
  isConnecting: boolean;
  error: string | null;
} {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
