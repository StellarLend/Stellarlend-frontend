"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import { EmptyState } from "@/components/shared/common/EmptyState";
import { Skeleton } from "@/components/shared/common/Skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
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
  | "asset"
  | "supplyApr"
  | "borrowApr"
  | "utilization"
  | "totalSupply"
  | "totalBorrow"
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
  {
    key: "supplyApr",
    label: "Supply APR",
    align: "right",
    sortable: true,
    format: (v) => `${(v as number).toFixed(2)}%`,
  },
  {
    key: "borrowApr",
    label: "Borrow APR",
    align: "right",
    sortable: true,
    format: (v) => `${(v as number).toFixed(2)}%`,
  },
  {
    key: "utilization",
    label: "Utilization",
    align: "right",
    sortable: true,
    format: (v) => `${((v as number) * 100).toFixed(1)}%`,
  },
  {
    key: "totalSupply",
    label: "Total Supplied",
    align: "right",
    sortable: true,
    format: (v) => `$${formatCurrency(v as number)}`,
  },
  {
    key: "totalBorrow",
    label: "Total Borrowed",
    align: "right",
    sortable: true,
    format: (v) => `$${formatCurrency(v as number)}`,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortMarkets(
  markets: AssetMarket[],
  config: SortConfig,
): AssetMarket[] {
  return [...markets].sort((a, b) => {
    const aVal = a[config.field];
    const bVal = b[config.field];
    const directionMultiplier = config.direction === "asc" ? 1 : -1;

    if (typeof aVal === "string" && typeof bVal === "string") {
      const comparison = aVal.localeCompare(bVal);
      return comparison === 0
        ? a.asset.localeCompare(b.asset)
        : comparison * directionMultiplier;
    }

    const aNum = aVal as number;
    const bNum = bVal as number;

    const comparison = aNum - bNum;
    return comparison === 0
      ? a.asset.localeCompare(b.asset)
      : comparison * directionMultiplier;
  });
}

function filterMarkets(markets: AssetMarket[], query: string): AssetMarket[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return markets;
  }

  return markets.filter((market) => {
    const assetName = getAssetName(market.asset).toLowerCase();
    return (
      market.asset.toLowerCase().includes(normalizedQuery) ||
      assetName.includes(normalizedQuery)
    );
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
        isActive ? "text-green-700" : "text-slate-500 hover:text-slate-700",
      )}
      aria-label={`Sort by ${column.label}${isActive ? ` (${currentSort.direction === "asc" ? "ascending" : "descending"})` : ""}`}
    >
      <span>{column.label}</span>
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-opacity",
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50",
        )}
        aria-hidden="true"
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MarketsToolbar({
  filterValue,
  resultCount,
  totalCount,
  onFilterInputChange,
  onFilterClear,
}: {
  filterValue: string;
  resultCount: number;
  totalCount: number;
  onFilterInputChange: (query: string) => void;
  onFilterClear: () => void;
}) {
  return (
    <div
      className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"
      data-testid="markets-toolbar"
    >
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Market filters</h2>
        <p className="mt-1 text-xs text-slate-500" aria-live="polite">
          Showing {resultCount} of {totalCount} markets
        </p>
      </div>
      <div className="relative w-full md:w-80">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          aria-label="Filter markets by asset"
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-500/30"
          maxLength={80}
          onChange={(event) => onFilterInputChange(event.target.value)}
          placeholder="Filter by asset or symbol"
          type="search"
          value={filterValue}
        />
        {filterValue ? (
          <button
            type="button"
            aria-label="Clear market filter"
            className="absolute right-2 top-1/2 rounded p-1 text-slate-400 transition-colors hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
            onClick={onFilterClear}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Desktop skeleton table */
function MarketsTableSkeleton() {
  return (
    <div
      className="hidden md:block overflow-x-auto"
      aria-label="Loading markets"
    >
      <table className="min-w-full text-sm" aria-busy="true">
        <thead>
          <tr className="border-b border-slate-200">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "py-3 px-4 whitespace-nowrap",
                  col.align === "right" ? "text-right" : "text-left",
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
              <div
                key={col.key}
                className={col.align === "right" ? "text-right" : ""}
              >
                <Skeleton
                  className={cn(
                    "h-3 w-14 mb-1",
                    col.align === "right" && "ml-auto",
                  )}
                />
                <Skeleton
                  className={cn("h-4 w-16", col.align === "right" && "ml-auto")}
                />
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
          <div
            className={cn("h-8 w-8 rounded-full shrink-0", colorClass)}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <span className="font-semibold text-slate-900">{market.asset}</span>
            <p className="text-xs text-slate-500 mt-0.5">
              {getAssetName(market.asset)}
            </p>
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
        <div
          className={cn("h-10 w-10 rounded-full shrink-0", colorClass)}
          aria-hidden="true"
        />
        <div>
          <span className="font-semibold text-slate-900">{market.asset}</span>
          <p className="text-xs text-slate-500">{getAssetName(market.asset)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-3 gap-x-4">
        {COLUMNS.slice(1).map((col) => (
          <div
            key={col.key}
            className={col.align === "right" ? "text-right" : ""}
          >
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-0.5">
              {col.label}
            </span>
            <span className="text-sm font-semibold text-slate-900">
              {col.format
                ? col.format(market[col.key])
                : String(market[col.key])}
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
  const [sort, setSort] = useState<SortConfig>({
    field: "asset",
    direction: "asc",
  });
  const [filterInput, setFilterInput] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const debouncedFilterInput = useDebouncedValue(filterInput, 250);

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
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  useEffect(() => {
    setFilterQuery(debouncedFilterInput);
  }, [debouncedFilterInput]);

  const sortedMarkets = useMemo(
    () => sortMarkets(markets, sort),
    [markets, sort],
  );
  const visibleMarkets = useMemo(
    () => filterMarkets(sortedMarkets, filterQuery),
    [sortedMarkets, filterQuery],
  );

  const handleSort = useCallback((field: SortableField) => {
    setSort((prev) => ({
      field,
      direction:
        prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);
  const handleFilterClear = useCallback(() => {
    setFilterInput("");
    setFilterQuery("");
  }, []);

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
      <MarketsToolbar
        filterValue={filterInput}
        resultCount={visibleMarkets.length}
        totalCount={markets.length}
        onFilterInputChange={setFilterInput}
        onFilterClear={handleFilterClear}
      />

      {visibleMarkets.length === 0 ? (
        <div data-testid="markets-filter-empty">
          <EmptyState
            title="No matching markets"
            description="Clear the filter or search for another asset symbol or name."
            actionLabel="Clear filter"
            onAction={handleFilterClear}
          />
        </div>
      ) : null}

      {/* Desktop table */}
      <div
        className={cn(
          "hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm",
          visibleMarkets.length === 0 && "hidden",
        )}
      >
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "py-3 px-4 whitespace-nowrap",
                    col.align === "right" ? "text-right" : "text-left",
                  )}
                  aria-sort={
                    sort.field === col.key
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <SortHeader
                    column={col}
                    currentSort={sort}
                    onSort={handleSort}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleMarkets.map((market) => (
              <MarketRow key={market.asset} market={market} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div
        className={cn(
          "md:hidden space-y-3",
          visibleMarkets.length === 0 && "hidden",
        )}
      >
        {visibleMarkets.map((market) => (
          <MarketCard key={market.asset} market={market} />
        ))}
      </div>
    </div>
  );
}

export default MarketsTable;
