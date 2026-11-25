"use client";
/**
 * TradePanel
 *
 * The supply/borrow/withdraw/repay interaction panel for a selected market.
 * Fully presentational: all state lives in markets-app.tsx (the orchestrator).
 */

import { useTranslations, useLocale } from "next-intl";
import { type Locale, type Market, formatNumber, toFloat as marketToFloat } from "@/lib/markets";
import { type LendingTx } from "@/lib/lending-client";
import { type RiskSummary } from "@/lib/demo-ledger";
import { toFloat, DECIMALS } from "@/lib/demo-ledger";
import { txExplorer } from "@/lib/config";
import { TradePreview } from "@/components/trade-preview";
import TrustlinePrompt, {
  TRUSTLINE_ERROR_MESSAGE_KEYS,
} from "@/components/trustline-prompt";
import { type TrustlineErrorKind } from "@/lib/horizon";
import { type TradeOracleGuard } from "@/hooks/use-oracle-guard";

export type TradePanelMode = "supply" | "borrow" | "withdraw" | "repay";

export type TradePanelProps = {
  sel: Market;
  mode: TradePanelMode;
  amt: string;
  busy: boolean;
  tx: LendingTx | null;
  msg: { text: string; isError: boolean } | null;
  oracleGuard: TradeOracleGuard;
  risk: RiskSummary;
  /** Whether this action is blocked by protocol status (paused/emergency). */
  currentBlocked: boolean;
  currentBlockedReason: string | null;
  /** Whether there is already a pending tx for the same action+asset. */
  duplicatePending: boolean;
  /** Whether a classic-asset trustline is missing (blocks supply/repay). */
  missingTrustline: boolean;
  trustlineLoading: string | null;
  trustlineError: { symbol: string; kind: TrustlineErrorKind } | null;
  spendableXlm: number;
  isDemoMode: boolean;
  /** Per-action protocol-status check. Returns null if allowed. */
  getBlockedReason: (action: TradePanelMode) => string | null;
  isActionAllowed: (action: TradePanelMode) => boolean;
  onModeChange: (mode: TradePanelMode) => void;
  onAmtChange: (value: string) => void;
  onConfirm: () => void;
  onAddTrustline: (market: Market) => void;
};

const TRADE_ACTIONS = ["supply", "borrow", "withdraw", "repay"] as const;

