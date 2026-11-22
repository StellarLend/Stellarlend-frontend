"use client";

import { Button, Card } from "@/components/ui";
import { formatCurrency, formatNumber, formatPercent, type Locale, type Market } from "@/lib/markets";

type MarketCardProps = {
  market: Market;
  locale?: Locale;
  supplied?: number | null;
  borrowed?: number | null;
  onTrade: (market: Market) => void;
};

/** Compact mobile card for a single market (the sm+ layout uses the table in markets-app). */
export default function MarketCard({ market, locale = "en" as Locale, supplied, borrowed, onTrade }: MarketCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <b>{market.symbol}</b> <span className="mut">{market.name}</span>
          <div className="text-sm">{formatCurrency(market.price, locale)}</div>
        </div>
        <Button variant="ghost" aria-label={`Trade ${market.symbol}`} onClick={() => onTrade(market)}>
          Trade
        </Button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="mut">Supply APY</dt>
          <dd className="text-emerald-400">{formatPercent(market.supplyApy, locale)}</dd>
        </div>
        <div>
          <dt className="mut">Borrow APY</dt>
          <dd>{formatPercent(market.borrowApy, locale)}</dd>
        </div>
        {supplied != null && (
          <div>
            <dt className="mut">Supplied</dt>
            <dd>{formatNumber(supplied, locale, 4)}</dd>
          </div>
        )}
        {borrowed != null && (
          <div>
            <dt className="mut">Borrowed</dt>
            <dd>{formatNumber(borrowed, locale, 4)}</dd>
          </div>
        )}
      </dl>
    </Card>
  );
}
