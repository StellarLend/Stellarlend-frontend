"use client";

import { Skeleton } from "@/components/shared/common/Skeleton";
import { formatCurrency } from "@/lib/utils/format";
import { getAsset } from "@/lib/assets/registry";
import type { CollateralShare } from "@/hooks/usePositions";

interface CollateralBreakdownProps {
  shares: CollateralShare[];
  isLoading: boolean;
}

export function CollateralBreakdown({ shares, isLoading }: CollateralBreakdownProps) {
  if (isLoading) {
    return (
      <div aria-label="Loading collateral breakdown" aria-busy="true" className="mt-6 space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (!shares.length) {
    return (
      <div className="mt-6 text-center py-4" role="status" aria-label="No collateral">
        <p className="text-[#AAABAB] text-sm">No collateral posted</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h4 className="text-[#D4F3E6] text-xs font-semibold uppercase tracking-wide mb-3">
        Collateral Breakdown
      </h4>
      <table className="w-full text-sm" aria-label="Collateral allocation breakdown">
        <thead>
          <tr className="text-[#AAABAB] text-xs">
            <th scope="col" className="text-left pb-2 font-medium">Asset</th>
            <th scope="col" className="text-right pb-2 font-medium">USD Value</th>
            <th scope="col" className="text-right pb-2 font-medium">Share</th>
          </tr>
        </thead>
        <tbody>
          {shares.map(({ asset, usdValue, share }) => {
            const meta = getAsset(asset);
            const label = meta ? meta.name : asset;
            return (
              <tr
                key={asset}
                className="border-t border-[#71B48D22] focus-within:bg-[#071e0f]"
                tabIndex={0}
                aria-label={`${label}: $${formatCurrency(usdValue)}, ${share}%`}
              >
                <td className="py-2 text-white font-medium">{asset}</td>
                <td className="py-2 text-right text-[#D4F3E6] font-mono">
                  ${formatCurrency(usdValue)}
                </td>
                <td className="py-2 text-right text-[#AAABAB]">
                  {share}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default CollateralBreakdown;
