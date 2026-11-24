"use client";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { config } from "@/lib/config";
import { reportError } from "@/lib/report-error";
import { qk } from "@/lib/query-keys";
import { fetchWithRetry, parseAccountBalances, type AccountBalancesMap, type HorizonAccount } from "@/lib/horizon";
import type { AccountStatus } from "./wallet-context";

export interface UseWalletBalancesResult {
  balance: string | null;
  accountStatus: AccountStatus;
  /** Error message from a failed Horizon balance fetch, null otherwise. */
  balanceErrorMessage: string | null;
  balances: AccountBalancesMap;
  rawAccount: HorizonAccount | null;
  isUnfunded: boolean;
  invalidateBalance: () => Promise<void>;
}

export function useWalletBalances(address: string | null): UseWalletBalancesResult {
  const t = useTranslations("wallet");
  const queryClient = useQueryClient();

  const { data: account = null, isError: balanceError, error: balanceQueryError } = useQuery<{
    balance: string;
    status: AccountStatus;
    balances: AccountBalancesMap;
    rawAccount: HorizonAccount | null;
  } | null>({
    queryKey: qk.accountBalance(address),
    queryFn: async ({ signal }) => {
      if (!address) return null;
      try {
        const res = await fetchWithRetry(`${config.horizon}/accounts/${address}`, { signal });
        if (res.status === 404) {
          return { balance: t("unfunded"), status: "unfunded", balances: {}, rawAccount: null };
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
          ? {
              balance: Number(nativeBalance.balance).toFixed(2),
              status: "funded",
              balances,
              rawAccount: accountData,
            }
          : {
              balance: t("unfunded"),
              status: "unfunded",
              balances,
              rawAccount: accountData,
            };
      } catch (err) {
        if (!signal?.aborted) reportError(err, { context: "wallet:fetchBalance", address });
        throw err;
      }
    },
    enabled: Boolean(address),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const balances: AccountBalancesMap = account?.balances ?? {};
  const rawAccount = account?.rawAccount ?? null;
  const isUnfunded = Boolean(address) && account?.status === "unfunded";
  const balance = account?.balance ?? null;
  const accountStatus: AccountStatus = !address
    ? "unknown"
    : balanceError
      ? "error"
      : account?.status ?? "unknown";

  const balanceErrorMessage = balanceError
    ? balanceQueryError instanceof Error
      ? balanceQueryError.message
      : String(balanceQueryError ?? "Failed to load Horizon balance")
    : null;

  const invalidateBalance = useCallback(async () => {
    if (!address) return;
    await queryClient.invalidateQueries({ queryKey: qk.accountBalance(address) });
  }, [address, queryClient]);

  return {
    balance,
    accountStatus,
    balanceErrorMessage,
    balances,
    rawAccount,
    isUnfunded,
    invalidateBalance,
  };
}
