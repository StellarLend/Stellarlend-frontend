"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { config } from "@/lib/config";
import { fundWithFriendbot, pollUntilFunded } from "@/lib/friendbot";

export type AccountStatus = "unknown" | "unfunded" | "funded" | "error";

export type WalletCtxType = {
  address: string | null;
  balance: string | null;
  error: string | null;
  accountStatus: AccountStatus;
  isFunding: boolean;
  fundError: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  fundAccount: () => Promise<void>;
  refreshBalance: () => Promise<void>;
};

const WalletCtx = createContext<WalletCtxType>({
  address: null,
  balance: null,
  error: null,
  accountStatus: "unknown",
  isFunding: false,
  fundError: null,
  connect: async () => {},
  disconnect: () => {},
  fundAccount: async () => {},
  refreshBalance: async () => {},
});

export const useWallet = () => useContext(WalletCtx);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("wallet");
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accountStatus, setAccountStatus] = useState<AccountStatus>("unknown");
  const [isFunding, setIsFunding] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFundAttemptRef = useRef<number>(0);

  const fetchBalance = useCallback(
    async (targetAddress: string, signal?: AbortSignal) => {
      try {
        const res = await fetch(`${config.horizon}/accounts/${targetAddress}`, { signal });
        if (res.status === 404) {
          setAccountStatus("unfunded");
          setBalance(t("unfunded"));
          return;
        }
        if (!res.ok) {
          setAccountStatus("error");
          setBalance(null);
          return;
        }
        const data = await res.json();
        const native = data?.balances?.find((b: { asset_type: string }) => b.asset_type === "native");
        if (native && Number(native.balance) >= 0) {
          setBalance(Number(native.balance).toFixed(2));
          setAccountStatus("funded");
        } else {
          setAccountStatus("unfunded");
          setBalance(t("unfunded"));
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setAccountStatus("error");
        setBalance(null);
      }
    },
    [t]
  );

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    await fetchBalance(address);
  }, [address, fetchBalance]);

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
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setAddress(null);
    setBalance(null);
    setAccountStatus("unknown");
    setIsFunding(false);
    setFundError(null);
  }, []);

  const fundAccount = useCallback(async () => {
    if (!address || config.network !== "testnet" || isFunding) return;

    // Rate-limit check: one request per 30s
    const now = Date.now();
    if (now - lastFundAttemptRef.current < 30000) {
      const remainingSec = Math.ceil((30000 - (now - lastFundAttemptRef.current)) / 1000);
      setFundError(t("fundCooldown", { seconds: remainingSec }));
      return;
    }

    lastFundAttemptRef.current = now;
    setIsFunding(true);
    setFundError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await fundWithFriendbot(address, { signal: controller.signal });
      if (!result.ok) {
        setFundError(result.message || t("fundFailed"));
        setIsFunding(false);
        return;
      }

      // Poll Horizon until account is funded (max ~20s)
      const funded = await pollUntilFunded(address, {
        signal: controller.signal,
        maxWaitMs: 20000,
        intervalMs: 1500,
      });

      if (funded) {
        await fetchBalance(address, controller.signal);
      } else {
        setFundError(t("fundTimeout"));
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setFundError(err instanceof Error ? err.message : t("fundFailed"));
    } finally {
      setIsFunding(false);
    }
  }, [address, isFunding, t, fetchBalance]);

  useEffect(() => {
    if (!address) {
      setAccountStatus("unknown");
      setBalance(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    fetchBalance(address, controller.signal);

    return () => {
      controller.abort();
    };
  }, [address, fetchBalance]);

  return (
    <WalletCtx.Provider
      value={{
        address,
        balance,
        error,
        accountStatus,
        isFunding,
        fundError,
        connect,
        disconnect,
        fundAccount,
        refreshBalance,
      }}
    >
      {children}
    </WalletCtx.Provider>
  );
}

export function ConnectButton() {
  const { address, balance, accountStatus, isFunding, fundAccount, connect, disconnect } = useWallet();
  const t = useTranslations("market");
  const tw = useTranslations("wallet");

  if (address) {
    return (
      <div className="flex items-center gap-2">
        {config.network === "testnet" && accountStatus === "unfunded" && (
          <button
            className="btn text-xs py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded"
            onClick={fundAccount}
            disabled={isFunding}
            title={tw("fundTooltip")}
          >
            {isFunding ? tw("funding") : tw("fundWithFriendbot")}
          </button>
        )}
        <button className="btn-ghost text-sm" onClick={disconnect} title={t("disconnect")}>
          {address.slice(0, 4)}...{address.slice(-4)}
          {balance ? ` (${balance} XLM)` : ""}
        </button>
      </div>
    );
  }

  return (
    <button className="btn whitespace-nowrap text-xs sm:text-sm" onClick={connect}>
      {t("connectFreighter")}
    </button>
  );
}
