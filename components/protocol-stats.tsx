"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { MARKETS, formatCompactCurrency, type Locale } from "@/lib/markets";
import { getProtocolMetrics, type ProtocolMetrics } from "@/lib/protocol";
import { formatTokenDisplay, formatPercentFromBps } from "@/lib/format";

export interface ProtocolStatsProps {
  initialMetrics?: ProtocolMetrics | null;
  pollIntervalMs?: number;
}

export function ProtocolStats({ initialMetrics = null, pollIntervalMs = 30_000 }: ProtocolStatsProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("home");
  const [metrics, setMetrics] = React.useState<ProtocolMetrics | null>(initialMetrics);
  const [isLoading, setIsLoading] = React.useState<boolean>(!initialMetrics);
  const [isDemoFallback, setIsDemoFallback] = React.useState<boolean>(false);

  React.useEffect(() => {
    let active = true;

    async function fetchMetrics() {
      try {
        const result = await getProtocolMetrics();
        if (!active) return;
        if (result) {
          setMetrics(result);
          setIsDemoFallback(false);
        } else {
          setIsDemoFallback(true);
        }
      } catch {
        if (!active) return;
        setIsDemoFallback(true);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void fetchMetrics();

    const intervalId = setInterval(() => {
      void fetchMetrics();
    }, pollIntervalMs);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [pollIntervalMs]);

  const fallbackTvl = MARKETS.reduce((sum, market) => sum + market.totalSupply * market.price, 0);
  const fallbackBorrowed = MARKETS.reduce((sum, market) => sum + market.totalBorrow * market.price, 0);

  // If loading and no metrics yet
  if (isLoading && !metrics && !isDemoFallback) {
    return (
      <section data-testid="protocol-stats-loading" className="grid gap-4 sm:grid-cols-4">
        {[t("totalSupplied"), t("totalBorrowed"), t("utilization"), t("markets")].map((label) => (
          <div key={label} className="card p-6 text-center animate-pulse">
            <div className="h-8 bg-[var(--line)] rounded w-24 mx-auto mb-2"></div>
            <div className="mut text-sm">{label}</div>
          </div>
        ))}
      </section>
    );
  }

  // If live metrics are available
  if (metrics && !isDemoFallback) {
    const supplyDisplay = formatTokenDisplay(metrics.totalSupply, 7, "XLM");
    const borrowDisplay = formatTokenDisplay(metrics.totalBorrow, 7, "XLM");
    const utilizationDisplay = formatPercentFromBps(metrics.utilizationBps);

    return (
      <section data-testid="protocol-stats-live" className="space-y-2">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="card p-6 text-center">
            <div className="text-2xl sm:text-3xl font-bold">{supplyDisplay}</div>
            <div className="mut text-sm">{t("totalSupplied")}</div>
          </div>
          <div className="card p-6 text-center">
            <div className="text-2xl sm:text-3xl font-bold">{borrowDisplay}</div>
            <div className="mut text-sm">{t("totalBorrowed")}</div>
          </div>
          <div className="card p-6 text-center">
            <div className="text-2xl sm:text-3xl font-bold">{utilizationDisplay}</div>
            <div className="mut text-sm">{t("utilization")}</div>
          </div>
          <div className="card p-6 text-center">
            <div className="text-2xl sm:text-3xl font-bold">{MARKETS.length}</div>
            <div className="mut text-sm">{t("markets")}</div>
          </div>
        </div>
        <div className="flex justify-end items-center gap-2 text-xs mut px-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>{t("asOfLedger", { ledger: metrics.ledger })}</span>
        </div>
      </section>
    );
  }

  // Fallback state (RPC error, timeout, or lendingId unset)
  return (
    <section data-testid="protocol-stats-fallback" className="space-y-2">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-6 text-center">
          <div className="text-3xl font-bold">{formatCompactCurrency(fallbackTvl, locale)}</div>
          <div className="mut text-sm">{t("totalSupplied")}</div>
        </div>
        <div className="card p-6 text-center">
          <div className="text-3xl font-bold">{formatCompactCurrency(fallbackBorrowed, locale)}</div>
          <div className="mut text-sm">{t("totalBorrowed")}</div>
        </div>
        <div className="card p-6 text-center">
          <div className="text-3xl font-bold">{MARKETS.length}</div>
          <div className="mut text-sm">{t("markets")}</div>
        </div>
      </div>
      <div className="flex justify-end items-center px-1">
        <span
          data-testid="demo-data-badge"
          className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-500"
        >
          {t("demoDataBadge")}
        </span>
      </div>
    </section>
  );
}
