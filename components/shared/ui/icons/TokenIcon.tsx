"use client";

import React, { Suspense, lazy } from "react";

/**
 * Token icon registry — lazy-loaded so only the icons actually rendered
 * end up in the initial route bundle. Each icon is code-split into its
 * own chunk via React.lazy + dynamic import.
 */
const ICON_IMPORTS: Record<string, () => Promise<{ default: React.ComponentType<{ className?: string }> }>> = {
  XLM: () => import("./tokens/XLM"),
  USDC: () => import("./tokens/USDC"),
  BTC: () => import("./tokens/BTC"),
  ETH: () => import("./tokens/ETH"),
};

interface TokenIconProps {
  symbol: string;
  className?: string;
}

/** Lightweight placeholder shown while the icon chunk loads. */
function TokenIconPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded-full ${className ?? "w-6 h-6"}`}
      aria-hidden="true"
    />
  );
}

/**
 * Lazy-loaded token icon. Falls back to a colored circle if no icon
 * is registered for the symbol (graceful degradation).
 */
export function TokenIcon({ symbol, className }: TokenIconProps) {
  const importFn = ICON_IMPORTS[symbol];

  if (!importFn) {
    // Fallback: colored circle (no chunk loaded)
    return (
      <div
        className={`w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 ${className ?? ""}`}
        aria-label={`${symbol} icon`}
      />
    );
  }

  const LazyIcon = lazy(importFn);

  return (
    <Suspense fallback={<TokenIconPlaceholder className={className} />}>
      <LazyIcon className={className} />
    </Suspense>
  );
}
