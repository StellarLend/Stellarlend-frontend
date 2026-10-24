"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { SolvencyPanel, defaultSolvencyPanelLabels } from "@/components/solvency-panel";
import { Button, Card } from "@/components/ui";
import { ProtocolStats } from "@/components/protocol-stats";
import { type Locale } from "@/lib/markets";
import { readProtocolSolvency, type BadDebtWriteOffEvent, type SolvencyMetrics } from "@/lib/solvency";

export function HomePage() {
  const locale = useLocale() as Locale;
  const t = useTranslations("home");
  const [solvency, setSolvency] = React.useState<SolvencyMetrics | null>(null);
  const [writeOffs, setWriteOffs] = React.useState<BadDebtWriteOffEvent[]>([]);

  React.useEffect(() => {
    let active = true;

    void (async () => {
      const result = await readProtocolSolvency();
      if (!active) return;
      setSolvency(result.metrics);
      setWriteOffs(result.writeOffs);
    })();

    return () => {
      active = false;
    };
  }, []);

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
          <Button href={marketsHref} variant="primary">{t("launchApp")}</Button>
          <Button href={docsHref} variant="ghost">{t("readDocs")}</Button>
        </div>
      </section>

      <ProtocolStats />

      <SolvencyPanel
        metrics={solvency}
        writeOffs={writeOffs}
        compact
        labels={{
          ...defaultSolvencyPanelLabels,
          title: t("solvencyTitle"),
          insuranceFund: t("insuranceFund"),
          insuranceShare: t("insuranceShare"),
          badDebt: t("badDebt"),
          coverage: t("coverage"),
          writeOffHistory: t("writeOffHistory"),
          noWriteOffHistory: t("noWriteOffHistory"),
          socialized: t("socialized"),
        }}
      />

      <section className="grid gap-4 sm:grid-cols-2">
        {t.raw("features").map((feature: { title: string; description: string }) => (
          <Card key={feature.title} className="p-6">
            <h3 className="font-semibold">{feature.title}</h3>
            <p className="mut mt-2 text-sm">{feature.description}</p>
          </Card>
        ))}
      </section>

      <p className="text-center text-xs mut">{t("note")}</p>
    </div>
  );
}
