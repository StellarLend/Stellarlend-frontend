"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, Button } from "@/components/ui";
import { computeRisk, toFloat, type Ledger } from "@/lib/demo-ledger";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  type Locale,
  type Market,
} from "@/lib/markets";
import {
  classifyHealth,
  liquidationPrice,
  type HealthLevel,
} from "@/lib/projection";

/** Reuses the colour-coded chip styles from `HealthChip`. */
const LEVEL_STYLE: Record<HealthLevel, string> = {
  safe: "border-emerald-500 text-emerald-600",
  warning: "border-amber-500 text-amber-600",
  danger: "border-orange-600 text-orange-600",
  liquidatable: "border-red-600 text-red-600",
};

export type PortfolioRiskProps = {
  ledger: Ledger;
  markets: Market[];
};

export function PortfolioRisk({ ledger, markets }: PortfolioRiskProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("portfolioRisk");
  const [shockPercent, setShockPercent] = useState(0);

  const activeRows = useMemo(() => {
    return markets
      .map((market) => {
        const pos = ledger[market.symbol];
        const supplied = pos?.supplied ?? BigInt(0);
        const borrowed = pos?.borrowed ?? BigInt(0);
        if (supplied <= BigInt(0) && borrowed <= BigInt(0)) return null;

        const suppliedFloat = toFloat(supplied, market.decimals);
        const borrowedFloat = toFloat(borrowed, market.decimals);
        const liq = liquidationPrice(ledger, markets, market.symbol);

        return {
          market,
          suppliedFloat,
          borrowedFloat,
          suppliedUsd: suppliedFloat * market.price,
          borrowedUsd: borrowedFloat * market.price,
          liqPrice: liq,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }, [ledger, markets]);

  const baseRisk = useMemo(() => computeRisk(ledger, markets), [ledger, markets]);
  const hasDebt = baseRisk.borrowUsd > 0;

  const projectedHealth = useMemo(() => {
    if (!hasDebt) return Infinity;
    const factor = Math.max(0, 1 + shockPercent / 100);
    return (baseRisk.limitUsd * factor) / baseRisk.borrowUsd;
  }, [baseRisk.borrowUsd, baseRisk.limitUsd, hasDebt, shockPercent]);

  const level = classifyHealth(projectedHealth);
  const shockLabel = `${shockPercent > 0 ? "+" : ""}${formatPercent(shockPercent, locale, 0)}`;

  return (
    <Card className="space-y-4 p-5" data-testid="portfolio-risk">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="mut text-xs">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right text-sm">
            <div className="mut text-xs">
              {shockPercent === 0 ? t("aggregateHealth") : t("projectedHealth")}
            </div>
            <div className="font-semibold" data-testid="portfolio-risk-health">
              {hasDebt ? formatNumber(projectedHealth, locale, 2) : t("noDebt")}
            </div>
          </div>
          <span
            data-testid="portfolio-risk-level"
            data-level={level}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${LEVEL_STYLE[level]}`}
          >
            {hasDebt ? t(`levels.${level}`) : t("noDebt")}
          </span>
        </div>
      </div>

      {activeRows.length === 0 ? (
        <p className="mut text-sm" data-testid="portfolio-risk-empty">
          {t("noPositions")}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" aria-label={t("title")}>
              <thead className="border-b border-[var(--line)] text-xs mut">
                <tr>
                  <th className="py-2 pr-4 font-medium">{t("columns.asset")}</th>
                  <th className="py-2 pr-4 font-medium">{t("columns.supplied")}</th>
                  <th className="py-2 pr-4 font-medium">{t("columns.borrowed")}</th>
                  <th className="py-2 pr-4 font-medium">{t("columns.currentPrice")}</th>
                  <th className="py-2 font-medium text-right">{t("columns.liqPrice")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {activeRows.map(({ market, suppliedFloat, borrowedFloat, suppliedUsd, borrowedUsd, liqPrice }) => {
                  const priceDigits = market.price < 1 ? 4 : 2;
                  const liqDigits = liqPrice !== null && liqPrice < 1 ? 4 : 2;
                  return (
                    <tr key={market.symbol}>
                      <td className="py-2.5 pr-4 font-medium">{market.symbol}</td>
                      <td className="py-2.5 pr-4">
                        {suppliedFloat > 0 ? (
                          <div>
                            <div>{formatNumber(suppliedFloat, locale, 4)}</div>
                            <div className="mut text-xs">{formatCurrency(suppliedUsd, locale)}</div>
                          </div>
                        ) : (
                          <span className="mut">{t("notApplicable")}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        {borrowedFloat > 0 ? (
                          <div>
                            <div>{formatNumber(borrowedFloat, locale, 4)}</div>
                            <div className="mut text-xs">{formatCurrency(borrowedUsd, locale)}</div>
                          </div>
                        ) : (
                          <span className="mut">{t("notApplicable")}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        {formatCurrency(market.price, locale, priceDigits)}
                      </td>
                      <td className="py-2.5 text-right" data-testid={`liq-price-${market.symbol}`}>
                        {liqPrice !== null
                          ? formatCurrency(liqPrice, locale, liqDigits)
                          : t("notApplicable")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 border-t border-[var(--line)] pt-4">
            <div className="flex items-center justify-between gap-2 text-xs">
              <label htmlFor="portfolio-price-shock" className="font-medium">
                {t("priceShock")}
              </label>
              <div className="flex items-center gap-2">
                <span className="font-mono" data-testid="portfolio-risk-shock-value">
                  {shockLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShockPercent(0)}
                  disabled={shockPercent === 0}
                >
                  {t("reset")}
                </Button>
              </div>
            </div>
            <input
              id="portfolio-price-shock"
              type="range"
              min={-50}
              max={50}
              step={1}
              value={shockPercent}
              onChange={(e) => setShockPercent(Number(e.target.value))}
              aria-label={t("priceShock")}
              className="w-full accent-emerald-500"
            />
          </div>
        </>
      )}
    </Card>
  );
}

export default PortfolioRisk;
