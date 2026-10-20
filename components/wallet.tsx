"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  isConnected as freighterIsConnected,
  isAllowed as freighterIsAllowed,
  getAddress as freighterGetAddress,
  requestAccess as freighterRequestAccess,
  getNetwork as freighterGetNetwork,
  WatchWalletChanges,
} from "@stellar/freighter-api";
import { config, getExpectedNetworkPassphrase, isNetworkMismatch, NetworkMismatchError } from "@/lib/config";

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

type Ctx = {
  address: string | null;
  balance: string | null;
  error: string | null;
  network: string | null;
  networkPassphrase: string | null;
  networkMismatch: boolean;
  expectedPassphrase: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  assertCanSign: () => void;
};

const WalletCtx = createContext<Ctx>({
  address: null,
  balance: null,
  error: null,
  network: null,
  networkPassphrase: null,
  networkMismatch: false,
  expectedPassphrase: getExpectedNetworkPassphrase(),
  connect: async () => {},
  disconnect: () => {},
  assertCanSign: () => {},
});

export const useWallet = () => useContext(WalletCtx);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("wallet");
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [networkPassphrase, setNetworkPassphrase] = useState<string | null>(null);

  const addressRef = useRef<string | null>(address);
  addressRef.current = address;

  const expectedPassphrase = getExpectedNetworkPassphrase();
  const networkMismatch = isNetworkMismatch(networkPassphrase, expectedPassphrase);

  const fetchBalanceForAddress = useCallback(
    (targetAddress: string) => {
      let live = true;
      fetch(`${config.horizon}/accounts/${targetAddress}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((a) => {
          if (!live) return;
          // Guard: ensure targetAddress is still the active address
          if (addressRef.current !== targetAddress) return;
          const x = a?.balances?.find((b: { asset_type: string }) => b.asset_type === "native");
          setBalance(x ? Number(x.balance).toFixed(2) : t("unfunded"));
        })
        .catch(() => {
          if (live && addressRef.current === targetAddress) {
            setBalance(null);
          }
        });
      return () => {
        live = false;
      };
    },
    [t]
  );

  const connect = useCallback(async () => {
    setError(null);
    try {
      const conn = await freighterIsConnected();
      if (!conn.isConnected) {
        setError(t("notDetected"));
        return;
      }
      const res = await freighterRequestAccess();
      if (res.error || !res.address) {
        setError(t("declined"));
        return;
      }
      setAddress(res.address);
      setAutoConnectFlag(true);

      try {
        const net = await freighterGetNetwork();
        if (net && !net.error) {
          setNetwork(net.network ?? null);
          setNetworkPassphrase(net.networkPassphrase ?? null);
        }
      } catch {
        // Non-blocking network query failure
      }
    } catch {
      setError(t("unreachable"));
    }
  }, [t]);

  const disconnect = useCallback(() => {
    setAutoConnectFlag(false);
    setAddress(null);
    setBalance(null);
    setNetwork(null);
    setNetworkPassphrase(null);
    setError(null);
  }, []);

  const assertCanSign = useCallback(() => {
    if (networkMismatch) {
      throw new NetworkMismatchError(networkPassphrase ?? "unknown", expectedPassphrase);
    }
  }, [networkMismatch, networkPassphrase, expectedPassphrase]);

  // Restore session on mount if autoconnect is enabled and user isAllowed()
  useEffect(() => {
    let active = true;

    async function restoreSession() {
      if (!getAutoConnectFlag()) return;

      try {
        const conn = await freighterIsConnected();
        if (!active || !conn.isConnected) return;

        const allowed = await freighterIsAllowed();
        if (!active || !allowed.isAllowed) return;

        const res = await freighterGetAddress();
        if (!active || res.error || !res.address) return;

        setAddress(res.address);

        try {
          const net = await freighterGetNetwork();
          if (active && net && !net.error) {
            setNetwork(net.network ?? null);
            setNetworkPassphrase(net.networkPassphrase ?? null);
          }
        } catch {
          // ignore error fetching network
        }
      } catch {
        // Freighter not available or lookup failed, ignore gracefully
      }
    }

    restoreSession();

    return () => {
      active = false;
    };
  }, []);

  // Balance fetching effect on address change
  useEffect(() => {
    if (!address) {
      setBalance(null);
      return;
    }
    const cancel = fetchBalanceForAddress(address);
    return () => {
      cancel();
    };
  }, [address, fetchBalanceForAddress]);

  // Watch wallet changes (address, network, networkPassphrase)
  useEffect(() => {
    let watcher: { stop: () => void } | null = null;
    let isCancelled = false;

    try {
      if (typeof WatchWalletChanges === "function") {
        const instance = new WatchWalletChanges();
        watcher = instance;

        instance.watch((params) => {
          if (isCancelled) return;
          if (params.error) return;

          if (params.address !== undefined) {
            setAddress((prev) => {
              if (prev !== params.address) {
                return params.address || null;
              }
              return prev;
            });
          }

          if (params.network !== undefined) {
            setNetwork(params.network || null);
          }

          if (params.networkPassphrase !== undefined) {
            setNetworkPassphrase(params.networkPassphrase || null);
          }
        });
      }
    } catch {
      // Freighter watcher not available
    }

    return () => {
      isCancelled = true;
      if (watcher && typeof watcher.stop === "function") {
        watcher.stop();
      }
    };
  }, []);

  return (
    <WalletCtx.Provider
      value={{
        address,
        balance,
        error,
        network,
        networkPassphrase,
        networkMismatch,
        expectedPassphrase,
        connect,
        disconnect,
        assertCanSign,
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
