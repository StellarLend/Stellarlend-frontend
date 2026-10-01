"use client";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "./useWallet";
import { fetchWalletBalances } from "@/lib/wallet/balances";
import { ASSETS, type AssetInfo } from "@/lib/assets";

export interface UseWalletBalancesResult {
  /** Canonical asset list with the connected wallet's live balances applied. */
  assetsWithBalances: AssetInfo[];
  /** True while a balance request for the active account is in flight. */
  loading: boolean;
  /** Human-readable failure message, or null when the last load succeeded. */
  error: string | null;
  /** Retry the balance fetch without changing the connected account. */
  refetch: () => void;
}

/**
 * Balances are stored together with the account they belong to. Without this
 * pairing, switching accounts would briefly (or, on failure, indefinitely)
 * show account A's balances while account B is active — and the lending forms
 * validate MAX/insufficient-balance against exactly these numbers.
 */
interface BalanceSnapshot {
  address: string | null;
  balances: Map<string, number>;
}

const EMPTY_BALANCES: ReadonlyMap<string, number> = new Map();

function messageFrom(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  // Non-Error rejections (strings, thrown objects) must still be diagnosable
  // without leaking the raw value into the UI.
  return "Unable to load wallet balances.";
}

export function useWalletBalances(): UseWalletBalancesResult {
  const { address, status } = useWallet();
  const [snapshot, setSnapshot] = useState<BalanceSnapshot>({
    address: null,
    balances: new Map(),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const isConnected = status === "connected";

  useEffect(() => {
    if (!isConnected || !address) {
      setSnapshot({ address: null, balances: new Map() });
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
        setSnapshot({ address, balances: map });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(messageFrom(err));
        // Keep the last known balances only when they belong to the same
        // account; a transient Horizon failure must not zero out a funded
        // wallet (or, worse, expose another account's numbers).
        setSnapshot((prev) =>
          prev.address === address
            ? prev
            : { address, balances: new Map() },
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address, isConnected, reloadToken]);

  const refetch = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  // Never apply a snapshot that was produced for a different account.
  const liveBalances =
    snapshot.address === address ? snapshot.balances : EMPTY_BALANCES;

  const assetsWithBalances: AssetInfo[] = ASSETS.map((asset) => {
    const liveBalance = liveBalances.get(asset.symbol);
    if (liveBalance !== undefined) {
      return { ...asset, balance: liveBalance };
    }
    if (isConnected && address) {
      // Connected but the asset is absent on-chain: a real zero, not the
      // placeholder constant.
      return { ...asset, balance: 0 };
    }
    // Disconnected: fall back to the display-only constants below.
    return asset;
  });

  return { assetsWithBalances, loading, error, refetch };
}
