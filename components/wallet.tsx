"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { config } from "@/lib/config";

import {
  getAccountBalances,
  addTrustline as horizonAddTrustline,
  type AccountBalancesMap,
} from "@/lib/horizon";

type Ctx = {
  address: string | null;
  balance: string | null;
  balances: AccountBalancesMap;
  isUnfunded: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalances: () => Promise<void>;
  addTrustline: (asset: { code: string; issuer: string }) => Promise<{ hash: string }>;
};

const WalletCtx = createContext<Ctx>({
  address: null,
  balance: null,
  balances: {},
  isUnfunded: false,
  error: null,
  connect: async () => {},
  disconnect: () => {},
  refreshBalances: async () => {},
  addTrustline: async () => ({ hash: "" }),
});

export const useWallet = () => useContext(WalletCtx);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("wallet");
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [balances, setBalances] = useState<AccountBalancesMap>({});
  const [isUnfunded, setIsUnfunded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setError(null);
    try {
      const api = await import("@stellar/freighter-api");
      const conn = await api.isConnected();
      if (!conn.isConnected) {
        setError(t("notDetected"));
        return;
      }
      const res = await api.requestAccess();
      if (res.error || !res.address) {
        setError(t("declined"));
        return;
      }
      setAddress(res.address);
    } catch {
      setError(t("unreachable"));
    }
  }, [t]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setBalance(null);
    setBalances({});
    setIsUnfunded(false);
  }, []);

  const refreshBalances = useCallback(async () => {
    if (!address) return;
    try {
      const result = await getAccountBalances(address, config.horizon);
      if (result.isUnfunded) {
        setIsUnfunded(true);
        setBalances({});
        setBalance(t("unfunded"));
      } else {
        setIsUnfunded(false);
        setBalances(result.balances);
        const nativeBal = result.balances["native"]?.available;
        setBalance(nativeBal ? Number(nativeBal).toFixed(2) : "0.00");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load account balances");
    }
  }, [address, t]);

  useEffect(() => {
    if (!address) {
      setBalance(null);
      setBalances({});
      setIsUnfunded(false);
      return;
    }
    refreshBalances();
  }, [address, refreshBalances]);

  // Poll at most every 30s while document is visible
  useEffect(() => {
    if (!address) return;
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        refreshBalances();
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [address, refreshBalances]);

  const addTrustline = useCallback(
    async (asset: { code: string; issuer: string }) => {
      if (!address) throw new Error("No wallet connected");
      const res = await horizonAddTrustline({
        address,
        asset,
        horizonUrl: config.horizon,
        networkPassphrase: config.networkPassphrase,
      });
      await refreshBalances();
      return res;
    },
    [address, refreshBalances]
  );

  return (
    <WalletCtx.Provider
      value={{
        address,
        balance,
        balances,
        isUnfunded,
        error,
        connect,
        disconnect,
        refreshBalances,
        addTrustline,
      }}
    >
      {children}
    </WalletCtx.Provider>
  );
}

export function ConnectButton() {
  const { address, connect, disconnect } = useWallet();
  const t = useTranslations("market");

  if (address) {
    return (
      <button className="btn-ghost text-sm" onClick={disconnect} title={t("disconnect")}>
        {address.slice(0, 4)}...{address.slice(-4)}
      </button>
    );
  }

  return (
    <button className="btn whitespace-nowrap text-xs sm:text-sm" onClick={connect}>
      {t("connectFreighter")}
    </button>
  );
}
