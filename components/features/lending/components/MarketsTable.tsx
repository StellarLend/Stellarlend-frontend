"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import { EmptyState } from "@/components/shared/common/EmptyState";
import { Skeleton } from "@/components/shared/common/Skeleton";
import { ASSETS } from "@/lib/assets";
import type { AssetMarket, MarketsResponse } from "@/lib/markets/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOKEN_COLORS: Record<string, string> = {
  XLM: "bg-blue-500",
  USDC: "bg-green-500",
  BTC: "bg-orange-500",
  ETH: "bg-purple-500",
};

/** Look up the human-readable asset name from the canonical ASSETS list. */
function getAssetName(symbol: string): string {
  return ASSETS.find((a) => a.symbol === symbol)?.name ?? symbol;
}

type SortableField = keyof Pick<
  AssetMarket,
  "asset" | "supplyApr" | "borrowApr" | "utilization" | "totalSupply" | "totalBorrow"
>;

interface SortConfig {
  field: SortableField;
  direction: "asc" | "desc";
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

interface ColumnDef {
  key: SortableField;
  label: string;
  align?: "left" | "right";
  format?: (value: number | string) => string;
  sortable: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: "asset", label: "Asset", sortable: true },
  { key: "supplyApr", label: "Supply APR", align: "right", sortable: true, format: (v) => `${(v as number).toFixed(2)}%` },
  { key: "borrowApr", label: "Borrow APR", align: "right", sortable: true, format: (v) => `${(v as number).toFixed(2)}%` },
  { key: "utilization", label: "Utilization", align: "right", sortable: true, format: (v) => `${((v as number) * 100).toFixed(1)}%` },
  { key: "totalSupply", label: "Total Supplied", align: "right", sortable: true, format: (v) => `$${formatCurrency(v as number)}` },
  { key: "totalBorrow", label: "Total Borrowed", align: "right", sortable: true, format: (v) => `$${formatCurrency(v as number)}` },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortMarkets(markets: AssetMarket[], config: SortConfig): AssetMarket[] {
  return [...markets].sort((a, b) => {
    const aVal = a[config.field];
    const bVal = b[config.field];

    if (typeof aVal === "string" && typeof bVal === "string") {
      return config.direction === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    const aNum = aVal as number;
    const bNum = bVal as number;

    return config.direction === "asc" ? aNum - bNum : bNum - aNum;
  });
}

// ---------------------------------------------------------------------------
// Sortable header cell
// ---------------------------------------------------------------------------

function SortHeader({
  column,
  currentSort,
  onSort,
}: {
  column: ColumnDef;
  currentSort: SortConfig;
  onSort: (field: SortableField) => void;
}) {
  const isActive = currentSort.field === column.key;
  const Icon = isActive
    ? currentSort.direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <button
      type="button"
      onClick={() => onSort(column.key)}
      className={cn(
        "group inline-flex items-center gap-1.5 font-semibold transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded",
        column.align === "right" && "ml-auto",
        isActive ? "text-green-700" : "text-slate-500 hover:text-slate-700"
      )}
      aria-label={`Sort by ${column.label}${isActive ? ` (${currentSort.direction === "asc" ? "ascending" : "descending"})` : ""}`}
    >
      <span>{column.label}</span>
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-opacity",
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50"
        )}
        aria-hidden="true"
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Desktop skeleton table */
function MarketsTableSkeleton() {
  return (
    <div className="hidden md:block overflow-x-auto" aria-label="Loading markets">
      <table className="min-w-full text-sm" aria-busy="true">
        <thead>
          <tr className="border-b border-slate-200">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "py-3 px-4 whitespace-nowrap",
                  col.align === "right" ? "text-right" : "text-left"
                )}
              >
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 4 }, (_, i) => (
            <tr
              key={i}
              aria-hidden="true"
              className="border-b border-slate-100 last:border-0"
              style={{ opacity: 1 - i * 0.1 }}
            >
              <td className="py-4 px-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </td>
              {Array.from({ length: 5 }, (_, j) => (
                <td key={j} className="py-4 px-4 text-right">
                  <Skeleton className="h-4 w-16 ml-auto" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Mobile skeleton cards */
function MarketsCardSkeleton() {
  return (
    <div className="md:hidden space-y-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm"
          style={{ opacity: 1 - i * 0.1 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            {COLUMNS.slice(1).map((col) => (
              <div key={col.key} className={col.align === "right" ? "text-right" : ""}>
                <Skeleton className={cn("h-3 w-14 mb-1", col.align === "right" && "ml-auto")} />
                <Skeleton className={cn("h-4 w-16", col.align === "right" && "ml-auto")} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Single market row for desktop */
function MarketRow({ market }: { market: AssetMarket }) {
  const colorClass = TOKEN_COLORS[market.asset] || "bg-gray-400";

  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div className={cn("h-8 w-8 rounded-full shrink-0", colorClass)} aria-hidden="true" />
          <div className="min-w-0">
            <span className="font-semibold text-slate-900">{market.asset}</span>
            <p className="text-xs text-slate-500 mt-0.5">{getAssetName(market.asset)}</p>
          </div>
        </div>
      </td>
      {COLUMNS.slice(1).map((col) => (
        <td key={col.key} className="py-4 px-4 text-right whitespace-nowrap">
          <span className="font-medium text-slate-900">
            {col.format ? col.format(market[col.key]) : String(market[col.key])}
          </span>
        </td>
      ))}
    </tr>
  );
}

/** Single market card for mobile */
function MarketCard({ market }: { market: AssetMarket }) {
  const colorClass = TOKEN_COLORS[market.asset] || "bg-gray-400";

  return (
    <div className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("h-10 w-10 rounded-full shrink-0", colorClass)} aria-hidden="true" />
        <div>
          <span className="font-semibold text-slate-900">{market.asset}</span>
          <p className="text-xs text-slate-500">{getAssetName(market.asset)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-3 gap-x-4">
        {COLUMNS.slice(1).map((col) => (
          <div key={col.key} className={col.align === "right" ? "text-right" : ""}>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-0.5">
              {col.label}
            </span>
            <span className="text-sm font-semibold text-slate-900">
              {col.format ? col.format(market[col.key]) : String(market[col.key])}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface MarketsTableProps {
  /** Optional override for the API URL (used in tests) */
  apiUrl?: string;
}

export function MarketsTable({ apiUrl = "/api/markets" }: MarketsTableProps) {
  const [markets, setMarkets] = useState<AssetMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortConfig>({ field: "asset", direction: "asc" });

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(apiUrl);
      if (!res.ok) {
        throw new Error(`Failed to fetch market data (status ${res.status})`);
      }
      const data: MarketsResponse = await res.json();
      setMarkets(data.markets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  const sortedMarkets = useMemo(
    () => sortMarkets(markets, sort),
    [markets, sort]
  );

  const handleSort = useCallback(
    (field: SortableField) => {
      setSort((prev) => ({
        field,
        direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
      }));
    },
    []
  );

  // ── Loading state ──
  if (loading) {
    return (
      <div data-testid="markets-loading">
        <MarketsTableSkeleton />
        <MarketsCardSkeleton />
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div data-testid="markets-error">
        <EmptyState
          title="Unable to load markets"
          description={error}
          actionLabel="Retry"
          onAction={fetchMarkets}
        />
      </div>
    );
  }

  // ── Empty state ──
  if (markets.length === 0) {
    return (
      <div data-testid="markets-empty">
        <EmptyState
          title="No markets available"
          description="There are no supported assets to display at this time."
        />
      </div>
    );
  }

  // ── Data state ──
  return (
    <div data-testid="markets-table">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "py-3 px-4 whitespace-nowrap",
                    col.align === "right" ? "text-right" : "text-left"
                  )}
                >
                  <SortHeader column={col} currentSort={sort} onSort={handleSort} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedMarkets.map((market) => (
              <MarketRow key={market.asset} market={market} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {sortedMarkets.map((market) => (
          <MarketCard key={market.asset} market={market} />
        ))}
      </div>
    </div>
  );
}

export default MarketsTable;
