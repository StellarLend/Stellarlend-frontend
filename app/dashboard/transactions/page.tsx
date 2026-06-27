"use client";

import React, { useState } from "react";
import { DashboardLayout } from "@/components";
import { Transactions } from "@/components/shared/common/Transaction";
import { Bank } from "@/components/shared/ui/icons/Bank";
import { PageHeader } from "@/components/shared/common";
import TransactionFilters from "@/components/features/dashboard/components/TransactionFilters";

export default function TransactionsPage() {
  const [totalCount, setTotalCount] = useState(0);

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
      <Transactions infiniteScroll hideToolbar onDataLoad={setTotalCount} />
    </DashboardLayout>
  );
}
