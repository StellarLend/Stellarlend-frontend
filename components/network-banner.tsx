"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useWallet } from "./wallet";

export function NetworkBanner() {
  const { networkMismatch, network, expectedPassphrase } = useWallet();
  const t = useTranslations("wallet");

  if (!networkMismatch) {
    return null;
  }

  // Derive human-readable expected network label from config or expectedPassphrase
  const expectedLabel = expectedPassphrase.includes("Test") ? "Testnet" : "Public";
  const currentLabel = network ? network.toUpperCase() : "Unknown";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="w-full border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{t("networkMismatchTitle")}:</span>
          <span>
            {t("networkMismatchDescription", {
              currentNetwork: currentLabel,
              expectedNetwork: expectedLabel,
            })}
          </span>
        </div>
        <span className="hidden whitespace-nowrap text-amber-300/80 md:inline">
          {t("networkMismatchSigningBlocked", {
            expectedNetwork: expectedLabel,
          })}
        </span>
      </div>
    </div>
  );
}
