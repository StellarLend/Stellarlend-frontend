"use client";

import React, { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components";
import { Transactions } from "@/components/shared/common/Transaction";
import { PageHeader } from "@/components/shared/common";
import TransactionFilters from "@/components/features/dashboard/components/TransactionFilters";
import { TransactionExportButton, TransactionsSummaryHeader } from "@/components/features/dashboard/components";
import { useTransactionSummary } from "@/hooks/useTransactionSummary";

export default function TransactionsPage() {
  const [totalCount, setTotalCount] = useState(0);
  const { inflow, outflow, net, isLoading } = useTransactionSummary();
  const searchParams = useSearchParams();

  const filters = useMemo(() => ({
    asset: searchParams.get("asset") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    dateFrom: searchParams.get("fromDate") ?? undefined,
    dateTo: searchParams.get("toDate") ?? undefined,
  }), [searchParams]);

  return (
    <DashboardLayout>
      <div className="pt-10 border-t px-6 md:px-12 ">
        <PageHeader
          title="Transactions"
          description="Review every lend, borrow, repay, and withdrawal tied to your account."
          actions={<TransactionExportButton filters={filters} />}
        />
      </div>
      <div className="px-6 md:px-12 mt-4">
        <TransactionFilters totalCount={totalCount} />
      </div>
      <TransactionsSummaryHeader inflow={inflow} outflow={outflow} net={net} isLoading={isLoading} />
      <Transactions infiniteScroll hideToolbar onDataLoad={setTotalCount} />
    </DashboardLayout>
  );
}
