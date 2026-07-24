"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Transactions } from "./Transaction";
import type { TransactionSortKey, TransactionSortOrder } from "@/lib/transactions/sort";

export const RecentTransactions = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [sortKey, setSortKey] = useState<TransactionSortKey>("date");
  const [sortOrder, setSortOrder] = useState<TransactionSortOrder>("desc");

  useEffect(() => {
    const fromQuery = searchParams.get("sort");
    const order = searchParams.get("order");

    if (fromQuery === "amount" || fromQuery === "status") {
      setSortKey(fromQuery);
    }

    if (order === "asc" || order === "desc") {
      setSortOrder(order);
    }
  }, [searchParams]);

  const updateSort = useCallback(
    (nextKey: TransactionSortKey, nextOrder?: TransactionSortOrder) => {
      const resolvedOrder = nextOrder ?? (sortKey === nextKey && sortOrder === "asc" ? "desc" : "asc");
      const params = new URLSearchParams(searchParams.toString());
      params.set("sort", nextKey);
      params.set("order", resolvedOrder);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      setSortKey(nextKey);
      setSortOrder(resolvedOrder);
    },
    [pathname, router, searchParams, sortKey, sortOrder],
  );

  return (
    <section className="bg-white rounded-xl shadow h-full flex flex-col">
      <div className="flex items-center justify-between px-6 md:px-12 pt-6 pb-2">
        <h2 className="text-xl font-bold text-gray-900">Recent Transactions</h2>
        <button className="flex items-center gap-1 px-4 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-500 bg-white hover:bg-gray-50">
          View All <ArrowRight size={16} />
        </button>
      </div>
      <Transactions
        showPagination={false}
        infiniteScroll
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSortChange={updateSort}
      />
    </section>
  );
};
