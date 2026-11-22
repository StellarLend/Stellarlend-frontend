"use client";
import { useLocale, useTranslations } from "next-intl";
import { accountExplorer } from "@/lib/config";
import { formatNumber, type Locale } from "@/lib/markets";
import { TRUSTLINE_RESERVE_XLM, type TrustlineErrorKind } from "@/lib/horizon";

export const TRUSTLINE_ERROR_MESSAGE_KEYS: Record<TrustlineErrorKind, string> = {
  rejected: "trustlineRejected",
  lowReserve: "trustlineLowReserve",
  failed: "trustlineFailed",
};

export interface TrustlinePromptProps {
  symbol: string;
  /** Spendable XLM above the account's minimum reserve. */
  spendableXlm: number;
  /** Reserve locked by one additional trustline (defaults to 0.5 XLM). */
  reserveXlm?: number;
  /** Classic asset issuer, used for the explorer link. */
  issuer?: string;
  isAdding?: boolean;
  /** Classified failure from the last attempt, rendered as a localized message. */
  error?: TrustlineErrorKind | null;
  onAdd: () => void;
}

/**
 * Explains that a classic-asset market needs a trustline and lets the user add
 * it. When the account cannot cover the reserve, the explanation replaces the
 * action button.
 */
export default function TrustlinePrompt({
  symbol,
  spendableXlm,
  reserveXlm = TRUSTLINE_RESERVE_XLM,
  issuer,
  isAdding = false,
  error,
  onAdd,
}: TrustlinePromptProps) {
  const t = useTranslations("market");
  const locale = useLocale() as Locale;
  const reserve = formatNumber(reserveXlm, locale, 1);
  const insufficientReserve = spendableXlm < reserveXlm;

  return (
    <div
      className="space-y-2 rounded-lg border border-amber-900/60 bg-amber-950/40 p-2.5 text-xs text-amber-200"
      role="note"
      data-testid={`trustline-notice-${symbol}`}
    >
      <p>{t("trustlineRequired", { symbol, reserve })}</p>
      {issuer && (
        <a className="underline" href={accountExplorer(issuer)} target="_blank" rel="noreferrer">
          {t("viewIssuer")}
        </a>
      )}
      {insufficientReserve ? (
        <p data-testid="trustline-reserve-shortfall">
          {t("trustlineInsufficientReserve", { symbol, reserve })}
        </p>
      ) : (
        <button
          type="button"
          className="btn-ghost text-xs px-2 py-1 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 rounded"
          onClick={onAdd}
          disabled={isAdding}
          aria-label={t("addTrustline")}
        >
          {isAdding ? t("addingTrustline") : t("addTrustline")}
        </button>
      )}
      {error && (
        <p className="text-red-300" role="alert" data-testid="trustline-error">
          {t(TRUSTLINE_ERROR_MESSAGE_KEYS[error])}
        </p>
      )}
    </div>
  );
}
