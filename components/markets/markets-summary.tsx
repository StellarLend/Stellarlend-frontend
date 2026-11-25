"use client";
/**
 * MarketsSummary
 *
 * The top-of-page wallet card: displays connected address / balance, demo-mode
 * label, on-chain / demo-fallback indicator, funding button (testnet), connect
 * button, health indicator, and the three portfolio stats (collateral, borrowed,
 * health factor).
 *
 * This is a pure presentational component — all state is passed in as props.
 */

import { Button, Card, Stat } from "@/components/ui";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency, formatNumber, type Locale } from "@/lib/markets";
import { HealthIndicator } from "@/components/health-indicator";
import { config } from "@/lib/config";

export type MarketsSummaryProps = {
  address: string | null | undefined;
  balance: string | null | undefined;
  isUnfunded: boolean;
  error: string | null | undefined;
  positionError: string;
  isLoadingPosition: boolean;
  isFunding: boolean;
  fundError: string | null | undefined;
  accountStatus: string | null | undefined;
  onChainMode: boolean;
  /** USD value of collateral (demo) or formatted XLM string (on-chain). */
  collateralText: string;
  /** USD value of debt (demo) or formatted XLM string (on-chain). */
  borrowedText: string;
  health: number | null;
  onConnect: () => void;
  onFund: () => void;
};

export function MarketsSummary({
  address,
  balance,
  isUnfunded,
  error,
  positionError,
  isLoadingPosition,
  isFunding,
  fundError,
  accountStatus,
  onChainMode,
  collateralText,
  borrowedText,
  health,
  onConnect,
  onFund,
}: MarketsSummaryProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("market");
  const tw = useTranslations("wallet");

  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="min-w-0 text-sm">
        <div className="mut">{t("wallet")}</div>
        {address ? (
          <div className="min-w-0">
            <span className="block truncate font-mono">
              {address.slice(0, 8)}...{address.slice(-6)}
            </span>
            <span className="mut"> - {balance ?? "..."} XLM</span>
          </div>
        ) : (
          <div>{t("demoMode")}</div>
        )}
        {onChainMode && <div className="mut text-xs">{t("onchainMode")}</div>}
        {address && !onChainMode && <div className="mut text-xs">{t("status.demoFallback")}</div>}
        {error && <div className="mt-1 text-amber-400">{error}</div>}
        {positionError && <div className="mt-1 text-amber-400">{positionError}</div>}
        {isLoadingPosition && <div className="mut text-xs">{t("status.loadingPosition")}</div>}
        {fundError && <div className="mt-1 text-red-400">{fundError}</div>}
      </div>

      {address && config.network === "testnet" && accountStatus === "unfunded" && (
        <button
          className="btn text-xs py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded"
          onClick={onFund}
          disabled={isFunding}
        >
          {isFunding ? tw("funding") : tw("fundWithFriendbot")}
        </button>
      )}

      {!address && (
        <Button variant="primary" className="w-full sm:w-auto" onClick={onConnect}>
          {t("connectFreighter")}
        </Button>
      )}

      <HealthIndicator />

      <div className="grid w-full grid-cols-3 gap-3 text-sm sm:w-auto sm:gap-6">
        <Stat k={t("collateral")} v={collateralText} />
        <Stat k={t("borrowed")} v={borrowedText} />
        <Stat
          k={t("health")}
          v={health === Infinity || health === null ? t("nA") : formatNumber(health, locale)}
          tone={health !== null && health < 1.2 ? "danger" : "positive"}
        />
      </div>
    </Card>
  );
}
