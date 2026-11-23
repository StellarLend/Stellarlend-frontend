import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PoolOverview } from "@/components/amm/pool-overview";
import LiquidityPanel from "@/components/amm/liquidity-panel";
import SwapQuotePanel from "@/components/amm/swap-quote";
import { PageShell } from "@/components/page-shell";
import { defaultLocale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: defaultLocale, namespace: "meta.amm" });

  return buildMetadata({
    locale: defaultLocale,
    path: "/amm",
    title: t("title"),
    description: t("description"),
  });
}

export default function AmmPage() {
  return (
    <PageShell>
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
