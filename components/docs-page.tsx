"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { config, explorer } from "@/lib/config";

const S = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-2xl font-semibold">{title}</h2>
    <div className="mut space-y-3 text-sm leading-relaxed">{children}</div>
  </section>
);

export function DocsPage() {
  const t = useTranslations("docs");

  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <h1 className="text-4xl font-bold">{t("title")}</h1>

      <S title={t("overview.title")}>
        <p>{t("overview.body")}</p>
      </S>

      <S title={t("gettingStarted.title")}>
        <ol className="list-decimal space-y-1 pl-5">
          <li>{t("gettingStarted.step1")}</li>
          <li>{t("gettingStarted.step2")}</li>
          <li>{t("gettingStarted.step3")}</li>
          <li>{t("gettingStarted.step4")}</li>
        </ol>
      </S>

      <S title={t("riskParameters.title")}>
        <p>{t("riskParameters.body")}</p>
      </S>

      <S title={t("architecture.title")}>
        <p>{t("architecture.body")}</p>
      </S>

      <S title={t("contracts.title")}>
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
      </S>

      <S title={t("env.title")}>
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
      </S>
    </article>
  );
}
