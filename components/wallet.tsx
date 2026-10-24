"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { QueryClientContext, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { config, getExpectedNetworkPassphrase, isNetworkMismatch, NetworkMismatchError } from "@/lib/config";
import { reportError } from "@/lib/report-error";
import { qk } from "@/lib/query-keys";
import { fundWithFriendbot, pollUntilFunded } from "@/lib/friendbot";
import {
  addTrustline as horizonAddTrustline,
  parseAccountBalances,
  type AccountBalancesMap,
} from "@/lib/horizon";
import { QueryProvider } from "./query-provider";
import { WalletAdapter, SignTransactionOptions, getWalletAdapter } from "@/lib/wallets";
import { WalletPickerModal } from "./wallet-picker";

export type AccountStatus = "unknown" | "unfunded" | "funded" | "error";

export const LAST_WALLET_STORAGE_KEY = "stellarlend:last_wallet_id";
export const AUTOCONNECT_STORAGE_KEY = "stellarlend.wallet.autoconnect";

export function getAutoConnectFlag(): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    return window.localStorage.getItem(AUTOCONNECT_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setAutoConnectFlag(enabled: boolean): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    if (enabled) {
      window.localStorage.setItem(AUTOCONNECT_STORAGE_KEY, "true");
    } else {
      window.localStorage.removeItem(AUTOCONNECT_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failure (e.g. Safari private browsing restrictions)
  }
}

/** Reads the current Freighter network; returns null when unavailable. */
async function readFreighterNetwork(): Promise<{ network: string | null; networkPassphrase: string | null } | null> {
  try {
    const api = await import("@stellar/freighter-api");
    const net = await api.getNetwork();
    if (!net || net.error) return null;
    return { network: net.network ?? null, networkPassphrase: net.networkPassphrase ?? null };
  } catch {
    return null;
  }
}

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
  invalidateBalance: () => Promise<void>;
  accountStatus: AccountStatus;
  isFunding: boolean;
  fundError: string | null;
  fundAccount: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  /** All Horizon balances keyed by "native" or "CODE:ISSUER" (see lib/horizon). */
  balances: AccountBalancesMap;
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
  invalidateBalance: async () => {},
  accountStatus: "unknown",
  isFunding: false,
  fundError: null,
  fundAccount: async () => {},
  refreshBalance: async () => {},
  balances: {},
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

interface WalletProviderProps {
  children: React.ReactNode;
  initialAdapter?: WalletAdapter;
}

/**
 * Provides wallet state. Balances are fetched through the shared React Query
 * cache; if no QueryClientProvider is mounted above (e.g. isolated tests),
 * a local one is created so the provider still works standalone.
 */
export function WalletProvider(props: WalletProviderProps) {
  const existingClient = useContext(QueryClientContext);
  if (existingClient) return <WalletProviderInner {...props} />;
  return (
    <QueryProvider>
      <WalletProviderInner {...props} />
    </QueryProvider>
  );
}

function WalletProviderInner({ children, initialAdapter }: WalletProviderProps) {
  const t = useTranslations("wallet");
  const queryClient = useQueryClient();
  const [address, setAddress] = useState<string | null>(null);
  const [isFunding, setIsFunding] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);
  const fundAbortRef = useRef<AbortController | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [networkPassphrase, setNetworkPassphrase] = useState<string | null>(null);
  const expectedPassphrase = getExpectedNetworkPassphrase();
  const networkMismatch = isNetworkMismatch(networkPassphrase, expectedPassphrase);
  const lastFundAttemptRef = useRef<number>(0);
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
        setAutoConnectFlag(true);
        if (targetAdapter.id === "freighter") {
          const net = await readFreighterNetwork();
          if (net) {
            setNetwork(net.network);
            setNetworkPassphrase(net.networkPassphrase);
          }
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
    if (address) {
      // Clear cached data for the disconnected address to avoid leaking data across accounts
      queryClient.removeQueries({ queryKey: qk.account(address) });
    }
    fundAbortRef.current?.abort();
    setIsFunding(false);
    setFundError(null);
    setAutoConnectFlag(false);
    setNetwork(null);
    setNetworkPassphrase(null);
    setAddress(null);
    setAdapter(null);
    setActiveWalletId(null);
  }, [adapter, address, queryClient]);

  const assertCanSign = useCallback(() => {
    if (networkMismatch) {
      throw new NetworkMismatchError(networkPassphrase ?? "unknown", expectedPassphrase);
    }
  }, [networkMismatch, networkPassphrase, expectedPassphrase]);

  // Restore a Freighter session on mount if autoconnect is enabled and the site is still allowed.
  useEffect(() => {
    let active = true;
    async function restoreSession() {
      if (!getAutoConnectFlag()) return;
      let lastId: string | null = null;
      try {
        lastId = localStorage.getItem(LAST_WALLET_STORAGE_KEY);
      } catch {
        // ignore storage errors
      }
      if (lastId && lastId !== "freighter") return;
      try {
        const api = await import("@stellar/freighter-api");
        const conn = await api.isConnected();
        if (!active || !conn.isConnected) return;
        const allowed = await api.isAllowed();
        if (!active || !allowed.isAllowed) return;
        const res = await api.getAddress();
        if (!active || res.error || !res.address) return;
        const freighter = await getWalletAdapter("freighter");
        if (!active) return;
        if (freighter) {
          setAdapter(freighter);
          setActiveWalletId(freighter.id);
        }
        setAddress(res.address);
        const net = await readFreighterNetwork();
        if (active && net) {
          setNetwork(net.network);
          setNetworkPassphrase(net.networkPassphrase);
        }
      } catch {
        // Freighter not available or lookup failed, ignore gracefully
      }
    }
    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  // Watch Freighter for account / network changes while it is the active wallet.
  useEffect(() => {
    if (activeWalletId !== "freighter") return;
    let watcher: { stop: () => void } | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const api = await import("@stellar/freighter-api");
        if (cancelled || typeof api.WatchWalletChanges !== "function") return;
        const instance = new api.WatchWalletChanges();
        watcher = instance;
        instance.watch((params) => {
          if (cancelled || params.error) return;
          if (params.address !== undefined) {
            setAddress((prev) => (prev !== params.address ? params.address || null : prev));
          }
          if (params.network !== undefined) setNetwork(params.network || null);
          if (params.networkPassphrase !== undefined) setNetworkPassphrase(params.networkPassphrase || null);
        });
      } catch {
        // Freighter watcher not available
      }
    })();
    return () => {
      cancelled = true;
      watcher?.stop();
    };
  }, [activeWalletId]);

  const signTransaction = useCallback(
    async (xdr: string, options?: SignTransactionOptions) => {
      if (!adapter) {
        throw new Error("No wallet connected to sign transaction.");
      }
      assertCanSign();
      return adapter.signTransaction(xdr, {
        networkPassphrase: options?.networkPassphrase ?? config.networkPassphrase,
        accountToSign: options?.accountToSign ?? address ?? undefined,
      });
    },
    [adapter, address, assertCanSign]
  );

  const { data: account = null, isError: balanceError } = useQuery<{ balance: string; status: AccountStatus; balances: AccountBalancesMap } | null>({
    queryKey: qk.accountBalance(address),
    queryFn: async ({ signal }) => {
      if (!address) return null;
      try {
        const res = await fetch(`${config.horizon}/accounts/${address}`, { signal });
        if (res.status === 404) {
          return { balance: t("unfunded"), status: "unfunded", balances: {} };
        }
        if (!res.ok) {
          throw new Error(`Horizon error: ${res.status}`);
        }
        const accountData = await res.json();
        const nativeBalance = accountData?.balances?.find(
          (b: { asset_type: string }) => b.asset_type === "native"
        );
        const balances = parseAccountBalances(accountData);
        return nativeBalance
          ? { balance: Number(nativeBalance.balance).toFixed(2), status: "funded", balances }
          : { balance: t("unfunded"), status: "unfunded", balances };
      } catch (err) {
        if (!signal?.aborted) reportError(err, { context: "wallet:fetchBalance", address });
        throw err;
      }
    },
    enabled: Boolean(address),
    staleTime: 15_000,
    // Poll at most every 30s while the document is visible
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const balances: AccountBalancesMap = account?.balances ?? {};
  const isUnfunded = Boolean(address) && account?.status === "unfunded";

  const balance = account?.balance ?? null;
  const accountStatus: AccountStatus = !address
    ? "unknown"
    : balanceError
      ? "error"
      : account?.status ?? "unknown";

  const invalidateBalance = useCallback(async () => {
    if (!address) return;
    await queryClient.invalidateQueries({ queryKey: qk.accountBalance(address) });
  }, [address, queryClient]);

  const addTrustline = useCallback(
    async (asset: { code: string; issuer: string }) => {
      if (!address) throw new Error("No wallet connected");
      const res = await horizonAddTrustline({
        address,
        asset,
        horizonUrl: config.horizon,
        networkPassphrase: config.networkPassphrase,
      });
      await invalidateBalance();
      return res;
    },
    [address, invalidateBalance]
  );

  const fundAccount = useCallback(async () => {
    if (!address || config.network !== "testnet" || isFunding) return;

    // Rate-limit: one Friendbot request per 30s
    const now = Date.now();
    if (now - lastFundAttemptRef.current < 30000) {
      const remainingSec = Math.ceil((30000 - (now - lastFundAttemptRef.current)) / 1000);
      setFundError(t("fundCooldown", { seconds: remainingSec }));
      return;
    }

    lastFundAttemptRef.current = now;
    setIsFunding(true);
    setFundError(null);

    fundAbortRef.current?.abort();
    const controller = new AbortController();
    fundAbortRef.current = controller;

    try {
      const result = await fundWithFriendbot(address, { signal: controller.signal });
      if (!result.ok) {
        setFundError(result.message || t("fundFailed"));
        return;
      }

      // Poll Horizon until the account is funded (max ~20s)
      const funded = await pollUntilFunded(address, {
        signal: controller.signal,
        maxWaitMs: 20000,
        intervalMs: 1500,
      });

      if (funded) {
        await invalidateBalance();
      } else {
        setFundError(t("fundTimeout"));
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setFundError(err instanceof Error ? err.message : t("fundFailed"));
    } finally {
      setIsFunding(false);
    }
  }, [address, isFunding, t, invalidateBalance]);

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
        invalidateBalance,
        accountStatus,
        isFunding,
        fundError,
        fundAccount,
        refreshBalance: invalidateBalance,
        balances,
        isUnfunded,
        refreshBalances: invalidateBalance,
        addTrustline,
        network,
        networkPassphrase,
        networkMismatch,
        expectedPassphrase,
        assertCanSign,
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
  const { address, balance, accountStatus, isFunding, fundAccount, openPicker, disconnect } = useWallet();
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
    <button className="btn whitespace-nowrap text-xs sm:text-sm" onClick={openPicker}>
      {t("connectFreighter")}
    </button>
  );
}
