// components/TransactionsTable.tsx
"use client";

import React from "react";
import Image from "next/image";
import { Transaction, TransactionStatus } from "./RecentTransactions"; // reuse the type

const statusColors: Record<TransactionStatus, string> = {
  Completed: "bg-green-100 text-green-700",
  Processing: "bg-yellow-100 text-yellow-700",
  Failed: "bg-red-100 text-red-700",
};

export default function TransactionsTable({ data }: { data: Transaction[] }) {
  return (
    <div className="overflow-x-auto bg-white rounded-md h-[828px]">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-500 border-b">
            <th className="py-3 px-4 text-left font-semibold">
              Transaction Type
            </th>
            <th className="py-3 px-4 text-left font-semibold">Amount</th>
            <th className="py-3 px-4 text-left font-semibold">Asset</th>
            <th className="py-3 px-4 text-left font-semibold">Date</th>
            <th className="py-3 px-4 text-left font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((txn, idx) => (
            <tr
              key={txn.id}
              className="border-b border-gray-300 last:border-0 hover:bg-gray-50 transition"
            >
              <td className="py-3 px-4">
                <div className="font-medium text-gray-900">{txn.type}</div>
                <div className="text-xs text-gray-400">#{txn.id}</div>
              </td>
              <td className="py-3 px-4 font-mono">
                {txn.amount > 0
                  ? `+$${txn.amount}`
                  : `-$${Math.abs(txn.amount)}`}
              </td>
              <td className="py-3 px-4 flex items-center gap-2">
                <Image
                  src={`/icons/${txn.asset.toLowerCase()}.svg`}
                  alt={txn.asset}
                  width={24}
                  height={24}
                  className="inline-block"
                />
                <span className="ml-1 font-medium text-gray-700">
                  {txn.asset}
                </span>
              </td>
              <td className="py-3 px-4">
                {txn.date} {txn.time}
              </td>
              <td className="py-3 px-4">
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    statusColors[txn.status]
                  }`}
                >
                  {txn.status}
                </span>
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center py-6 text-gray-400">
                No transactions found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
