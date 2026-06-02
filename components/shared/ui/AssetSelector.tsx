"use client";

import { AssetInfo } from "@/lib/assets";
import { cn } from "@/lib/utils/cn";

interface AssetSelectorProps {
  assets: AssetInfo[];
  value: string;
  onChange: (asset: string) => void;
  showBalance?: boolean;
  interestRates?: Record<string, number>;
  label?: string;
}

const TOKEN_COLORS: Record<string, string> = {
  XLM: "bg-blue-500",
  USDC: "bg-green-500",
  BTC: "bg-orange-500",
  ETH: "bg-purple-500",
};

export default function AssetSelector({
  assets,
  value,
  onChange,
  showBalance = true,
  interestRates,
  label,
}: AssetSelectorProps) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-3">
          {label}
        </label>
      )}

      <div
        role="listbox"
        aria-label={label || "Asset selector"}
        className="grid grid-cols-2 gap-4"
      >
        {assets.map((asset) => {
          const selected = value === asset.symbol;

          return (
            <button
              key={asset.symbol}
              type="button"
              role="option"
              aria-selected={selected}
              tabIndex={0}
              onClick={() => onChange(asset.symbol)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange(asset.symbol);
                }
              }}
              className={cn(
                "p-4 rounded-xl border-2 transition-all text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
                selected
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full",
                      TOKEN_COLORS[asset.symbol],
                    )}
                  />

                  <span className="font-bold">{asset.symbol}</span>
                </div>

                {interestRates?.[asset.symbol] && (
                  <span className="text-xs font-semibold text-blue-600">
                    {interestRates[asset.symbol]}% APR
                  </span>
                )}
              </div>

              <div className="text-xs text-gray-500">{asset.name}</div>

              {showBalance && (
                <div className="text-xs text-gray-500 mt-1">
                  Balance: {asset.balance.toLocaleString()}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
