"use client";

import { ArrowRight } from "lucide-react";
import React from "react";
import { Transactions } from "./Transaction";
import { AlertBanner } from "./AlertBanner";
import { useInfiniteTransactions } from "@/hooks/useInfiniteTransactions";

export const RecentTransactions = () => {
  const infiniteHook = useInfiniteTransactions({ limit: 6 });

  return (
    <section className="bg-white rounded-xl shadow h-full flex flex-col">
      <div className="flex items-center justify-between px-6 md:px-12 pt-6 pb-2">
        <h2 className="text-xl font-bold text-gray-900">Recent Transactions</h2>
        <button className="flex items-center gap-1 px-4 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-500 bg-white hover:bg-gray-50">
          View All <ArrowRight size={16} />
        </button>
      </div>
      
      <div className="flex-1">
        {infiniteHook.isError && infiniteHook.transactions.length === 0 ? (
          <div className="px-6 md:px-12 py-8 flex flex-col items-start gap-4">
            <AlertBanner
              severity="critical"
              title="Failed to load transactions"
              message={infiniteHook.error?.message || "An error occurred while loading recent transactions."}
            />
            <button
              onClick={infiniteHook.reset}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              Retry
            </button>
          </div>
        ) : (
          <Transactions showPagination={false} infiniteScroll infiniteHook={infiniteHook} />
        )}
      </div>
    </section>
  );
};
