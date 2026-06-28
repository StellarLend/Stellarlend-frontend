"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { DashboardLayout } from "@/components";
import { Transactions } from "@/components/shared/common/Transaction";
import { IconPlaceholder } from "@/components/shared/ui/icons/IconPlaceholder";
import { PageHeader } from "@/components/shared/common";
import TransactionFilters from "@/components/features/dashboard/components/TransactionFilters";
import { TransactionsSummaryHeader } from "@/components/features/dashboard/components";
import { useTransactionSummary } from "@/hooks/useTransactionSummary";

// Lazy load Bank icon to reduce initial bundle size
const Bank = dynamic(() => import("@/components/shared/ui/icons/Bank").then(mod => ({ default: mod.Bank })), {
  loading: () => <IconPlaceholder />,
  ssr: true,
});

export default function TransactionsPage() {
  const [totalCount, setTotalCount] = useState(0);
  const { inflow, outflow, net, isLoading } = useTransactionSummary();

  return (
    <DashboardLayout>
      <div className="pt-10 border-t px-6 md:px-12 ">
        <PageHeader
          title="Transactions"
          description="Review every lend, borrow, repay, and withdrawal tied to your account."
          actions={
            <button className="bg-[#15A350] hover:bg-[#0A3D1E] text-white border border-[#71B48D] rounded-lg flex items-center justify-center gap-2 py-3 px-6 font-semibold transition-colors">
              <Bank />
              <span>Export CSV</span>
            </button>
          }
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
