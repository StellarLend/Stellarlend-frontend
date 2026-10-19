"use client";

import React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { MARKETS, formatCompactCurrency, type Locale } from "@/lib/markets";

export function HomePage() {
  const locale = useLocale() as Locale;
  const t = useTranslations("home");
  const tvl = MARKETS.reduce((sum, market) => sum + market.totalSupply * market.price, 0);
  const borrowed = MARKETS.reduce((sum, market) => sum + market.totalBorrow * market.price, 0);
  const marketsHref = locale === "es" ? "/es/markets" : "/markets";
  const docsHref = locale === "es" ? "/es/docs" : "/docs";

  return (
    <div className="space-y-16">
      <section className="pt-8 text-center">
        <p className="mb-4 inline-block rounded-full border border-[var(--line)] px-3 py-1 text-xs mut">{t("eyebrow")}</p>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">
          {t("title", { brand: t("brand") })}
        </h1>
        <p className="mx-auto mt-5 max-w-xl mut">{t("subtitle")}</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href={marketsHref} className="btn">{t("launchApp")}</Link>
          <Link href={docsHref} className="btn-ghost">{t("readDocs")}</Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          [t("totalSupplied"), formatCompactCurrency(tvl, locale)],
          [t("totalBorrowed"), formatCompactCurrency(borrowed, locale)],
          [t("markets"), String(MARKETS.length)],
        ].map(([label, value]) => (
          <div key={String(label)} className="card p-6 text-center">
            <div className="text-3xl font-bold">{value}</div>
            <div className="mut text-sm">{label}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {t.raw("features").map((feature: { title: string; description: string }) => (
          <div key={feature.title} className="card p-6">
            <h3 className="font-semibold">{feature.title}</h3>
            <p className="mut mt-2 text-sm">{feature.description}</p>
          </div>
        ))}
      </section>

      <p className="text-center text-xs mut">{t("note")}</p>
    </div>
  );
}
