import LiquidityPanel from "@/components/amm/liquidity-panel";
import { PageShell } from "@/components/page-shell";

export const metadata = { title: "AMM Liquidity - StellarLend" };

export default function AmmPage() {
  return (
    <PageShell>
      <LiquidityPanel />
    </PageShell>
  );
}
