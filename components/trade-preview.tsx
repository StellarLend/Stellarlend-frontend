"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatCurrency, formatNumber, formatPercent, type Locale } from "@/lib/markets";
import type { ProjectedPosition } from "@/lib/projection";

export interface TradePreviewProps {
  currentCollateralUsd: number;
  currentBorrowUsd: number;
  currentLimitUsd: number;
  currentHealth: number;
  projected: ProjectedPosition | null;
}

export function TradePreview({
  currentCollateralUsd,
  currentBorrowUsd,
  currentLimitUsd,
  currentHealth,
  projected,
}: TradePreviewProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("market");

  if (!projected) {
    return null;
  }

  const currentLimitPercent =
    currentLimitUsd > 0
      ? Math.min(100, Math.max(0, (currentBorrowUsd / currentLimitUsd) * 100))
      : currentBorrowUsd > 0
      ? 100
      : 0;

  const formatHf = (hf: number): string => {
    if (!isFinite(hf) || hf === Infinity) {
      return "∞";
    }
    return formatNumber(hf, locale, 2);
  };

  const getHfTone = (hf: number) => {
    if (hf < 1.0) return "text-red-500 font-bold";
    if (hf < 1.2) return "text-amber-400 font-medium";
    return "text-emerald-400 font-medium";
  };

  const getLimitTone = (percent: number) => {
    if (percent >= 100) return "text-red-500 font-bold";
    if (percent >= 80) return "text-amber-400 font-medium";
    return "text-emerald-400 font-medium";
  };

  return (
    <div className="space-y-3 rounded-lg border border-[var(--line)] bg-[#080d1a] p-3 text-xs" data-testid="trade-preview">
      <div className="font-semibold text-mut">{t("preview.title")}</div>

      <div className="space-y-2">
        {/* Borrow limit used */}
        <div className="flex items-center justify-between">
          <span className="mut">{t("preview.borrowLimitUsed")}</span>
          <div className="flex items-center gap-1.5 font-mono">
            <span className={getLimitTone(currentLimitPercent)}>
              {formatPercent(currentLimitPercent, locale)}
            </span>
            <span className="mut">→</span>
            <span className={getLimitTone(projected.borrowLimitUsedPercent)}>
              {formatPercent(projected.borrowLimitUsedPercent, locale)}
            </span>
          </div>
        </div>

        {/* Health Factor */}
        <div className="flex items-center justify-between">
          <span className="mut">{t("preview.healthFactor")}</span>
          <div className="flex items-center gap-1.5 font-mono">
            <span className={getHfTone(currentHealth)}>
              {formatHf(currentHealth)}
            </span>
            <span className="mut">→</span>
            <span className={getHfTone(projected.health)}>
              {formatHf(projected.health)}
            </span>
          </div>
        </div>

        {/* Collateral */}
        <div className="flex items-center justify-between">
          <span className="mut">{t("preview.collateral")}</span>
          <div className="flex items-center gap-1.5 font-mono">
            <span>{formatCurrency(currentCollateralUsd, locale)}</span>
            <span className="mut">→</span>
            <span>{formatCurrency(projected.collateralUsd, locale)}</span>
          </div>
        </div>

        {/* Debt */}
        <div className="flex items-center justify-between">
          <span className="mut">{t("preview.debt")}</span>
          <div className="flex items-center gap-1.5 font-mono">
            <span>{formatCurrency(currentBorrowUsd, locale)}</span>
            <span className="mut">→</span>
            <span>{formatCurrency(projected.borrowUsd, locale)}</span>
          </div>
        </div>
      </div>

      {/* Warning banner when HF < 1.2 and >= 1.0 */}
      {projected.isWarning && !projected.isUnsafe && (
        <div
          role="alert"
          className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-amber-300"
        >
          {t("preview.warningLiquidation")}
        </div>
      )}

      {/* Danger alert when HF < 1.0 */}
      {projected.isUnsafe && (
        <div
          role="alert"
          className="rounded border border-red-500/40 bg-red-500/10 p-2 text-red-300"
        >
          {t("preview.dangerLiquidation")}
        </div>
      )}
    </div>
  );
}
