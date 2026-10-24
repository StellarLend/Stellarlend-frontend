import { PoolOverview } from "@/components/amm/pool-overview";
import LiquidityPanel from "@/components/amm/liquidity-panel";
import { PageShell } from "@/components/page-shell";

export const metadata = { title: "AMM Pool & Liquidity - StellarLend" };

export default async function AmmPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return (
    <PageShell locale={locale}>
      <div className="space-y-12">
        <PoolOverview />
        <div className="border-t border-[var(--line)] pt-8">
          <LiquidityPanel />
        </div>
      </div>
    </PageShell>
  );
}
