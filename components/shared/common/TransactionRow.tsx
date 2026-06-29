"use client";

import React, { useCallback } from "react";
import Image from "next/image";
import { StatusBadge, transactionStatusToVariant } from "@/components/shared/ui/StatusBadge";
import type { Transaction } from "@/types/Transaction";

export const rowRenderCounts = new Map<string, number>();
export const mobileRowRenderCounts = new Map<string, number>();

export const formatDateTime = (date: string, time: string) => {
  let fixedTime = time.replace(/(AM|PM)$/i, " $1");
  const d = new Date(date + " " + fixedTime);

  // date for month
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "2-digit",
    year: "numeric",
  };

  // date for hours and minites
  const dateStr = d.toLocaleDateString("en-US", options);
  let [h, m] = [d.getHours(), d.getMinutes()];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  h = h ? h : 12;

  // time
  const timeStr = `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}${ampm}`;
  return (
    <span className="flex items-center gap-2">
      <span>{dateStr}</span>
      <span className="w-px h-4 bg-gray-300 mx-1 inline-block" />
      <span>{timeStr}</span>
    </span>
  );
};

export interface TransactionRowProps {
  txn: Transaction;
  actualIndex: number;
  isFocused: boolean;
  isExpanded: boolean;
  onFocusRow: (index: number) => void;
  onKeyDownRow: (event: React.KeyboardEvent<HTMLTableRowElement>, index: number) => void;
  onSelectTxn: (txn: Transaction) => void;
  setRowRef: (index: number, node: HTMLTableRowElement | null) => void;
}

export const TransactionRow = React.memo(
  ({
    txn,
    actualIndex,
    isFocused,
    isExpanded,
    onFocusRow,
    onKeyDownRow,
    onSelectTxn,
    setRowRef,
  }: TransactionRowProps) => {
    if (txn.id) {
      const count = rowRenderCounts.get(txn.id) ?? 0;
      rowRenderCounts.set(txn.id, count + 1);
    }

    const handleRef = useCallback(
      (node: HTMLTableRowElement | null) => {
        setRowRef(actualIndex, node);
      },
      [actualIndex, setRowRef]
    );

    const handleFocus = useCallback(() => {
      onFocusRow(actualIndex);
    }, [actualIndex, onFocusRow]);

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLTableRowElement>) => {
        onKeyDownRow(event, actualIndex);
      },
      [actualIndex, onKeyDownRow]
    );

    const handleSelect = useCallback(() => {
      onSelectTxn(txn);
    }, [txn, onSelectTxn]);

    return (
      <tr
        ref={handleRef}
        tabIndex={0}
        aria-rowindex={actualIndex + 2}
        aria-label={`Transaction ${txn.id}`}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        className={`border-b border-gray-300 whitespace-nowrap last:border-0 hover:bg-gray-50 transition text-black ${isFocused ? "bg-gray-100" : ""}`}
      >
        <td className="py-3 px-4">
          <div className="font-medium text-black">{txn.type}</div>
          <div className="text-sm font-normal text-[#667185]">#{txn.id}</div>
        </td>
        <td className="py-3 px-4 font-mono">
          {txn.amount > 0 ? `+$${txn.amount}` : `-$${Math.abs(txn.amount)}`}
        </td>
        <td className="py-6 px-4 flex items-center gap-2">
          <Image
            src={`/icons/${txn.asset.toLowerCase()}.svg`}
            alt={txn.asset}
            width={24}
            height={24}
            className="inline-block"
          />
          <span className="ml-1 font-medium ">{txn.asset}</span>
        </td>
        <td className="py-3 px-4 ">
          {formatDateTime(txn.date, txn.time)}
        </td>
        <td className="py-3 px-4">
          <StatusBadge
            variant={transactionStatusToVariant(txn.status)}
            label={txn.status}
          />
        </td>
        <td className="py-3 px-4">
          <button
            onClick={handleSelect}
            className="text-blue-600 hover:underline"
            aria-expanded={isExpanded}
            aria-controls="transaction-detail-drawer"
          >
            Details
          </button>
        </td>
      </tr>
    );
  }
);
TransactionRow.displayName = "TransactionRow";

export interface TransactionMobileRowProps {
  txn: Transaction;
  isExpanded: boolean;
  onSelectTxn: (txn: Transaction) => void;
}

export const TransactionMobileRow = React.memo(
  ({ txn, isExpanded, onSelectTxn }: TransactionMobileRowProps) => {
    if (txn.id) {
      const count = mobileRowRenderCounts.get(txn.id) ?? 0;
      mobileRowRenderCounts.set(txn.id, count + 1);
    }

    const handleSelect = useCallback(() => {
      onSelectTxn(txn);
    }, [txn, onSelectTxn]);

    return (
      <div className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-3">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Type
            </span>
            <div className="font-bold text-gray-900">{txn.type}</div>
            <div className="text-xs text-gray-500 font-mono">#{txn.id}</div>
          </div>
          <StatusBadge
            variant={transactionStatusToVariant(txn.status)}
            label={txn.status}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Asset
            </span>
            <div className="flex items-center gap-2">
              <Image
                src={`/icons/${txn.asset.toLowerCase()}.svg`}
                alt={txn.asset}
                width={20}
                height={20}
              />
              <span className="font-bold text-gray-900">{txn.asset}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Amount
            </span>
            <div
              className={`font-mono font-bold text-base ${
                txn.amount > 0 ? "text-green-600" : "text-gray-900"
              }`}
            >
              {txn.amount > 0 ? `+$${txn.amount}` : `-$${Math.abs(txn.amount)}`}
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Date & Time
            </span>
            <div className="text-sm text-gray-700">
              {formatDateTime(txn.date, txn.time)}
            </div>
          </div>
          <button
            onClick={handleSelect}
            className="mt-2 text-blue-600 hover:underline"
            aria-expanded={isExpanded}
            aria-controls="transaction-detail-drawer"
          >
            Details
          </button>
        </div>
      </div>
    );
  }
);
TransactionMobileRow.displayName = "TransactionMobileRow";
