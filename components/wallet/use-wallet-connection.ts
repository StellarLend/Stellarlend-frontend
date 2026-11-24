"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getWalletAdapter,
  normalizeWalletError,
  type WalletAdapter,
  type WalletErrorCode,
} from "@/lib/wallets";
import { getExpectedNetworkPassphrase, isNetworkMismatch, NetworkMismatchError } from "@/lib/config";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { useTranslations } from "next-intl";
import {
  LAST_WALLET_STORAGE_KEY,
  getAutoConnectFlag,
  setAutoConnectFlag,
} from "./constants";

/** Reads the current Freighter network; returns null when unavailable. */
export async function readFreighterNetwork(): Promise<{
  network: string | null;
  networkPassphrase: string | null;
} | null> {
  try {
    const api = await import("@stellar/freighter-api");
    const net = await api.getNetwork();
    if (!net || net.error) return null;
    return { network: net.network ?? null, networkPassphrase: net.networkPassphrase ?? null };
  } catch {
    return null;
  }
}

export interface UseWalletConnectionOptions {
  initialAdapter?: WalletAdapter;
}

export interface UseWalletConnectionResult {
  address: string | null;
  addressRef: React.MutableRefObject<string | null>;
  error: string | null;
  activeWalletId: string | null;
  adapter: WalletAdapter | null;
  isPickerOpen: boolean;
  lastWalletId: string | null;
  network: string | null;
  networkPassphrase: string | null;
  networkMismatch: boolean;
  expectedPassphrase: string;
  openPicker: () => void;
  closePicker: () => void;
  connect: (walletId?: string) => Promise<void>;
  disconnect: () => void;
  assertCanSign: () => void;
  clearAddressCache: (previous: string | null) => void;
}

export function useWalletConnection({
  initialAdapter,
}: UseWalletConnectionOptions): UseWalletConnectionResult {
  const t = useTranslations("wallet");
  const queryClient = useQueryClient();

  const [address, setAddress] = useState<string | null>(null);
  const addressRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeWalletId, setActiveWalletId] = useState<string | null>(
    initialAdapter?.id ?? null
  );
  const [adapter, setAdapter] = useState<WalletAdapter | null>(initialAdapter ?? null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [lastWalletId, setLastWalletId] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [networkPassphrase, setNetworkPassphrase] = useState<string | null>(null);

  const expectedPassphrase = getExpectedNetworkPassphrase();
  const networkMismatch = isNetworkMismatch(networkPassphrase, expectedPassphrase);

  const clearAddressCache = useCallback(
    (previous: string | null) => {
      if (previous) queryClient.removeQueries({ queryKey: qk.account(previous) });
    },
    [queryClient]
  );

  // Load persisted last wallet id on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_WALLET_STORAGE_KEY);
      if (stored) setLastWalletId(stored);
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
        addressRef.current = addr;
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
        const normalized = normalizeWalletError(err);
        if (normalized.code !== "user_rejected") {
          const localizedMessage: Record<Exclude<WalletErrorCode, "user_rejected">, string> = {
            not_installed: t("errors.not_installed"),
            locked: t("errors.locked"),
            wrong_network: t("errors.wrong_network"),
            unknown: normalized.message || t("errors.unknown"),
          };
          setError(localizedMessage[normalized.code]);
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
      clearAddressCache(address);
    }
    setAutoConnectFlag(false);
    setNetwork(null);
    setNetworkPassphrase(null);
    setAddress(null);
    addressRef.current = null;
    setAdapter(null);
    setActiveWalletId(null);
  }, [adapter, address, clearAddressCache]);

  const assertCanSign = useCallback(() => {
    if (networkMismatch) {
      throw new NetworkMismatchError(networkPassphrase ?? "unknown", expectedPassphrase);
    }
  }, [networkMismatch, networkPassphrase, expectedPassphrase]);

  // Restore a Freighter session on mount if autoconnect is enabled.
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
        addressRef.current = res.address;
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
        instance.watch((params: {
          address?: string | null;
          network?: string | null;
          networkPassphrase?: string | null;
          error?: string | null;
        }) => {
          if (cancelled || params.error) return;
          if (params.address !== undefined) {
            const nextAddress = params.address || null;
            if (addressRef.current !== nextAddress) {
              clearAddressCache(addressRef.current);
              setAddress(nextAddress);
              addressRef.current = nextAddress;
            }
          }
          if (params.network !== undefined) setNetwork(params.network || null);
          if (params.networkPassphrase !== undefined)
            setNetworkPassphrase(params.networkPassphrase || null);
        });
      } catch {
        // Freighter watcher not available
      }
    })();
    return () => {
      cancelled = true;
      watcher?.stop();
    };
  }, [activeWalletId, clearAddressCache]);

  return {
    address,
    addressRef,
    error,
    activeWalletId,
    adapter,
    isPickerOpen,
    lastWalletId,
    network,
    networkPassphrase,
    networkMismatch,
    expectedPassphrase,
    openPicker,
    closePicker,
    connect,
    disconnect,
    assertCanSign,
    clearAddressCache,
  };
}
