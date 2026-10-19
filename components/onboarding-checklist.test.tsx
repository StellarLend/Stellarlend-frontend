"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useWallet } from "./wallet";
import { config } from "@/lib/config";

const DISMISSED_STORAGE_KEY = "stellarlend_onboarding_dismissed";

interface OnboardingChecklistProps {
  hasSupplied?: boolean;
}

export function OnboardingChecklist({ hasSupplied = false }: OnboardingChecklistProps) {
  const t = useTranslations("onboarding");
  const { address, accountStatus, isFunding, fundError, fundAccount } = useWallet();

  const [dismissed, setDismissed] = useState(false);
  const [freighterInstalled, setFreighterInstalled] = useState<boolean | null>(null);

  // Check dismissal from localStorage
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const item = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
        if (item === "true") {
          setDismissed(true);
        }
      }
    } catch {
      // localStorage may be blocked or restricted; checklist works without persistence
    }
  }, []);

  // Detect freighter
  useEffect(() => {
    let active = true;
    import("@stellar/freighter-api")
      .then((api) => api.isConnected())
      .then((conn) => {
        if (active) setFreighterInstalled(!!conn?.isConnected);
      })
      .catch(() => {
        if (active) setFreighterInstalled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(DISMISSED_STORAGE_KEY, "true");
      }
    } catch {
      // Ignored if blocked
    }
  };

  // Only show on testnet
  if (config.network !== "testnet" || dismissed) {
    return null;
  }

  const isConnected = !!address;
  const isNetworkCorrect = config.network === "testnet";
  const isFunded = accountStatus === "funded";
  const isFirstSupplyDone = hasSupplied;

  const steps = [
    {
      id: "installed",
      title: t("stepInstalled"),
      done: freighterInstalled === true,
      pending: freighterInstalled === null,
      action: !freighterInstalled ? (
        <a
          href="https://www.freighter.app/"
          target="_blank"
          rel="noreferrer"
          className="underline text-xs text-blue-400 hover:text-blue-300 ml-2"
        >
          {t("installFreighter")}
        </a>
      ) : null,
    },
    {
      id: "connected",
      title: t("stepConnected"),
      done: isConnected,
      pending: false,
    },
    {
      id: "network",
      title: t("stepNetwork"),
      done: isNetworkCorrect,
      pending: false,
    },
    {
      id: "funded",
      title: t("stepFunded"),
      done: isFunded,
      pending: isFunding,
      action:
        isConnected && !isFunded ? (
          <div className="inline-flex items-center gap-2 ml-2">
            <button
              onClick={fundAccount}
              disabled={isFunding}
              className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500 hover:bg-amber-600 text-black disabled:opacity-50"
            >
              {isFunding ? t("funding") : t("fundWithFriendbot")}
            </button>
            <a
              href="https://laboratory.stellar.org/#account-creator"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-neutral-400 hover:text-neutral-200 underline"
            >
              {t("manualLink")}
            </a>
          </div>
        ) : null,
    },
    {
      id: "supply",
      title: t("stepSupply"),
      done: isFirstSupplyDone,
      pending: false,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <div
      className="card p-5 border border-amber-500/30 bg-amber-500/5 relative rounded-xl"
      data-testid="onboarding-checklist"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-neutral-100">{t("title")}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
              {completedCount}/{steps.length}
            </span>
          </div>
          <p className="text-xs mut mt-1">{t("subtitle")}</p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-xs text-neutral-400 hover:text-neutral-100 px-2 py-1 rounded hover:bg-white/5 transition-colors"
          aria-label={t("dismiss")}
        >
          Γ£ò {t("dismiss")}
        </button>
      </div>

      {fundError && (
        <div className="mt-3 p-2 text-xs bg-red-950/60 border border-red-800/80 rounded text-red-200 flex items-center justify-between">
          <span>{fundError}</span>
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={fundAccount}
              className="underline font-semibold hover:text-white"
            >
              {t("retry")}
            </button>
            <a
              href="https://laboratory.stellar.org/#account-creator"
              target="_blank"
              rel="noreferrer"
              className="underline text-neutral-300 hover:text-white"
            >
              {t("manualFaucet")}
            </a>
          </div>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center text-sm">
            <span
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs mr-2.5 font-bold ${
                step.done
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : step.pending
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                  : "bg-neutral-800 text-neutral-400 border border-neutral-700"
              }`}
            >
              {step.done ? "Γ£ô" : step.pending ? "ΓÇª" : "Γùï"}
            </span>
            <span className={step.done ? "text-neutral-300 line-through opacity-80" : "text-neutral-200"}>
              {step.title}
            </span>
            {step.action}
          </li>
        ))}
      </ul>
    </div>
  );
}
