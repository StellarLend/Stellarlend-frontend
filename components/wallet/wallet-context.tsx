"use client";
import { createContext, useContext } from "react";
import { getExpectedNetworkPassphrase } from "@/lib/config";
import type { SignTransactionOptions } from "@/lib/wallets";
import type { AccountBalancesMap, HorizonAccount } from "@/lib/horizon";

export type AccountStatus = "unknown" | "unfunded" | "funded" | "error";

export type WalletCtxValue = {
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
  invalidateBalance: () => Promise<void>;
  accountStatus: AccountStatus;
  isFunding: boolean;
  fundError: string | null;
  fundAccount: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  /** All Horizon balances keyed by "native" or "CODE:ISSUER" (see lib/horizon). */
  balances: AccountBalancesMap;
  /** Raw Horizon account payload, used for reserve (calculateMinReserve) checks. */
  rawAccount: HorizonAccount | null;
  isUnfunded: boolean;
  refreshBalances: () => Promise<void>;
  addTrustline: (asset: { code: string; issuer: string }) => Promise<{ hash: string }>;
  /** Wallet network as reported by Freighter (null for other wallets / unknown). */
  network: string | null;
  networkPassphrase: string | null;
  networkMismatch: boolean;
  expectedPassphrase: string;
  /** Throws NetworkMismatchError when the wallet is on a different network than the app. */
  assertCanSign: () => void;
};

export const WalletCtx = createContext<WalletCtxValue>({
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
  invalidateBalance: async () => {},
  accountStatus: "unknown",
  isFunding: false,
  fundError: null,
  fundAccount: async () => {},
  refreshBalance: async () => {},
  balances: {},
  rawAccount: null,
  isUnfunded: false,
  refreshBalances: async () => {},
  addTrustline: async () => ({ hash: "" }),
  network: null,
  networkPassphrase: null,
  networkMismatch: false,
  expectedPassphrase: getExpectedNetworkPassphrase(),
  assertCanSign: () => {},
});

export const useWallet = () => useContext(WalletCtx);
