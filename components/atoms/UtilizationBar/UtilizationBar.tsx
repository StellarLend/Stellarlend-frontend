import type { AssetMarket } from "@/lib/markets/types";
import { useMarkets } from "@/hooks/useMarkets";

export interface UtilizationBarProps {
  asset: string;
}

export function UtilizationBar({ asset }: UtilizationBarProps) {
  const { markets, isLoading } = useMarkets();
  const marketData = markets?.find(
    (market: AssetMarket) => market.asset === asset,
  );
  const utilization =
    typeof marketData?.utilization === "number"
      ? Math.max(0, Math.min(100, marketData.utilization))
      : null;

  if (isLoading) {
    return <div data-testid={`utilization-loading-${asset}`} className="h-4 w-16 bg-slate-800 animate-pulse rounded"></div>;
  }

  if (utilization === null) {
    return <div data-testid={`utilization-missing-${asset}`} className="text-xs text-slate-500">N/A</div>;
  }

  // Format percentage safely without just relying on color
  const formatPercent = (val: number) => `${val.toFixed(1)}%`;

  return (
    <div className="flex items-center gap-2" data-testid={`utilization-bar-${asset}`}>
      <div className="w-16 h-2 bg-slate-800 rounded overflow-hidden">
        <div 
          className="h-full bg-blue-500"
          style={{ width: `${utilization}%` }}
        />
      </div>
      <span className="text-xs font-mono">{formatPercent(utilization)}</span>
    </div>
  );
}
