"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { config } from "@/lib/config";
import { WalletAdapter, SignTransactionOptions, getWalletAdapter } from "@/lib/wallets";
import { WalletPickerModal } from "./wallet-picker";

export const LAST_WALLET_STORAGE_KEY = "stellarlend:last_wallet_id";

type Ctx = {
  address: string | null;
  balance: string | null;
  error: string | null;
  activeWalletId: string | null;
  isPickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
  connect: (walletId?: string) => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string, options?: SignTransactionOptions) => Promise<string>;
};

const WalletCtx = createContext<Ctx>({
  address: null,
  balance: null,
  error: null,
  activeWalletId: null,
  isPickerOpen: false,
  openPicker: () => {},
  closePicker: () => {},
  connect: async () => {},
  disconnect: () => {},
  signTransaction: async () => "",
});

export const useWallet = () => useContext(WalletCtx);

interface WalletProviderProps {
  children: React.ReactNode;
  initialAdapter?: WalletAdapter;
}

export function WalletProvider({ children, initialAdapter }: WalletProviderProps) {
  const t = useTranslations("wallet");
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeWalletId, setActiveWalletId] = useState<string | null>(initialAdapter?.id ?? null);
  const [adapter, setAdapter] = useState<WalletAdapter | null>(initialAdapter ?? null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [lastWalletId, setLastWalletId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_WALLET_STORAGE_KEY);
      if (stored) {
        setLastWalletId(stored);
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const openPicker = useCallback(() => setIsPickerOpen(true), []);
  const closePicker = useCallback(() => setIsPickerOpen(false), []);

  const connect = useCallback(
    async (walletId?: string) => {
      setError(null);
      let targetAdapter: WalletAdapter | null = adapter;

      if (!targetAdapter || (walletId && targetAdapter.id !== walletId)) {
        const idToLoad = walletId || lastWalletId || "freighter";
        if (initialAdapter && initialAdapter.id === idToLoad) {
          targetAdapter = initialAdapter;
        } else {
          targetAdapter = await getWalletAdapter(idToLoad);
        }
      }

      if (!targetAdapter) {
        setError(t("notDetected"));
        throw new Error(t("notDetected"));
      }

      try {
        const addr = await targetAdapter.connect();
        if (!addr) {
          setError(t("declined"));
          return;
        }
        setAddress(addr);
        setAdapter(targetAdapter);
        setActiveWalletId(targetAdapter.id);
        setLastWalletId(targetAdapter.id);
        try {
          localStorage.setItem(LAST_WALLET_STORAGE_KEY, targetAdapter.id);
        } catch {
          // Ignore storage write errors
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const lower = msg.toLowerCase();
        // If user rejected / cancelled, do not trigger error banner
        const isUserCancellation =
          lower.includes("cancel") ||
          lower.includes("reject") ||
          lower.includes("declined") ||
          lower.includes("closed");

        if (!isUserCancellation) {
          setError(msg || t("unreachable"));
        }
        throw err;
      }
    },
    [adapter, initialAdapter, lastWalletId, t]
  );

  const disconnect = useCallback(() => {
    if (adapter?.disconnect) {
      adapter.disconnect().catch(() => {});
    }
    setAddress(null);
    setBalance(null);
    setAdapter(null);
    setActiveWalletId(null);
  }, [adapter]);

  const signTransaction = useCallback(
    async (xdr: string, options?: SignTransactionOptions) => {
      if (!adapter) {
        throw new Error("No wallet connected to sign transaction.");
      }
      return adapter.signTransaction(xdr, {
        networkPassphrase: options?.networkPassphrase ?? config.networkPassphrase,
        accountToSign: options?.accountToSign ?? address ?? undefined,
      });
    },
    [adapter, address]
  );

  useEffect(() => {
    if (!address) return;
    let live = true;
    fetch(`${config.horizon}/accounts/${address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => {
        if (!live) return;
        const x = a?.balances?.find((b: { asset_type: string }) => b.asset_type === "native");
        setBalance(x ? Number(x.balance).toFixed(2) : t("unfunded"));
      })
      .catch(() => live && setBalance(null));
    return () => {
      live = false;
    };
  }, [address, t]);

  return (
    <WalletCtx.Provider
      value={{
        address,
        balance,
        error,
        activeWalletId,
        isPickerOpen,
        openPicker,
        closePicker,
        connect,
        disconnect,
        signTransaction,
      }}
    >
      {children}
      <WalletPickerModal
        isOpen={isPickerOpen}
        onClose={closePicker}
        onSelectWallet={async (id) => {
          await connect(id);
        }}
        lastWalletId={lastWalletId}
      />
    </WalletCtx.Provider>
  );
}

export function ConnectButton() {
  const { address, openPicker, disconnect } = useWallet();
  const t = useTranslations("market");

  if (address) {
    return (
      <button className="btn-ghost text-sm" onClick={disconnect} title={t("disconnect")}>
        {address.slice(0, 4)}...{address.slice(-4)}
      </button>
    );
  }

  return (
    <button className="btn whitespace-nowrap text-xs sm:text-sm" onClick={openPicker}>
      {t("connectFreighter")}
    </button>
  );
}
