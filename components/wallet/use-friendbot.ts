"use client";
import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { config } from "@/lib/config";
import { fundWithFriendbot, pollUntilFunded } from "@/lib/friendbot";

export interface UseFriendbotResult {
  isFunding: boolean;
  fundError: string | null;
  fundAccount: () => Promise<void>;
  /** Call this ref setter so the hook can reset state on disconnect. */
  abortRef: React.MutableRefObject<AbortController | null>;
  resetFundState: () => void;
}

export function useFriendbot(
  address: string | null,
  invalidateBalance: () => Promise<void>
): UseFriendbotResult {
  const t = useTranslations("wallet");
  const [isFunding, setIsFunding] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);
  const fundAbortRef = useRef<AbortController | null>(null);
  const lastFundAttemptRef = useRef<number>(0);

  const resetFundState = useCallback(() => {
    fundAbortRef.current?.abort();
    setIsFunding(false);
    setFundError(null);
  }, []);

  const fundAccount = useCallback(async () => {
    if (!address || config.network !== "testnet" || isFunding) return;

    const now = Date.now();
    if (now - lastFundAttemptRef.current < 30000) {
      const remainingSec = Math.ceil((30000 - (now - lastFundAttemptRef.current)) / 1000);
      setFundError(t("fundCooldown", { seconds: remainingSec }));
      return;
    }

    lastFundAttemptRef.current = now;
    setIsFunding(true);
    setFundError(null);

    fundAbortRef.current?.abort();
    const controller = new AbortController();
    fundAbortRef.current = controller;

    try {
      const result = await fundWithFriendbot(address, { signal: controller.signal });
      if (!result.ok) {
        setFundError(result.message || t("fundFailed"));
        return;
      }

      const funded = await pollUntilFunded(address, {
        signal: controller.signal,
        maxWaitMs: 20000,
        intervalMs: 1500,
      });

      if (funded) {
        await invalidateBalance();
      } else {
        setFundError(t("fundTimeout"));
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setFundError(err instanceof Error ? err.message : t("fundFailed"));
    } finally {
      setIsFunding(false);
    }
  }, [address, isFunding, t, invalidateBalance]);

  return {
    isFunding,
    fundError,
    fundAccount,
    abortRef: fundAbortRef,
    resetFundState,
  };
}
