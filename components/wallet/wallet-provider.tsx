"use client";
import React, { useCallback, useContext, useMemo } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { QueryClientContext } from "@tanstack/react-query";
import { config } from "@/lib/config";
import { withSigningTimeout, type WalletAdapter } from "@/lib/wallets";
import { addTrustline as horizonAddTrustline } from "@/lib/horizon";
import { QueryProvider } from "@/components/query-provider";
import { ProtocolStatusProvider } from "@/components/protocol-status";
import { WalletCtx } from "./wallet-context";
import { useWalletConnection } from "./use-wallet-connection";
import { useWalletBalances } from "./use-wallet-balances";
import { useFriendbot } from "./use-friendbot";

function WalletPickerSkeleton() {
  const t = useTranslations("wallet");
  const label = t("loadingWallets");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="status"
      aria-busy="true"
      aria-label={label}
      data-testid="wallet-picker-skeleton"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111318] p-6 shadow-2xl space-y-4">
        <div className="h-6 w-40 animate-pulse rounded bg-white/10" />
        <div className="space-y-3">
          <div className="h-14 w-full animate-pulse rounded-xl bg-white/5" />
          <div className="h-14 w-full animate-pulse rounded-xl bg-white/5" />
        </div>
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}

const loadWalletPicker = () =>
  import("@/components/wallet-picker").then((mod) => mod.WalletPickerModal);

export function prefetchWalletPicker(): void {
  void loadWalletPicker();
}

const WalletPickerModal = dynamic(loadWalletPicker, {
  ssr: false,
  loading: () => <WalletPickerSkeleton />,
});

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
  const {
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
    disconnect: baseDisconnect,
    assertCanSign,
  } = useWalletConnection({ initialAdapter });

  const {
    balance,
    accountStatus,
    balanceErrorMessage,
    balances,
    rawAccount,
    isUnfunded,
    invalidateBalance,
  } = useWalletBalances(address);

  const { isFunding, fundError, fundAccount, resetFundState } = useFriendbot(
    address,
    invalidateBalance
  );

  // Wrap disconnect to also reset friendbot state
  const disconnect = useCallback(() => {
    resetFundState();
    baseDisconnect();
  }, [resetFundState, baseDisconnect]);

  const signTransaction = useCallback(
    async (xdr: string, options?: Parameters<typeof adapter.signTransaction>[1]) => {
      if (!adapter) {
        throw new Error("No wallet connected to sign transaction.");
      }
      assertCanSign();
      return withSigningTimeout(
        adapter.signTransaction(xdr, {
          networkPassphrase: options?.networkPassphrase ?? config.networkPassphrase,
          accountToSign: options?.accountToSign ?? address ?? undefined,
        })
      );
    },
    [adapter, address, assertCanSign]
  );

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

  const value = useMemo(
    () => ({
      address,
      balance,
      error: balanceErrorMessage ?? error,
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
      rawAccount,
      isUnfunded,
      refreshBalances: invalidateBalance,
      addTrustline,
      network,
      networkPassphrase,
      networkMismatch,
      expectedPassphrase,
      assertCanSign,
    }),
    [
      address,
      balance,
      error,
      balanceErrorMessage,
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
      balances,
      rawAccount,
      isUnfunded,
      addTrustline,
      network,
      networkPassphrase,
      networkMismatch,
      expectedPassphrase,
      assertCanSign,
    ]
  );

  return (
    <WalletCtx.Provider value={value}>
      <ProtocolStatusProvider>{children}</ProtocolStatusProvider>
      {isPickerOpen && (
        <WalletPickerModal
          isOpen={isPickerOpen}
          onClose={closePicker}
          onSelectWallet={async (id) => {
            await connect(id);
          }}
          lastWalletId={lastWalletId}
        />
      )}
    </WalletCtx.Provider>
  );
}
