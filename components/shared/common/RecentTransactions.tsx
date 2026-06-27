"use client";

import { ArrowRight } from "lucide-react";
import React from "react";
import { useRouter } from "next/navigation";
import { useInfiniteTransactions } from "@/hooks/useInfiniteTransactions";
import { EmptyState } from "./EmptyState";
import { TransactionsSkeleton } from "./Skeleton";
import { Transactions } from "./Transaction";

export const RecentTransactions = () => {
  const router = useRouter();
  const infiniteState = useInfiniteTransactions({ limit: 6 });

  return (
    <section className="bg-white rounded-xl shadow h-full">
      <div className="flex items-center justify-between px-6 md:px-12 pt-6 pb-2">
        <h2 className="text-xl font-bold text-gray-900">Recent Transactions</h2>
        <button className="flex items-center gap-1 px-4 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-500 bg-white hover:bg-gray-50">
          View All <ArrowRight size={16} />
        </button>
      </div>

      {infiniteState.isLoading ? (
        <div className="px-6 pb-6">
          <TransactionsSkeleton count={6} />
        </div>
      ) : infiniteState.transactions.length === 0 ? (
        <div className="px-6 py-8">
          <EmptyState
            title="No transactions yet"
            description="Your transaction history will appear here once you start lending, borrowing, or making payments on Stellarlend."
            actionLabel="Explore lending"
            onAction={() => router.push("/lending")}
          />
        </div>
      ) : (
        <Transactions
          showPagination={false}
          infiniteScroll
          hideToolbar
          externalInfiniteState={infiniteState}
        />
      )}
    </section>
  );
};
