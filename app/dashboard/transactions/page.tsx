"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components";
import { TransactionExportButton } from "@/components/features/dashboard/components/TransactionExportButton";
import TransactionFilters from "@/components/features/dashboard/components/TransactionFilters";
import FilterPresets from "@/components/features/dashboard/components/FilterPresets";
import { TransactionsSummaryHeader } from "@/components/features/dashboard/components";
import { Transactions } from "@/components/shared/common/Transaction";
import { PageHeader } from "@/components/shared/common";
import { useTransactionSummary } from "@/hooks/useTransactionSummary";
import { isAssetSymbol, isTransactionStatus } from "@/types/enums";
import {
  TRANSACTION_TYPES,
  type TransactionFilter,
} from "@/lib/transactions/filters";

/**
 * Upper bound on the free-text `search` filter accepted from the URL. Longer
 * values are truncated instead of being forwarded verbatim, so a hostile or
 * accidentally oversized query string cannot inflate the export request or the
 * downstream API/DOM work.
 */
export const MAX_SEARCH_LENGTH = 100;

const ALLOWED_FILTER_TYPES = new Set<string>(TRANSACTION_TYPES);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True only for a calendar-valid `YYYY-MM-DD` string (rejects `2025-02-30`). */
function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/**
 * Normalises the dashboard URL query string into a filter object that is safe
 * to forward to the transactions API and CSV export.
 *
 * Invariants (invalid input is dropped, never forwarded — fail closed):
 * - `status` must be a canonical `TransactionStatus` (`Completed` |
 *   `Processing` | `Failed`).
 * - `type` must be one of the lowercase filter types the API accepts.
 * - `asset` is upper-cased and must be a supported asset symbol.
 * - `fromDate` / `toDate` must be calendar-valid `YYYY-MM-DD` values.
 * - `search` is trimmed and truncated to {@link MAX_SEARCH_LENGTH}.
 * - Duplicate query keys resolve to the first value, matching
 *   `URLSearchParams.get` semantics.
 */
export function normaliseTransactionFilters(
  params: URLSearchParams
): TransactionFilter {
  const filters: TransactionFilter = {};

  const status = params.get("status");
  if (status && isTransactionStatus(status)) {
    filters.status = status;
  }

  const type = params.get("type");
  if (type && ALLOWED_FILTER_TYPES.has(type)) {
    filters.type = type;
  }

  const asset = params.get("asset");
  if (asset) {
    const upper = asset.trim().toUpperCase();
    if (isAssetSymbol(upper)) {
      filters.asset = upper;
    }
  }

  const fromDate = params.get("fromDate");
  if (fromDate && isValidIsoDate(fromDate)) {
    filters.fromDate = fromDate;
  }

  const toDate = params.get("toDate");
  if (toDate && isValidIsoDate(toDate)) {
    filters.toDate = toDate;
  }

  const search = params.get("search");
  if (search) {
    const trimmed = search.trim().slice(0, MAX_SEARCH_LENGTH);
    if (trimmed) {
      filters.search = trimmed;
    }
  }

  return filters;
}

export default function TransactionsPage() {
  const [totalCount, setTotalCount] = useState(0);
  const { inflow, outflow, net, isLoading } = useTransactionSummary();
  const searchParams = useSearchParams();

  // Derive from the serialised query string so the filter object keeps a stable
  // identity across re-renders that do not change the URL, and so every
  // consumer sees the same sanitised values.
  const searchParamsKey = searchParams.toString();
  const filters = useMemo(
    () => normaliseTransactionFilters(new URLSearchParams(searchParamsKey)),
    [searchParamsKey]
  );

  // The export control consumes `dateFrom`/`dateTo` (its public view-model)
  // while the URL uses `fromDate`/`toDate`; translate so the CSV export honours
  // exactly the same validated filters the table is showing.
  const exportFilters = useMemo(
    () => ({
      status: filters.status,
      type: filters.type,
      asset: filters.asset,
      search: filters.search,
      dateFrom: filters.fromDate,
      dateTo: filters.toDate,
    }),
    [filters]
  );

  /**
   * Guards the count reported by the table before it reaches the UI. A
   * missing, negative, fractional, or non-finite total must never surface as
   * e.g. "Showing -1 results"; the callback identity is stable so the table's
   * data-loading effect does not re-run on every render.
   */
  const handleDataLoad = useCallback((count: number) => {
    setTotalCount(Number.isFinite(count) && count > 0 ? Math.floor(count) : 0);
  }, []);

  return (
    <DashboardLayout>
      <div className="pt-10 border-t px-6 md:px-12 ">
        <PageHeader
          title="Transactions"
          description="Review every lend, borrow, repay, and withdrawal tied to your account."
          actions={<TransactionExportButton filters={exportFilters} />}
        />
      </div>
      <div className="px-6 md:px-12 mt-4">
        <FilterPresets />
        <TransactionFilters totalCount={totalCount} />
      </div>
      <TransactionsSummaryHeader
        inflow={inflow}
        outflow={outflow}
        net={net}
        isLoading={isLoading}
      />
      <Transactions infiniteScroll hideToolbar onDataLoad={handleDataLoad} />
    </DashboardLayout>
  );
}
