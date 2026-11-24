import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PoolOverview } from "@/components/amm/pool-overview";
import LiquidityPanel from "@/components/amm/liquidity-panel";
import SwapQuotePanel from "@/components/amm/swap-quote";
import { PageShell } from "@/components/page-shell";
import { buildMetadata } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta.amm" });

  return buildMetadata({
    locale,
    path: "/amm",
    title: t("title"),
    description: t("description"),
  });
}

export default async function AmmPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return (
    <PageShell locale={locale}>
      <div className="space-y-12">
        <PoolOverview />
        <SwapQuotePanel />
        <div className="border-t border-[var(--line)] pt-8">
          <LiquidityPanel />
        </div>
      </div>
    </PageShell>
  );
}
