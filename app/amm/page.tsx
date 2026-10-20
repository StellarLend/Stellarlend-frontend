import LiquidityPanel from "@/components/amm/liquidity-panel";
import SwapQuotePanel from "@/components/amm/swap-quote";
import { PageShell } from "@/components/page-shell";

export const metadata = { title: "AMM Pool & Swap - StellarLend" };

export default function AmmPage() {
  return (
    <PageShell>
      <div className="space-y-8">
        <SwapQuotePanel />
        <LiquidityPanel />
      </div>
    </PageShell>
  );
}
