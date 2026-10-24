"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { OracleAssetPrice, StalenessStatus } from "@/lib/oracle";
import { formatAge, formatOraclePrice } from "@/lib/oracle";

export type OraclePanelProps = {
  prices: Record<string, OracleAssetPrice>;
  timeSource: "ledger" | "browser";
  isLoading?: boolean;
};

export function OracleStatusChip({ status }: { status: StalenessStatus }) {
  const t = useTranslations("market.oracle");

  const config: Record<
    StalenessStatus,
    { label: string; bg: string; text: string; border: string }
  > = {
    fresh: {
      label: t("fresh"),
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
    },
    stale: {
      label: t("stale"),
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/30",
    },
    future: {
      label: t("future"),
      bg: "bg-purple-500/10",
      text: "text-purple-400",
      border: "border-purple-500/30",
    },
    missing: {
      label: t("missing"),
      bg: "bg-zinc-500/10",
      text: "text-zinc-400",
      border: "border-zinc-500/30",
    },
  };

  const item = config[status] ?? config.missing;

  return (
    <span
      data-testid={`status-chip-${status}`}
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${item.bg} ${item.text} ${item.border}`}
    >
      {item.label}
    </span>
  );
}

export default function OraclePanel({
  prices,
  timeSource,
  isLoading = false,
}: OraclePanelProps) {
  const t = useTranslations("market.oracle");
  const priceList = Object.values(prices);

  return (
    <div className="card space-y-4 p-5" data-testid="oracle-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="mut text-xs">{t("subtitle")}</p>
        </div>
        <div className="text-xs mut">
          <span>
            {timeSource === "ledger" ? t("timeSourceLedger") : t("timeSourceBrowser")}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="text-xs mut py-2" data-testid="oracle-loading">
          {t("loading")}
        </div>
      ) : priceList.length === 0 ? (
        <div className="text-xs mut py-2" data-testid="oracle-empty">
          {t("noOnChainPrice")}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {priceList.map((item) => {
            const hasRecord = item.price !== null && item.timestamp !== null;
            const formattedPrice = hasRecord ? `$${formatOraclePrice(item.price!)}` : null;
            const ageDisplay = hasRecord ? formatAge(item.ageSeconds) : null;
            const hasBounds = item.bounds.min !== null || item.bounds.max !== null;

            return (
              <div
                key={item.assetId}
                data-testid={`oracle-card-${item.assetId}`}
                className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-medium">{item.assetId.slice(0, 8)}...{item.assetId.slice(-6)}</span>
                  <OracleStatusChip status={item.status} />
                </div>

                <div>
                  <div className="text-xs mut">{t("oracleSource")}</div>
                  <div className="text-xl font-bold mt-0.5">
                    {formattedPrice ?? t("noOnChainPrice")}
                  </div>
                </div>

                {hasRecord && (
                  <div className="text-xs mut">
                    {t("updatedAgo", { time: ageDisplay ?? "" })}
                  </div>
                )}

                {item.status === "stale" && (
                  <div className="rounded bg-amber-500/10 border border-amber-500/20 p-2 text-xs text-amber-300">
                    {t("staleWarning")}
                  </div>
                )}

                {item.status === "future" && (
                  <div className="rounded bg-purple-500/10 border border-purple-500/20 p-2 text-xs text-purple-300">
                    {t("futureWarning")}
                  </div>
                )}

                <div className="border-t border-[var(--line)] pt-2 text-xs text-[var(--muted)]">
                  <div className="font-medium mb-1">{t("bounds")}</div>
                  {hasBounds ? (
                    <div className="flex justify-between">
                      <span>
                        {item.bounds.min !== null
                          ? t("min", { price: `$${formatOraclePrice(item.bounds.min)}` })
                          : "Min: —"}
                      </span>
                      <span>
                        {item.bounds.max !== null
                          ? t("max", { price: `$${formatOraclePrice(item.bounds.max)}` })
                          : "Max: —"}
                      </span>
                    </div>
                  ) : (
                    <span>{t("noBounds")}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
