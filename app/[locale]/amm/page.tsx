import LiquidityPanel from "@/components/amm/liquidity-panel";
import { PageShell } from "@/components/page-shell";

export const metadata = { title: "AMM Liquidity - StellarLend" };

export default async function AmmPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return (
    <PageShell locale={locale}>
      <LiquidityPanel />
    </PageShell>
  );
}
