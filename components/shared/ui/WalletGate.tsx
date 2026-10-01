import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useWalletContext } from "@/context/WalletContext";
import React from "react";

interface WalletGateProps {
  children: React.ReactNode;
  fallbackText?: string;
}

/** Stable id linking the connect button to its failure message. */
const WALLET_GATE_ERROR_ID = "wallet-gate-error";

export const WalletGate = ({ children, fallbackText = "Connect wallet to continue" }: WalletGateProps) => {
  const context = useWalletContext();
  const hook = useWalletConnection();
  const { isConnected, isLoading, connect, error } = context ?? hook;

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
        aria-describedby={error ? WALLET_GATE_ERROR_ID : undefined}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-4 font-semibold text-white shadow-sm transition-all hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-75 disabled:cursor-not-allowed"
      >
        {fallbackText}
      </button>
      {error && (
        // `role="alert"` makes the failure announced to assistive technology
        // the moment it appears; without it the message was visible but silent,
        // so screen-reader users were still told nothing about the failure.
        // `aria-describedby` on the button ties the message to the control that
        // produced it.
        <span
          id={WALLET_GATE_ERROR_ID}
          role="alert"
          data-testid="wallet-error"
          className="mt-2 block text-xs text-red-200 bg-red-900/90 border border-red-700/50 px-2 py-0.5 rounded shadow-lg"
        >
          {error}
        </span>
      )}
    </div>
  );
};
