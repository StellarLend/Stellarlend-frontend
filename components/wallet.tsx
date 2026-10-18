"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { config } from "@/lib/config";

type Ctx = { address: string | null; balance: string | null; error: string | null; connect: () => Promise<void>; disconnect: () => void };
const WalletCtx = createContext<Ctx>({ address: null, balance: null, error: null, connect: async () => {}, disconnect: () => {} });
export const useWallet = () => useContext(WalletCtx);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setError(null);
    try {
      const api = await import("@stellar/freighter-api");
      const conn = await api.isConnected();
      if (!conn.isConnected) { setError("Freighter wallet not detected. Install it from freighter.app, or keep browsing in demo mode."); return; }
      const res = await api.requestAccess();
      if (res.error || !res.address) { setError("Wallet connection was declined."); return; }
      setAddress(res.address);
    } catch {
      setError("Could not reach Freighter. Continue in demo mode.");
    }
  }, []);
  const disconnect = () => { setAddress(null); setBalance(null); };

  useEffect(() => {
    if (!address) return;
    let live = true;
    fetch(`${config.horizon}/accounts/${address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => {
        if (!live) return;
        const x = a?.balances?.find((b: { asset_type: string }) => b.asset_type === "native");
        setBalance(x ? Number(x.balance).toFixed(2) : "0.00 (unfunded on testnet)");
      })
      .catch(() => live && setBalance(null));
    return () => { live = false; };
  }, [address]);

  return <WalletCtx.Provider value={{ address, balance, error, connect, disconnect }}>{children}</WalletCtx.Provider>;
}

export function ConnectButton() {
  const { address, connect, disconnect } = useWallet();
  if (address) return (
    <button className="btn-ghost text-sm" onClick={disconnect} title="Disconnect">{address.slice(0, 4)}...{address.slice(-4)}</button>
  );
  return <button className="btn whitespace-nowrap text-xs sm:text-sm" onClick={connect}>Connect<span className="hidden sm:inline">&nbsp;Freighter</span></button>;
}
