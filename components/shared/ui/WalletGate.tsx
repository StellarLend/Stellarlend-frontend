import { useWalletConnection } from "@/hooks/useWalletConnection";
import React from "react";

interface WalletGateProps {
  children: React.ReactNode;
  fallbackText?: string;
}

export const WalletGate = ({ children, fallbackText = "Connect wallet to continue" }: WalletGateProps) => {
  const { isConnected, isLoading, connect, error } = useWalletConnection();

  if (isConnected) {
    return <>{children}</>;
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => {
          if (isLoading) return;
          connect();
        }}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-4 font-semibold text-white shadow-sm transition-all hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-75 disabled:cursor-not-allowed"
      >
        {fallbackText}
      </button>
      {error && (
        <span
          data-testid="wallet-error"
          className="mt-2 block text-xs text-red-200 bg-red-900/90 border border-red-700/50 px-2 py-0.5 rounded shadow-lg"
        >
          {error}
        </span>
      )}
    </div>
  );
};