export function TradePanel({
  sel,
  mode,
  amt,
  busy,
  tx,
  msg,
  oracleGuard,
  risk,
  currentBlocked,
  currentBlockedReason,
  duplicatePending,
  missingTrustline,
  trustlineLoading,
  trustlineError,
  spendableXlm,
  isDemoMode,
  getBlockedReason,
  isActionAllowed,
  onModeChange,
  onAmtChange,
  onConfirm,
  onAddTrustline,
}: TradePanelProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("market");
  const tStatus = useTranslations("protocolStatus");

  const oracleReasonId = oracleGuard.reason ? "oracle-guard-reason" : undefined;
  const trustlineBlocksAction =
    missingTrustline && (mode === "supply" || mode === "repay");

  function transactionStatus() {
    if (!tx || tx.status === "pending") return null;
    if (tx.status === "confirmed") return t("status.confirmed");
    if (tx.status === "cancelled") return t("status.cancelled");
    if (tx.status === "timeout") return t("status.timedOut");
    const detail = tx.error?.message ?? t("status.failed");
    return tx.error?.hint ? `${detail} ${tx.error.hint}` : detail;
  }

  return (
    <div className="space-y-4">
      {/* Action tabs */}
      <div
        className="grid grid-cols-4 gap-1 text-sm"
        role="tablist"
        aria-label={`${sel.symbol} ${t("actions")}`}
      >
        {TRADE_ACTIONS.map((x) => {
          const blockedReason = !isDemoMode ? getBlockedReason(x) : null;
          const isBlocked = !isDemoMode && !isActionAllowed(x);
          return (
            <button
              key={x}
              role="tab"
              data-action={x}
              aria-selected={mode === x}
              tabIndex={mode === x ? 0 : -1}
              disabled={isBlocked}
              title={
                blockedReason
                  ? tStatus("actionBlockedTooltip", { reason: blockedReason })
                  : undefined
              }
              onKeyDown={(event) => {
                const direction =
                  event.key === "ArrowRight"
                    ? 1
                    : event.key === "ArrowLeft"
                      ? -1
                      : 0;
                if (!direction) return;

                const tabs = Array.from(
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                    '[role="tab"]:not(:disabled)',
                  ) ?? [],
                );
                const currentIndex = tabs.indexOf(event.currentTarget);
                if (currentIndex < 0 || tabs.length < 2) return;

                event.preventDefault();
                const nextTab =
                  tabs[(currentIndex + direction + tabs.length) % tabs.length];
                const nextAction = TRADE_ACTIONS.find(
                  (action) => action === nextTab.dataset.action,
                );
                if (!nextAction) return;

                nextTab.focus();
                onModeChange(nextAction);
              }}
              onClick={() => {
                if (isBlocked) return;
                onModeChange(x);
              }}
              className={`rounded-lg py-2 ${
                isBlocked
                  ? "opacity-40 cursor-not-allowed bg-slate-800 text-slate-500 border border-slate-700"
                  : mode === x
                    ? "btn"
                    : "btn-ghost"
              }`}
            >
              {t(x)}
            </button>
          );
        })}
      </div>

      {/* Protocol blocked banner */}
      {currentBlockedReason && (
        <div className="text-xs text-amber-400 bg-amber-950/40 border border-amber-900/60 p-2.5 rounded-lg">
          {tStatus("actionBlockedTooltip", { reason: currentBlockedReason })}
        </div>
      )}

      {/* Trustline prompt */}
      {missingTrustline && (
        <TrustlinePrompt
          symbol={sel.symbol}
          spendableXlm={spendableXlm}
          issuer={sel.asset !== "native" ? (sel.asset as { code: string; issuer: string }).issuer : undefined}
          isAdding={trustlineLoading === sel.symbol}
          error={
            trustlineError?.symbol === sel.symbol ? trustlineError.kind : null
          }
          onAdd={() => onAddTrustline(sel)}
        />
      )}

      {/* Amount input */}
      <input
        inputMode="decimal"
        placeholder={t("amountIn", { symbol: sel.symbol })}
        value={amt}
        onChange={(e) => onAmtChange(e.target.value)}
        disabled={busy}
        aria-label={t("amountIn", { symbol: sel.symbol })}
      />

      {/* Confirm button */}
      <button
        className="btn w-full"
        onClick={onConfirm}
        disabled={
          busy || currentBlocked || trustlineBlocksAction || duplicatePending
        }
        title={
          duplicatePending
            ? t("status.duplicatePending")
            : currentBlockedReason
              ? tStatus("actionBlockedTooltip", {
                  reason: currentBlockedReason,
                })
              : undefined
        }
      >
        {busy ? t("status.pending") : t("confirm", { action: t(mode) })}
      </button>

      {/* Trade preview */}
      <TradePreview
        currentCollateralUsd={risk.collateralUsd}
        currentBorrowUsd={risk.borrowUsd}
        currentLimitUsd={risk.limitUsd}
        currentHealth={risk.health}
        projected={null}
        oracleGuard={oracleGuard}
        oracleGuardId={oracleReasonId}
      />

      {/* Feedback message */}
      {msg && (
        <p
          className={msg.isError ? "text-amber-400 text-sm" : "mut text-sm"}
          role={msg.isError ? "alert" : "status"}
        >
          {msg.text}
        </p>
      )}

      {/* Transaction status */}
      {tx && (
        <div className="text-sm" role="status">
          <p
            className={
              tx.status === "failed"
                ? "text-red-300"
                : tx.status === "confirmed"
                  ? "text-emerald-400"
                  : "mut"
            }
          >
            {transactionStatus()}
          </p>
          {tx.hash && (
            <a
              className="break-all underline"
              href={txExplorer(tx.hash)}
              target="_blank"
              rel="noreferrer"
            >
              {t("viewTx")}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
