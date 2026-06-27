"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import React from "react";
import { Transactions } from "./Transaction";
import { TRANSACTION_TYPE_OPTIONS } from "@/lib/transactions/filters";

export const RecentTransactions = () => {
  const [selectedType, setSelectedType] = useState("");

  return (
    <section className="bg-white rounded-xl shadow h-full">
      <div className="flex flex-col gap-4 px-6 md:px-12 pt-6 pb-2">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-gray-900">Recent Transactions</h2>
          <button className="flex items-center gap-1 px-4 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-500 bg-white hover:bg-gray-50">
            View All <ArrowRight size={16} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Recent transaction type filters">
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              selectedType === "" ? "bg-blue-600 text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
            aria-pressed={selectedType === ""}
            onClick={() => setSelectedType("")}
          >
            All
          </button>
          {TRANSACTION_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                selectedType === option.value
                  ? "bg-blue-600 text-white border-transparent"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
              aria-pressed={selectedType === option.value}
              onClick={() => setSelectedType(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <p className="sr-only" aria-live="polite">
          Showing {selectedType ? `${selectedType.charAt(0).toUpperCase()}${selectedType.slice(1)}` : "all"} recent transactions.
        </p>
      </div>

      <Transactions showPagination={false} infiniteScroll typeFilter={selectedType} />
    </section>
  );
};
