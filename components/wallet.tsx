"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { config } from "@/lib/config";
import { reportError } from "@/lib/report-error";

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
    if (!address) return;
    let live = true;
    fetch(`${config.horizon}/accounts/${address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => {
        if (!live) return;
        const x = a?.balances?.find((b: { asset_type: string }) => b.asset_type === "native");
        setBalance(x ? Number(x.balance).toFixed(2) : t("unfunded"));
      })
      .catch((err) => {
        reportError(err, { context: "wallet:fetchBalance", address });
        if (live) setBalance(null);
      });
    return () => { live = false; };
  }, [address, t]);

  return <WalletCtx.Provider value={{ address, balance, error, connect, disconnect }}>{children}</WalletCtx.Provider>;
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
