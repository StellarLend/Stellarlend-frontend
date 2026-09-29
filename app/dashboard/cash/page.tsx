"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components";
import { PageHeader } from "@/components/shared/common";
import { Transactions } from "@/components/shared/common/Transaction";
import TransactionFilters from "@/components/features/dashboard/components/TransactionFilters";
import { TransactionsSummaryHeader } from "@/components/features/dashboard/components";
import { useTransactionSummary } from "@/hooks/useTransactionSummary";

export default function CashPage() {
  const [totalCount, setTotalCount] = useState(0);
  const { inflow, outflow, net, isLoading } = useTransactionSummary();

  return (
    <DashboardLayout>
      <div className="md:pt-10 md:border-t px-6 md:px-12">
        <PageHeader
          title="Cash &amp; Receipts"
          description="View and export your full transaction receipt history."
        />
      </div>

      <div className="px-6 md:px-12 mt-4">
        <TransactionFilters totalCount={totalCount} />
      </div>

      <TransactionsSummaryHeader
        inflow={inflow}
        outflow={outflow}
        net={net}
        isLoading={isLoading}
      />

      <Transactions infiniteScroll hideToolbar onDataLoad={setTotalCount} />
    </DashboardLayout>
  );
}
