import { useWalletConnection } from "@/hooks/useWalletConnection";
import React from "react";

interface WalletGateProps {
  children: React.ReactNode;
  fallbackText?: string;
}

export const WalletGate = ({ children, fallbackText = "Connect wallet to continue" }: WalletGateProps) => {
  const { isConnected, isLoading, connect } = useWalletConnection();

  if (isLoading) {
    return <div className="animate-pulse h-12 w-full bg-slate-200 rounded-md" />;
  }

  if (!isConnected) {
    return (
      <button
        onClick={connect}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-4 font-semibold text-white shadow-sm transition-all hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
      >
        {fallbackText}
      </button>
    );
  }

  return <>{children}</>;
};
