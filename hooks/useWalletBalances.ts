"use client";
import { useState, useEffect } from "react";
import { useWallet } from "./useWallet";
import { fetchWalletBalances } from "@/lib/wallet/balances";
import { ASSETS, type AssetInfo } from "@/lib/assets";

export interface UseWalletBalancesResult {
  assetsWithBalances: AssetInfo[];
  loading: boolean;
  error: string | null;
}

export function useWalletBalances(): UseWalletBalancesResult {
  const { address, status } = useWallet();
  const [liveBalances, setLiveBalances] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = status === "connected";

  useEffect(() => {
    if (!isConnected || !address) {
      setLiveBalances(new Map());
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchWalletBalances(address)
      .then((balances) => {
        if (cancelled) return;
        const map = new Map<string, number>();
        for (const b of balances) {
          map.set(b.symbol, b.amount);
        }
        setLiveBalances(map);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setLiveBalances(new Map());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address, isConnected]);

  const assetsWithBalances: AssetInfo[] = ASSETS.map((asset) => {
    const liveBalance = liveBalances.get(asset.symbol);
    if (liveBalance !== undefined) {
      return { ...asset, balance: liveBalance };
    }
    if (isConnected && address) {
      return { ...asset, balance: 0 };
    }
    return asset;
  });

  return { assetsWithBalances, loading, error };
}
