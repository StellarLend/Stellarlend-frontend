import LiquidityPanel from "@/components/amm/liquidity-panel";
import SwapQuotePanel from "@/components/amm/swap-quote";
import { PageShell } from "@/components/page-shell";

export const metadata = { title: "AMM Pool & Swap - StellarLend" };

export default async function AmmPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return (
    <PageShell locale={locale}>
      <div className="space-y-8">
        <SwapQuotePanel />
        <LiquidityPanel />
      </div>
    </PageShell>
  );
}
