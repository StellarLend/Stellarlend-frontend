"use client";

import React, { createContext, useContext, useState, useEffect, FC,ReactNode } from "react";
import { useWalletConnection, type WalletStatus, type StellarNetwork } from "@hooks/useWalletConnection";

export type { WalletStatus };
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
  const {
    address,
    network,
    status,
    error,
    connect,
    disconnect,
  } = useWalletConnection();

  const [accounts, setAccounts] = useState<string[]>([]);
  const [activeAccount, setActiveAccount] = useState<string | null>(null);

  // Sync the account list with the connected address exposed by the hook.
  useEffect(() => {
    if (!address) {
      setAccounts([]);
      setActiveAccount(null);
      sessionStorage.removeItem(ACCOUNTS_STORAGE_KEY);
      sessionStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
      return;
    }

    const storedAccounts = readStoredAccounts();
    const resolvedAccounts = storedAccounts.includes(address)
      ? storedAccounts
      : [address];
    setAccounts(resolvedAccounts);
    setActiveAccount(address);
    sessionStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(resolvedAccounts));
    sessionStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, address);
  }, [address]);

  // Switch the active account among already-known accounts.
  // Triggers downstream data refresh (positions, balances) by updating
  // `address`, since existing consumers key their fetch effects off it.
  const switchAccount = async (nextAddress: string) => {
    if (!nextAddress || !accounts.includes(nextAddress)) {
      return;
    }

    if (nextAddress === activeAccount) {
      return;
    }

    setActiveAccount(nextAddress);
    sessionStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, nextAddress);
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
