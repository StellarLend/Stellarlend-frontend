"use client";

import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { config, explorer } from "@/lib/config";
import { MARKETS, formatPercent, type Locale, type Market } from "@/lib/markets";
import { fetchLiveMarketParams, bpsToPercent } from "@/lib/market-params";
import { Section } from "@/components/ui/section";

export function DocsPage() {
  const t = useTranslations("docs");
  const locale = useLocale();
  const flashLoansHref = locale === "es" ? "/es/flash-loans" : "/flash-loans";
  const [markets, setMarkets] = useState<Market[]>(MARKETS);

  useEffect(() => {
    let active = true;
    fetchLiveMarketParams(MARKETS)
      .then((live) => {
        if (active) setMarkets(live);
      })
      .catch(() => {
        // keep defaults
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <h1 className="text-4xl font-bold">{t("title")}</h1>

      <Section contentClassName="mut space-y-3 text-sm leading-relaxed" title={t("overview.title")}>
        <p>{t("overview.body")}</p>
      </Section>

      <Section contentClassName="mut space-y-3 text-sm leading-relaxed" title={t("gettingStarted.title")}>
        <ol className="list-decimal space-y-1 pl-5">
          <li>{t("gettingStarted.step1")}</li>
          <li>
            {t("gettingStarted.step2")}{" "}
            <a
              href="https://laboratory.stellar.org/#account-creator"
              target="_blank"
              rel="noreferrer"
              className="underline text-blue-400 hover:text-blue-300"
            >
              (Stellar Laboratory Friendbot)
            </a>
          </li>
          <li>{t("gettingStarted.step3")}</li>
          <li>{t("gettingStarted.step4")}</li>
        </ol>
      </Section>

      <Section contentClassName="mut space-y-3 text-sm leading-relaxed" title={t("riskParameters.title")}>
        <p>{t("riskParameters.body")}</p>
        <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--line)] bg-zinc-900/50 uppercase mut">
              <tr>
                <th className="p-3">{t("riskParameters.asset")}</th>
                <th className="p-3">{t("riskParameters.maxLtv")}</th>
                <th className="p-3">{t("riskParameters.liquidationThreshold")}</th>
                <th className="p-3">{t("riskParameters.supplyCap")}</th>
                <th className="p-3">{t("riskParameters.minBorrow")}</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((m) => {
                const ltvVal = m.ltvBps !== undefined ? bpsToPercent(m.ltvBps) : m.ltv * 100;
                const liqVal = m.liqThresholdBps !== undefined ? bpsToPercent(m.liqThresholdBps) : 80;
                const capStr = !m.supplyCap || m.supplyCap === BigInt(0) ? t("riskParameters.uncapped") : m.supplyCap.toString();
                const minBorrowStr = m.minBorrow ? `${m.minBorrow.toString()} stroops` : "1.0";

                return (
                  <tr key={m.symbol} className="border-b border-[var(--line)] last:border-0">
                    <td className="p-3 font-medium">
                      {m.symbol} <span className="mut">({m.sources?.ltv ?? "demo"})</span>
                    </td>
                    <td className="p-3">{formatPercent(ltvVal, locale as Locale)}</td>
                    <td className="p-3">{formatPercent(liqVal, locale as Locale)}</td>
                    <td className="p-3 font-mono">{capStr}</td>
                    <td className="p-3 font-mono">{minBorrowStr}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section contentClassName="mut space-y-3 text-sm leading-relaxed" title={t("flashLoans.title")}>
        <p>{t("flashLoans.body")}</p>
        <p>
          <a className="underline" href={flashLoansHref}>{t("flashLoans.link")}</a>
        </p>
      </Section>

      <Section contentClassName="mut space-y-3 text-sm leading-relaxed" title={t("architecture.title")}>
        <p>{t("architecture.body")}</p>
      </Section>

      <Section contentClassName="mut space-y-3 text-sm leading-relaxed" title={t("contracts.title")}>
        <ul className="space-y-1 break-all font-mono text-xs">
          <li>
            {t("contracts.label")}: {config.lendingId ? (
              <a className="break-all underline" href={explorer(config.lendingId)} target="_blank" rel="noreferrer">
                {config.lendingId}
              </a>
            ) : (
              t("contracts.notDeployed")
            )}
          </li>
        </ul>
      </Section>

      <Section contentClassName="mut space-y-3 text-sm leading-relaxed" title={t("env.title")}>
        <ul className="list-disc space-y-1 pl-5 font-mono text-xs">
          {[
            "NEXT_PUBLIC_STELLAR_NETWORK",
            "NEXT_PUBLIC_HORIZON_URL",
            "NEXT_PUBLIC_SOROBAN_RPC_URL",
            "NEXT_PUBLIC_LENDING_CONTRACT_ID",
          ].map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </Section>
    </article>
  );
}
