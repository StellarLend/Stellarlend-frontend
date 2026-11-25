"use client";
/**
 * MarketsTable
 *
 * The sm+ desktop table of markets. Receives already-computed display data as
 * props and fires callbacks for user interaction. Zero data-fetching.
 */

import { useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button, Card } from "@/components/ui";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  toFloat as marketToFloat,
  type Locale,
  type Market,
  type MarketPositionMap,
} from "@/lib/markets";
import { toFloat, DECIMALS } from "@/lib/demo-ledger";
import { bpsToPercent } from "@/lib/market-params";
import { type LendingPosition } from "@/lib/lending-client";
import { type Ledger } from "@/lib/demo-ledger";

// ── SourceBadge (local) ───────────────────────────────────────────────────────

function SourceBadge({
  source,
  t,
}: {
  source?: "chain" | "demo";
  t: (k: string) => string;
}) {
  if (!source) return null;
  const isChain = source === "chain";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
        isChain
          ? "bg-emerald-950/70 text-emerald-400 border border-emerald-800/60"
          : "bg-zinc-800 text-zinc-400"
      }`}
    >
      {t(source)}
    </span>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type MarketsTableProps = {
  markets: Market[];
  ledger: Ledger;
  position: LendingPosition | null;
  address: string | null | undefined;
  isUnfunded: boolean;
  onChainMode: boolean;
  loadingParams: boolean;
  balances: Record<string, { available: string; balance: string; assetType?: string }>;
  trustlineLoading: string | null;
  onTrade: (market: Market) => void;
  onAddTrustline: (market: Market) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function MarketsTable({
  markets,
  ledger,
  position,
  address,
  isUnfunded,
  onChainMode,
  loadingParams,
  balances,
  trustlineLoading,
  onTrade,
  onAddTrustline,
}: MarketsTableProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("market");

  const rows = useMemo(() => {
    return markets.map((m) => {
      const rawP =
        ledger && typeof ledger === "object" ? ledger[m.symbol] : undefined;
      const p =
        rawP &&
        typeof rawP === "object" &&
        typeof rawP.supplied === "bigint" &&
        typeof rawP.borrowed === "bigint"
          ? rawP
          : null;
      const suppliedFloat = p ? toFloat(p.supplied, m.decimals) : 0;
      const borrowedFloat = p ? toFloat(p.borrowed, m.decimals) : 0;
      const live = Boolean(m.live);
      const onchainRow =
        live && onChainMode && position
          ? `+${formatNumber(toFloat(position.collateral, DECIMALS), locale, 4)} / -${formatNumber(toFloat(position.debt, DECIMALS), locale, 4)}`
          : null;
      const isOracle = m.priceSource === "oracle";
      const ltvDisplay =
        m.ltvBps !== undefined ? bpsToPercent(m.ltvBps) : m.ltv * 100;
      const liqThresholdDisplay =
        m.liqThresholdBps !== undefined ? bpsToPercent(m.liqThresholdBps) : 80;
      const capBigInt = m.supplyCap ?? BigInt(0);
      const isUncapped = capBigInt === BigInt(0);
      const capFloat = isUncapped ? null : toFloat(capBigInt, m.decimals);
      const capacityPercent =
        capFloat && capFloat > 0
          ? Math.min(100, Math.round((m.totalSupply / capFloat) * 100))
          : 0;

      return {
        m,
        p,
        suppliedFloat,
        borrowedFloat,
        live,
        onchainRow,
        isOracle,
        ltvDisplay,
        liqThresholdDisplay,
        isUncapped,
        capacityPercent,
      };
    });
  }, [markets, ledger, position, onChainMode, locale]);

  const headers = [
    t("asset"),
    t("price"),
    t("supplyApy"),
    t("borrowApy"),
    t("ltv"),
    t("liquidationThreshold"),
    t("capacity"),
    t("totalSupplied"),
    t("yourPosition"),
    t("wallet"),
    t("trade"),
  ];

  return (
    <Card className="hidden overflow-x-auto sm:block">
      <table
        aria-label={t("title")}
        className="w-full min-w-[640px] text-left text-sm"
      >
        <thead className="mut">
          <tr className="border-b border-[var(--line)]">
            {headers.map((h) => (
              <th key={String(h)} scope="col" className="p-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={11}
                className="p-6 text-center text-sm mut"
                role="status"
              >
                {t("controls.noResults")}
              </td>
            </tr>
          ) : (
            rows.map(
              ({
                m,
                p,
                suppliedFloat,
                borrowedFloat,
                live,
                onchainRow,
                isOracle,
                ltvDisplay,
                liqThresholdDisplay,
                isUncapped,
                capacityPercent,
              }) => {
                return (
                  <tr
                    key={m.symbol}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="p-4">
                      <b>{m.symbol}</b>{" "}
                      <span className="mut">{m.name}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <span>{formatCurrency(m.price, locale)}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-medium border ${
                            isOracle
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
                          }`}
                        >
                          {isOracle
                            ? t("oracle.oracleSource")
                            : t("oracle.demoSource")}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-emerald-400">
                      {formatPercent(m.supplyApy, locale)}
                    </td>
                    <td className="p-4">{formatPercent(m.borrowApy, locale)}</td>
                    <td className="p-4">
                      {loadingParams ? (
                        <span className="inline-block h-4 w-12 animate-pulse rounded bg-zinc-800" />
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <span>{formatPercent(ltvDisplay, locale)}</span>
                          <SourceBadge source={m.sources?.ltv} t={t} />
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {loadingParams ? (
                        <span className="inline-block h-4 w-12 animate-pulse rounded bg-zinc-800" />
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <span>{formatPercent(liqThresholdDisplay, locale)}</span>
                          <SourceBadge source={m.sources?.liqThreshold} t={t} />
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {loadingParams ? (
                        <span className="inline-block h-4 w-24 animate-pulse rounded bg-zinc-800" />
                      ) : isUncapped ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="mut">{t("uncapped")}</span>
                          <SourceBadge source={m.sources?.supplyCap} t={t} />
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span>{capacityPercent}%</span>
                            <SourceBadge source={m.sources?.supplyCap} t={t} />
                          </div>
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-800">
                            <div
                              className={`h-full rounded-full ${
                                capacityPercent > 90
                                  ? "bg-rose-500"
                                  : "bg-emerald-500"
                              }`}
                              style={{ width: `${capacityPercent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {formatNumber(m.totalSupply, locale, 0)}
                    </td>
                    <td className="p-4 mut">
                      {live
                        ? onChainMode
                          ? (onchainRow ?? "-")
                          : p
                            ? `+${formatNumber(suppliedFloat, locale, 4)} / -${formatNumber(borrowedFloat, locale, 4)}`
                            : "-"
                        : "-"}
                    </td>
                    <td
                      className="p-4"
                      data-testid={`wallet-balance-${m.symbol}`}
                    >
                      {!address ? (
                        <span className="mut">-</span>
                      ) : isUnfunded ? (
                        <span className="mut text-xs">{t("unfunded")}</span>
                      ) : m.asset === "native" ? (
                        <span>
                          {balances["native"]
                            ? `${formatNumber(Number(balances["native"].available), locale, 2)} XLM`
                            : "0.00 XLM"}
                        </span>
                      ) : (() => {
                        const assetId = m.asset as { code: string; issuer: string };
                        const key = `${assetId.code}:${assetId.issuer}`;
                        const detail = balances[key] || balances[assetId.code];
                        if (detail) {
                          return (
                            <span>
                              {formatNumber(Number(detail.available), locale, 2)}{" "}
                              {m.symbol}
                            </span>
                          );
                        }
                        const isLoading = trustlineLoading === m.symbol;
                        return (
                          <button
                            className="btn-ghost text-xs px-2 py-1 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 rounded"
                            onClick={() => onAddTrustline(m)}
                            disabled={isLoading}
                            aria-label={t("addTrustline")}
                          >
                            {isLoading ? t("addingTrustline") : t("addTrustline")}
                          </button>
                        );
                      })()}
                    </td>
                    <td className="p-4 text-right">
                      {live ? (
                        <Button
                          variant="ghost"
                          aria-label={`${t("trade")} ${m.symbol}`}
                          onClick={() => onTrade(m)}
                        >
                          {t("trade")}
                        </Button>
                      ) : (
                        <span className="mut">{t("comingSoon")}</span>
                      )}
                    </td>
                  </tr>
                );
              },
            )
          )}
        </tbody>
      </table>
    </Card>
  );
}
