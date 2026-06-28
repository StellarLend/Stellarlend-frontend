"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import usePriceStream from "@/hooks/usePriceStream";
import type { PricedAsset, PriceDirection } from "@/hooks/usePriceStream";

function formatPrice(price: number): string {
  if (price < 1) {
    return price.toFixed(4);
  }
  if (price < 100) {
    return price.toFixed(2);
  }
  return price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function DirectionIndicator({
  direction,
  className,
}: {
  direction: PriceDirection;
  className?: string;
}) {
  const baseClasses = "inline-block h-2 w-2 rounded-full";

  if (direction === "up") {
    return (
      <span
        className={cn(baseClasses, "bg-green-500")}
        aria-label="price increased"
      />
    );
  }

  if (direction === "down") {
    return (
      <span
        className={cn(baseClasses, "bg-red-500")}
        aria-label="price decreased"
      />
    );
  }

  return (
    <span
      className={cn(baseClasses, "bg-slate-300")}
      aria-label="price unchanged"
    />
  );
}

export interface PriceTickerProps {
  className?: string;
}

export const PriceTicker: React.FC<PriceTickerProps> = ({ className }) => {
  const { prices, isLoading } = usePriceStream();
  const prefersReducedMotion = useReducedMotion();

  const sortedAssets = useMemo(() => {
    return Array.from(prices.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
  }, [prices]);

  if (isLoading && prices.size === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-4 text-sm text-slate-500",
          className,
        )}
        aria-label="Loading live prices"
      >
        <span className="animate-pulse">Loading prices...</span>
      </div>
    );
  }

  if (prices.size === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-4 text-sm text-slate-500",
          className,
        )}
        aria-label="No price data available"
      >
        <span>No prices available</span>
      </div>
    );
  }

  return (
    <nav
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-2 text-sm",
        prefersReducedMotion ? "" : "transition-opacity duration-300",
        className,
      )}
      aria-label="Live market prices"
    >
      {sortedAssets.map(([symbol, data]) => (
        <div
          key={symbol}
          className="flex items-center gap-2"
          aria-label={`${symbol} price: ${formatPrice(data.price)}`}
        >
          <span className="font-medium text-slate-900">{symbol}</span>
          <span className="text-slate-700">{formatPrice(data.price)}</span>
          <DirectionIndicator direction={data.direction} />
        </div>
      ))}
    </nav>
  );
};

export default PriceTicker;