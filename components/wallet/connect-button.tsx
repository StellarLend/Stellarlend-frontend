"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { accountExplorer, config } from "@/lib/config";
import { useWallet } from "./wallet-context";
import { prefetchWalletPicker } from "./wallet-provider";

export function ConnectButton() {
  const { address, balance, accountStatus, isFunding, fundAccount, openPicker, disconnect } =
    useWallet();
  const t = useTranslations("market");
  const tw = useTranslations("wallet");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyAddress = useCallback(async () => {
    if (!address) return;
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }

    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        setCopyStatus("failed");
      } else {
        await navigator.clipboard.writeText(address);
        setCopyStatus("copied");
      }
    } catch {
      setCopyStatus("failed");
    }

    copyTimeoutRef.current = setTimeout(() => {
      setCopyStatus("idle");
      copyTimeoutRef.current = null;
    }, 2000);
  }, [address]);

  if (address) {
    return (
      <div className="flex items-center gap-2">
        {config.network === "testnet" && accountStatus === "unfunded" && (
          <button
            className="btn text-xs py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded"
            onClick={fundAccount}
            disabled={isFunding}
            title={tw("fundTooltip")}
          >
            {isFunding ? tw("funding") : tw("fundWithFriendbot")}
          </button>
        )}
        <button className="btn-ghost text-sm" onClick={disconnect} title={t("disconnect")}>
          {address.slice(0, 4)}...{address.slice(-4)}
          {balance ? ` (${balance} XLM)` : ""}
        </button>
        <button
          type="button"
          className="btn-ghost text-xs px-2 py-1"
          onClick={handleCopyAddress}
          aria-label={tw("copyAddress")}
          title={tw("copyAddress")}
        >
          {copyStatus === "copied"
            ? tw("copied")
            : copyStatus === "failed"
              ? tw("copyFailed")
              : tw("copyAddress")}
        </button>
        <a
          href={accountExplorer(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost text-xs px-2 py-1"
          aria-label={tw("viewOnExplorer")}
          title={tw("viewOnExplorer")}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
        <span role="status" aria-live="polite" className="sr-only">
          {copyStatus === "copied"
            ? tw("copied")
            : copyStatus === "failed"
              ? tw("copyFailed")
              : ""}
        </span>
      </div>
    );
  }

  return (
    <button
      className="btn whitespace-nowrap text-xs sm:text-sm"
      onClick={openPicker}
      onMouseEnter={prefetchWalletPicker}
      onFocus={prefetchWalletPicker}
    >
      {t("connectFreighter")}
    </button>
  );
}
