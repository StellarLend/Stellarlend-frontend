"use client";

import { Button, Card } from "@/components/ui";
import { useTranslations } from "next-intl";
import { formatCurrency, formatNumber, formatPercent, type Locale, type Market } from "@/lib/markets";

type MarketCardProps = {
  market: Market;
  locale?: Locale;
  supplied?: number | null;
  borrowed?: number | null;
  starred?: boolean;
  onStar?: (market: Market) => void;
  onTrade: (market: Market) => void;
};

/** Compact mobile card for a single market (the sm+ layout uses the table in markets-app). */
export default function MarketCard({
  market,
  locale = "en" as Locale,
  supplied,
  borrowed,
  starred = false,
  onStar,
  onTrade,
}: MarketCardProps) {
  const t = useTranslations("market");

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <b>{market.symbol}</b> <span className="mut">{market.name}</span>
          <div className="text-sm">{formatCurrency(market.price, locale)}</div>
        </div>
        <div className="flex items-center gap-2">
          {onStar && (
            <button
              type="button"
              aria-pressed={starred}
              aria-label={
                starred
                  ? t("watchlist.unstarAriaLabel", { symbol: market.symbol })
                  : t("watchlist.starAriaLabel", { symbol: market.symbol })
              }
              onClick={() => onStar(market)}
              className={`rounded p-1 text-lg leading-none transition-colors ${
                starred
                  ? "text-yellow-400 hover:text-yellow-300"
                  : "text-zinc-500 hover:text-yellow-400"
              }`}
            >
              {starred ? "★" : "☆"}
            </button>
          )}
          <Button variant="ghost" aria-label={t("tradeAriaLabel", { symbol: market.symbol })} onClick={() => onTrade(market)}>
            {t("trade")}
          </Button>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="mut">{t("supplyApy")}</dt>
          <dd className="text-emerald-400">{formatPercent(market.supplyApy, locale)}</dd>
        </div>
        <div>
          <dt className="mut">{t("borrowApy")}</dt>
          <dd>{formatPercent(market.borrowApy, locale)}</dd>
        </div>
        {supplied != null && (
          <div>
            <dt className="mut">{t("supplied")}</dt>
            <dd>{formatNumber(supplied, locale, 4)}</dd>
          </div>
        )}
        {borrowed != null && (
          <div>
            <dt className="mut">{t("borrowed")}</dt>
            <dd>{formatNumber(borrowed, locale, 4)}</dd>
          </div>
        )}
      </dl>
    </Card>
  );
}
