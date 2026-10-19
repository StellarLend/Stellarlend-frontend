"use client";
import React, { createContext, useCallback, useContext, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { config } from "@/lib/config";
import { qk } from "@/lib/query-keys";

type Ctx = {
  address: string | null;
  balance: string | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  invalidateBalance: () => Promise<void>;
};

const WalletCtx = createContext<Ctx>({
  address: null,
  balance: null,
  error: null,
  connect: async () => {},
  disconnect: () => {},
  invalidateBalance: async () => {},
});

export const useWallet = () => useContext(WalletCtx);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("wallet");
  const queryClient = useQueryClient();
  const [address, setAddress] = useState<string | null>(null);
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
    if (address) {
      // Clear cached data for the disconnected address to avoid leaking data across accounts
      queryClient.removeQueries({ queryKey: qk.account(address) });
    }
    setAddress(null);
  }, [address, queryClient]);

  const { data: balance = null } = useQuery({
    queryKey: qk.accountBalance(address),
    queryFn: async ({ signal }) => {
      if (!address) return null;
      const res = await fetch(`${config.horizon}/accounts/${address}`, { signal });
      if (res.status === 404) {
        return t("unfunded");
      }
      if (!res.ok) {
        throw new Error(`Horizon error: ${res.status}`);
      }
      const accountData = await res.json();
      const nativeBalance = accountData?.balances?.find(
        (b: { asset_type: string }) => b.asset_type === "native"
      );
      return nativeBalance ? Number(nativeBalance.balance).toFixed(2) : t("unfunded");
    },
    enabled: Boolean(address),
    staleTime: 15_000,
  });

  const invalidateBalance = useCallback(async () => {
    if (!address) return;
    await queryClient.invalidateQueries({ queryKey: qk.accountBalance(address) });
  }, [address, queryClient]);

  return (
    <WalletCtx.Provider
      value={{
        address,
        balance,
        error,
        connect,
        disconnect,
        invalidateBalance,
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
