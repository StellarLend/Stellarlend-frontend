import React, { useMemo } from "react";
import {
  calculateProjectedBorrowHealth,
  getHealthBand,
  getHealthLabel,
  MINIMUM_COLLATERAL_RATIO,
  type PriceMap,
} from "@/lib/lending/health";
import { computeRiskScore } from "@/lib/positions/liquidation";
import { cn } from "@/lib/utils/cn";

export interface LeverageSliderProps {
  value: number;
  onChange: (value: number) => void;
  collateralAmount: number;
  collateralAsset: string;
  borrowAsset: string;
  borrowApr?: number;
  prices: PriceMap;
}

export function LeverageSlider({
  value,
  onChange,
  collateralAmount,
  collateralAsset,
  borrowAsset,
  borrowApr = 0,
  prices,
}: LeverageSliderProps) {
  // Memoize all expensive calculations derived from the slider value or props
  const projection = useMemo(() => {
    // Max borrow limit: if we allow the user to borrow such that collateral = borrow * 1.0
    // Actually, "max safe borrow" means health factor = 1.0 (at liquidation threshold)
    // To cover "undercollateralised projection", we can let max borrow be where health factor = 0.9.
    // Or we just calculate the max borrow where loanValueUsd = collateralValueUsd
    const borrowPrice = prices[borrowAsset];
    const collateralPrice = prices[collateralAsset];
    let maxBorrow = 0;

    if (
      collateralAmount > 0 &&
      borrowPrice &&
      borrowPrice > 0 &&
      collateralPrice &&
      collateralPrice > 0
    ) {
      const collateralValueUsd = collateralAmount * collateralPrice;
      // To show some undercollateralized state, max borrow = collateralValue / borrowPrice (so LTV = 100%)
      maxBorrow = collateralValueUsd / (borrowPrice * (1 + borrowApr / 100));
    }

    const healthPreview = calculateProjectedBorrowHealth({
      loanAmount: value,
      borrowAsset,
      collateralAmount,
      collateralAsset,
      prices,
      borrowApr,
    });

    const riskScore = healthPreview
      ? computeRiskScore(healthPreview.healthFactor)
      : 0;
    
    return {
      maxBorrow,
      healthPreview,
      riskScore,
    };
  }, [value, borrowAsset, collateralAmount, collateralAsset, prices, borrowApr]);

  const { maxBorrow, healthPreview, riskScore } = projection;

  if (collateralAmount <= 0 || maxBorrow <= 0) {
    return null; // Do not show slider if no collateral or prices are missing
  }

  const hf = healthPreview?.healthFactor ?? Infinity;
  const hfLabel = Number.isFinite(hf) ? hf.toFixed(2) : "∞";
  const healthBand = getHealthBand(hf);
  const healthStatus = getHealthLabel(hf);
  const liqPrice = healthPreview?.liquidationPrice ?? 0;

  // Track colors based on risk
  const trackColor =
    healthBand === "healthy" || healthBand === "cleared"
      ? "bg-emerald-500"
      : healthBand === "at-risk"
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="w-full space-y-3 py-2">
      <div className="flex justify-between items-center text-sm">
        <label htmlFor="leverage-slider" className="font-semibold text-gray-700">
          What-if Leverage
        </label>
        <div className="text-xs text-gray-500">
          Max: {maxBorrow.toFixed(4)} {borrowAsset}
        </div>
      </div>

      <input
        id="leverage-slider"
        type="range"
        min={0}
        max={maxBorrow}
        step={maxBorrow / 100 || 0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn("w-full h-2 rounded-lg appearance-none cursor-pointer", trackColor)}
        style={{
          background: `linear-gradient(to right, currentColor ${(value / maxBorrow) * 100}%, #e5e7eb ${(value / maxBorrow) * 100}%)`
        }}
        aria-valuetext={`Projected health factor: ${hfLabel} (${healthStatus})`}
        title={`Drag to simulate borrow amount. Risk Score: ${(riskScore * 100).toFixed(0)}%`}
      />

      <div className="flex justify-between items-center text-xs text-gray-600">
        <div>
          <span className="font-medium text-gray-500">Proj. Health:</span>{" "}
          <span
            className={cn(
              "font-bold",
              healthBand === "healthy" || healthBand === "cleared"
                ? "text-emerald-600"
                : healthBand === "at-risk"
                ? "text-amber-600"
                : "text-red-600"
            )}
          >
            {hfLabel}
          </span>
        </div>
        <div>
          <span className="font-medium text-gray-500">Proj. Liq. Price:</span>{" "}
          <span className="font-bold text-gray-900">${liqPrice.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
