"use client";

import { ArrowRight } from "lucide-react";

import React from "react";
import { Transactions } from "./Transaction";

export const RecentTransactions = () => {
  return (
    <section className="bg-white rounded-xl shadow h-full  ">
      <div className="flex items-center justify-between px-6 md:px-12 pt-6 pb-2 ">
        <h2 className="text-xl font-bold text-gray-900">Recent Transactions</h2>
        <button className="flex items-center gap-1 px-4 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-500 bg-white hover:bg-gray-50">
          View All <ArrowRight size={16} />
        </button>
      </div>
      <Transactions showPagination={false} />
    </section>
  );
};
