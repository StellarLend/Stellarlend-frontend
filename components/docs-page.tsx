"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatPercentFromBps } from "@/lib/format";
import { getStaticDocsData, type DocsData } from "@/lib/docs-data";
import type { ParamSource } from "@/lib/markets";
import { Section } from "@/components/ui/section";

export interface DocsPageProps {
  data?: DocsData;
}

function SourceBadge({
  source,
  chainLabel,
  demoLabel,
}: {
  source: ParamSource;
  chainLabel: string;
  demoLabel: string;
}) {
  const isChain = source === "chain";
  return (
    <span
      data-source={source}
      className={
        isChain
          ? "inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-300"
          : "inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] text-amber-300"
      }
    >
      {isChain ? chainLabel : demoLabel}
    </span>
  );
}

export function DocsPage({ data }: DocsPageProps) {
  const t = useTranslations("docs");
  const locale = useLocale();
  const flashLoansHref = locale === "es" ? "/es/flash-loans" : "/flash-loans";
  const docsData = data ?? getStaticDocsData();

  const chainBadgeLabel = t("sourceBadge.chain");
  const demoBadgeLabel = t("sourceBadge.demo");

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>{t("riskParameters.body")}</p>
          <SourceBadge
            source={docsData.source}
            chainLabel={chainBadgeLabel}
            demoLabel={demoBadgeLabel}
          />
        </div>

        {docsData.rpcFailed && (
          <p
            role="status"
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
          >
            {t("riskParameters.rpcFallbackNote")}
          </p>
        )}

        <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--line)] bg-zinc-900/50 uppercase mut">
              <tr>
                <th className="p-3">{t("riskParameters.asset")}</th>
                <th className="p-3">{t("riskParameters.maxLtv")}</th>
                <th className="p-3">{t("riskParameters.liquidationThreshold")}</th>
                <th className="p-3">{t("riskParameters.supplyCap")}</th>
                <th className="p-3">{t("riskParameters.borrowCap")}</th>
                <th className="p-3">{t("riskParameters.supplyApy")}</th>
                <th className="p-3">{t("riskParameters.borrowApy")}</th>
                <th className="p-3">{t("riskParameters.minBorrow")}</th>
                <th className="p-3">{t("riskParameters.source")}</th>
              </tr>
            </thead>
            <tbody>
              {docsData.markets.map((m) => (
                <tr key={m.symbol} className="border-b border-[var(--line)] last:border-0">
                  <td className="p-3 font-medium">{m.symbol}</td>
                  <td className="p-3 font-mono">{formatPercentFromBps(m.ltvBps)}</td>
                  <td className="p-3 font-mono">{formatPercentFromBps(m.liqThresholdBps)}</td>
                  <td className="p-3 font-mono">{m.supplyCap ?? t("riskParameters.uncapped")}</td>
                  <td className="p-3 font-mono">{m.borrowCap ?? t("riskParameters.uncapped")}</td>
                  <td className="p-3 font-mono">{formatPercentFromBps(m.supplyApyBps)}</td>
                  <td className="p-3 font-mono">{formatPercentFromBps(m.borrowApyBps)}</td>
                  <td className="p-3 font-mono">{m.minBorrow ?? t("riskParameters.notSet")}</td>
                  <td className="p-3">
                    <SourceBadge
                      source={m.source}
                      chainLabel={chainBadgeLabel}
                      demoLabel={demoBadgeLabel}
                    />
                  </td>
                </tr>
              ))}
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
        <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--line)] bg-zinc-900/50 uppercase mut">
              <tr>
                <th className="p-3">{t("contracts.contract")}</th>
                <th className="p-3">{t("contracts.address")}</th>
                <th className="p-3">{t("contracts.source")}</th>
              </tr>
            </thead>
            <tbody>
              {docsData.contracts.map((c) => (
                <tr key={c.key} className="border-b border-[var(--line)] last:border-0">
                  <td className="p-3 font-medium">{t(`contracts.names.${c.key}`)}</td>
                  <td className="p-3 break-all font-mono">
                    {c.contractId && c.explorerUrl ? (
                      <a
                        className="break-all underline"
                        href={c.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {c.contractId}
                      </a>
                    ) : (
                      t("contracts.notDeployed")
                    )}
                  </td>
                  <td className="p-3">
                    <SourceBadge
                      source={c.source}
                      chainLabel={chainBadgeLabel}
                      demoLabel={demoBadgeLabel}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section contentClassName="mut space-y-3 text-sm leading-relaxed" title={t("env.title")}>
        <ul className="list-disc space-y-1 pl-5 font-mono text-xs">
          {[
            "NEXT_PUBLIC_STELLAR_NETWORK",
            "NEXT_PUBLIC_HORIZON_URL",
            "NEXT_PUBLIC_SOROBAN_RPC_URL",
            "NEXT_PUBLIC_LENDING_CONTRACT_ID",
            "NEXT_PUBLIC_ORACLE_CONTRACT_ID",
            "NEXT_PUBLIC_TOKEN_CONTRACT_ID",
            "NEXT_PUBLIC_MULTISIG_CONTRACT_ID",
            "NEXT_PUBLIC_AMM_CONTRACT_ID",
            "NEXT_PUBLIC_AMM_TOKEN_A_CONTRACT_ID",
            "NEXT_PUBLIC_AMM_TOKEN_B_CONTRACT_ID",
            "NEXT_PUBLIC_AMM_TOKEN_A_HORIZON_ASSET",
            "NEXT_PUBLIC_AMM_TOKEN_B_HORIZON_ASSET",
            "NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE",
            "NEXT_PUBLIC_SOROBAN_RPC_FALLBACK_URLS",
            "NEXT_PUBLIC_XLM_ASSET_ADDRESS",
            "NEXT_PUBLIC_USDC_ASSET_ADDRESS",
            "NEXT_PUBLIC_EURC_ASSET_ADDRESS",
            "NEXT_PUBLIC_BTC_ASSET_ADDRESS",
            "NEXT_PUBLIC_SITE_URL",
            "NEXT_PUBLIC_CSP_REPORT_URI",
            "NEXT_PUBLIC_ERROR_ENDPOINT",
            "NEXT_PUBLIC_ORACLE_MAX_AGE_SECONDS",
            "NEXT_PUBLIC_USDC_ISSUER",
            "NEXT_PUBLIC_EURC_ISSUER",
            "NEXT_PUBLIC_BTC_ISSUER",
          ].map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </Section>
    </article>
  );
}
