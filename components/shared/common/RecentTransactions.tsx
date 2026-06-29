"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import React, { useMemo } from "react";
import { Transactions, type TransactionsProps } from "./Transaction";
import { TransactionRow, TransactionMobileRow } from "./TransactionRow";
import useTxStatus from "@/lib/tx/useTxStatus";
import { TX_HOOK_STATE } from "@/lib/tx/constants";
import type { InFlightTx, Transaction } from "@/types/Transaction";

export interface RecentTransactionsProps extends Partial<TransactionsProps> {
  inFlightTx?: InFlightTx;
}

export const RecentTransactions = ({ inFlightTx, ...props }: RecentTransactionsProps) => {
  const txStatus = useTxStatus(inFlightTx?.hash ?? null);

  const pendingTx: Transaction | undefined = useMemo(() => {
    if (!inFlightTx || !txStatus) return undefined;

    if (txStatus.state === TX_HOOK_STATE.COMPLETED) return undefined;

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const h = hours % 12 || 12;
    const time = `${h.toString().padStart(2, "0")}:${minutes}${ampm}`;

    const status =
      txStatus.state === TX_HOOK_STATE.FAILED ? "Failed" : "Processing";

    return {
      id: inFlightTx.hash.slice(0, 8),
      type: inFlightTx.type,
      amount: inFlightTx.amount,
      asset: inFlightTx.asset,
      date,
      time,
      status: status as "Processing" | "Failed",
    };
  }, [inFlightTx, txStatus]);

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
        rowComponent={TransactionRow}
        mobileRowComponent={TransactionMobileRow}
        pendingTx={pendingTx}
        {...props}
      />
    </section>
  );
};
