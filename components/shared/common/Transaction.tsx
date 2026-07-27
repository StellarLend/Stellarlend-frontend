"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search,
  ChevronsUpDown,
  ArrowUpDown,
  ListFilter,
  CalendarDays,
} from "lucide-react";
import Image from "next/image";
import { StatusBadge } from "../ui";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Pagination } from "./Pagination";
import { EmptyState } from "./EmptyState";
import { TransactionsSkeleton } from "./Skeleton";
import { TransactionRow, TransactionMobileRow } from "./TransactionRow";
import {
  StatusBadge,
  transactionStatusToVariant,
} from "@/components/shared/ui/StatusBadge";
import { usePendingTransactions } from "@/hooks/usePendingTransactions";
import {
  fetchTransactions,
  type Transaction,
  type TransactionStatus,
  type FetchTransactionsResponse,
} from "@/types/Transaction";
import { useInfiniteTransactions } from "@/hooks/useInfiniteTransactions";
import {
  sortTransactions,
  type TransactionSortKey,
  type TransactionSortOrder,
} from "@/lib/transactions/sort";
import { useWallet } from "@/hooks/useWallet";

const TransactionDetail = dynamic(
  () => import("@/components/features/dashboard/components/TransactionDetail"),
  {
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 text-center text-sm text-gray-400">
          Loading…
        </div>
      </div>
    ),
    ssr: false,
  }
);

const statusOptions: (TransactionStatus | "All")[] = [
  "All",
  "Completed",
  "Processing",
  "Failed",
];

export interface TransactionsProps {
  showPagination?: boolean;
  rowHeight?: number;
  viewportHeight?: number;
  hideToolbar?: boolean;
  infiniteScroll?: boolean;
  onDataLoad?: (totalCount: number) => void;
  sortKey?: TransactionSortKey;
  sortOrder?: TransactionSortOrder;
  onSortChange?: (nextKey: TransactionSortKey, nextOrder?: TransactionSortOrder) => void;
  transactions?: Transaction[];
}

export const Transactions = ({
  showPagination = true,
  rowHeight: rowHeightProp = 72,
  viewportHeight: viewportHeightProp = 560,
  hideToolbar = false,
  infiniteScroll = false,
  onDataLoad,
  sortKey,
  sortOrder,
  onSortChange,
  transactions: controlledTransactions,
}: TransactionsProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pendingTxs } = usePendingTransactions();
  const pendingTx = pendingTxs.length > 0 ? pendingTxs[0] : null;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [localSearch, setLocalSearch] = useState("");
  const [localStatus, setLocalStatus] = useState<"All" | TransactionStatus>("All");
  const [localSortBy, setLocalSortBy] = useState<"date" | "amount">("date");
  const [localSortDir, setLocalSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [localDateFrom, setLocalDateFrom] = useState("");
  const [localDateTo, setLocalDateTo] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const [dateFromObj, setDateFromObj] = useState<Date | null>(null);
  const [dateToObj, setDateToObj] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scrollTop, setScrollTop] = useState(0);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemsPerPage = 6;
  const overscan = 5;

  const search = hideToolbar ? searchParams.get("search") || "" : localSearch;
  const status = hideToolbar ? (searchParams.get("status") as TransactionStatus | null) || "All" : localStatus;
  const effectiveSortKey = sortKey ?? (hideToolbar ? (searchParams.get("sortBy") as TransactionSortKey) || "date" : localSortBy);
  const effectiveSortOrder = sortOrder ?? (hideToolbar ? (searchParams.get("sortDir") as TransactionSortOrder) || "desc" : localSortDir);
  const sortBy = effectiveSortKey === "status" ? "date" : effectiveSortKey;
  const sortDir = effectiveSortOrder;
  const dateFrom = hideToolbar ? searchParams.get("fromDate") || "" : localDateFrom;
  const dateTo = hideToolbar ? searchParams.get("toDate") || "" : localDateTo;

  const infinite = useInfiniteTransactions({
    limit: itemsPerPage,
    search: search || undefined,
    status: status === "All" ? undefined : status,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy,
    sortDir,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [search, status, sortBy, sortDir, dateFrom, dateTo]);

  useEffect(() => {
    if (controlledTransactions) {
      setLoading(false);
      setTotalCount(controlledTransactions.length);
      return;
    }

    const loadTransactions = async () => {
      setLoading(true);

      try {
        const payload: FetchTransactionsResponse = await fetchTransactions({
          page: currentPage,
          pageSize: itemsPerPage,
          search: search || undefined,
          status: status === "All" ? undefined : status,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          sortBy,
          sortDir,
        });

        setTransactions(payload.transactions);
        setTotalCount(payload.total);
        onDataLoad?.(payload.total);
      } catch (err) {
        setTransactions([]);
        setTotalCount(0);
        onDataLoad?.(0);
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [controlledTransactions, currentPage, search, status, sortBy, sortDir, dateFrom, dateTo, onDataLoad]);

  const handleSort = useCallback((field: "date" | "amount") => {
    if (sortBy === field) {
      setLocalSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setLocalSortBy(field);
      setLocalSortDir("desc");
    }
  }, [sortBy]);

  const handleHeaderKeyDownInner = useCallback((
    event: React.KeyboardEvent<HTMLButtonElement>,
    field: "date" | "amount"
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSort(field);
    }
  }, [handleSort]);

  const displayTransactions = useMemo(() => {
    const source = controlledTransactions ?? (infiniteScroll ? infinite.transactions : transactions);
    const base = sortTransactions(source, effectiveSortKey, effectiveSortOrder);
    if (!pendingTx) return base;
    const isDuplicate = base.some(
      (t) =>
        t.type === pendingTx.type &&
        t.amount === pendingTx.amount &&
        t.asset === pendingTx.asset
    );
    if (isDuplicate) return base;
    return [pendingTx, ...base];
  }, [controlledTransactions, infiniteScroll, infinite.transactions, transactions, effectiveSortKey, effectiveSortOrder, pendingTx]);

  const displayLoading = controlledTransactions ? false : (infiniteScroll ? infinite.isLoading : loading);

  const handleHeaderClick = (nextKey: TransactionSortKey) => {
    if (!onSortChange) return;
    const nextOrder = sortKey === nextKey && sortOrder === "asc" ? "desc" : "asc";
    onSortChange(nextKey, nextOrder);
  };

  const handleHeaderKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, nextKey: TransactionSortKey) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleHeaderClick(nextKey);
    }
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (showSearch && searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowSearch(false);
      if (showFilter && filterRef.current && !filterRef.current.contains(e.target as Node))
        setShowFilter(false);
      if (showSort && sortRef.current && !sortRef.current.contains(e.target as Node))
        setShowSort(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSearch, showFilter, showSort]);

  useEffect(() => {
    setScrollTop(0);
    setFocusedRowIndex(null);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [currentPage, search, status, sortBy, sortDir, dateFrom, dateTo]);

  const shouldVirtualize = displayTransactions.length > 20;
  const rowHeight = rowHeightProp;
  const viewportHeight = viewportHeightProp;
  const visibleRowCount = shouldVirtualize
    ? Math.min(displayTransactions.length, Math.max(10, Math.ceil(viewportHeight / rowHeight)))
    : displayTransactions.length;

  const { startIndex, endIndex } = useMemo(() => {
    if (!shouldVirtualize) {
      return { startIndex: 0, endIndex: displayTransactions.length };
    }
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const end = Math.min(displayTransactions.length, start + visibleRowCount + overscan * 2);
    return { startIndex: start, endIndex: end };
  }, [shouldVirtualize, displayTransactions.length, scrollTop, rowHeight, visibleRowCount, overscan]);

  const visibleTransactions = useMemo(() => {
    return displayTransactions.slice(startIndex, endIndex);
  }, [displayTransactions, startIndex, endIndex]);

  const topSpacerHeight = shouldVirtualize ? startIndex * rowHeight : 0;
  const bottomSpacerHeight = shouldVirtualize
    ? Math.max(0, displayTransactions.length - endIndex) * rowHeight
    : 0;

  const getAriaSortValue = (key: TransactionSortKey): "ascending" | "descending" | "none" => {
    if (key !== effectiveSortKey) return "none";
    return sortOrder ?? effectiveSortOrder === "asc" ? "ascending" : "descending";
  };

  const setRowRef = useCallback((index: number, node: HTMLTableRowElement | null) => {
    if (node) {
      rowRefs.current.set(index, node);
    } else {
      rowRefs.current.delete(index);
    }
  }, []);

  const focusRow = useCallback(
    (index: number) => {
      if (index < 0 || index >= displayTransactions.length) return;
      setFocusedRowIndex(index);
      const row = rowRefs.current.get(index);
      row?.focus();
      const container = scrollContainerRef.current;
      if (!container) return;
      const targetTop = index * rowHeight;
      const preferredTop = Math.max(0, targetTop - Math.floor(viewportHeight / 2) + rowHeight);
      const maxScroll = container.scrollHeight - container.clientHeight;
      if (typeof container.scrollTo === "function") {
        container.scrollTo({ top: Math.min(preferredTop, maxScroll) });
      } else {
        container.scrollTop = Math.min(preferredTop, maxScroll);
      }
    },
    [displayTransactions.length, rowHeight, viewportHeight]
  );

  const handleFocusRow = useCallback(
    (index: number) => {
      setFocusedRowIndex(index);
    },
    []
  );

  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>, index: number) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          focusRow(index + 1);
          break;
        case "ArrowUp":
          event.preventDefault();
          focusRow(index - 1);
          break;
        case "Home":
          event.preventDefault();
          focusRow(0);
          break;
        case "End":
          event.preventDefault();
          focusRow(displayTransactions.length - 1);
          break;
        default:
          break;
      }
    },
    [focusRow, displayTransactions.length]
  );

  const handleSelectTxn = useCallback((txn: Transaction) => {
    setSelectedTxn(txn);
    setIsDetailOpen(true);
  }, []);

  const isPendingRow = (txn: Transaction) => pendingTx && txn.id === pendingTx.id;

  return (
    <section className="h-full bg-white rounded-t-xl shadow md:p-8 p-6">
      {!hideToolbar && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-3 border pb-2 gap-2">
          <div className="flex gap-6 items-center flex-wrap text-gray-400 font-normal text-base select-none">
            <div className="relative" ref={searchRef}>
              <div
                className="flex items-center gap-1 cursor-pointer"
                onClick={() => setShowSearch((v) => !v)}
              >
                <Search size={18} />
                <span>Search</span>
              </div>
              {showSearch && (
                <div className="absolute left-0 mt-2 z-10 bg-white border rounded shadow p-2">
                  <input
                    type="text"
                    placeholder="Search by type, amount, asset, id"
                    className="rounded p-1 text-sm w-48 focus:outline-none"
                    value={search}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
            </div>

            <div className="relative" ref={filterRef}>
              <div
                className="flex items-center gap-1 cursor-pointer"
                onClick={() => setShowFilter((v) => !v)}
              >
                <ListFilter size={18} />
                <span>Filter</span>
              </div>
              {showFilter && (
                <div className="absolute left-0 mt-2 w-38 rounded-md bg-white shadow z-10">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                        status === opt ? "font-bold text-primary-700" : ""
                      }`}
                      onClick={() => {
                        setLocalStatus(opt as TransactionStatus | "All");
                        setShowFilter(false);
                      }}
                      type="button"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={sortRef}>
              <div
                className="flex items-center gap-1 cursor-pointer"
                onClick={() => setShowSort((v) => !v)}
              >
                <ChevronsUpDown size={18} />
                <span>Sort</span>
              </div>
              {showSort && (
                <div className="absolute left-0 mt-2 w-38 rounded-md bg-white shadow z-10">
                  <button
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                      sortBy === "date" ? "font-bold text-primary-700" : ""
                    }`}
                    onClick={() => {
                      setLocalSortBy("date");
                      setShowSort(false);
                    }}
                    type="button"
                  >
                    Date {sortBy === "date" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                  <button
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                      sortBy === "amount" ? "font-bold text-primary-700" : ""
                    }`}
                    onClick={() => {
                      setLocalSortBy("amount");
                      setShowSort(false);
                    }}
                    type="button"
                  >
                    Amount{" "}
                    {sortBy === "amount" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                  <button
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                    onClick={() => {
                      setLocalSortDir(sortDir === "asc" ? "desc" : "asc");
                    }}
                    type="button"
                  >
                    Toggle Direction
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="hidden md:flex gap-2 items-center mt-2 sm:mt-0 text-black/40">
            <DatePicker
              selected={dateFromObj}
              onChange={(date: Date | null) => {
                setDateFromObj(date);
                setLocalDateFrom(date ? format(date, "yyyy-MM-dd") : "");
              }}
              customInput={
                <CustomDateInput
                  value={dateFromObj ? format(dateFromObj, "MM-dd-yyyy") : ""}
                  placeholder="MM-DD-YYYY"
                  icon={<CalendarDays size={16} />}
                  onClick={() => {}}
                />
              }
              dateFormat="MM-dd-yyyy"
              className="w-[140px] placeholder:text-sm"
              maxDate={new Date()}
              isClearable
              placeholderText="MM-DD-YYYY"
            />
            <span className="text-gray-400 text-sm">to</span>
            <DatePicker
              selected={dateToObj}
              onChange={(date: Date | null) => {
                setDateToObj(date);
                setLocalDateTo(date ? format(date, "yyyy-MM-dd") : "");
              }}
              customInput={
                <CustomDateInput
                  value={dateToObj ? format(dateToObj, "MM-dd-yyyy") : ""}
                  placeholder="MM-DD-YYYY"
                  icon={<CalendarDays size={16} />}
                  onClick={() => {}}
                />
              }
              dayClassName={(date) => {
                if (date < new Date()) return "text-gray-400";
                return "";
              }}
              dateFormat="MM-dd-yyyy"
              className="w-[140px] placeholder:text-sm"
              maxDate={new Date()}
              isClearable
              placeholderText="MM-DD-YYYY"
            />
          </div>
        </div>
      )}

      <div className="">
        {displayLoading ? (
          <TransactionsSkeleton count={itemsPerPage} />
        ) : displayTransactions.length === 0 ? (
          <div className="px-6 py-16">
            <EmptyState
              title="No transactions yet"
              description="Your transaction history will appear here once you lend, borrow, or make payments on Stellarlend."
              actionLabel="Explore lending"
              onAction={() => router.push("/lending")}
            />
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div
              className="hidden md:block overflow-x-auto"
              ref={scrollContainerRef}
              data-testid="transactions-virtualizer"
              style={shouldVirtualize ? { height: `${viewportHeight}px`, overflowY: "auto" } : undefined}
            >
              <table
                className="min-w-full text-sm border"
                role="table"
                aria-rowcount={displayTransactions.length}
              >
                <thead>
                  <tr className="bg-gray-50 text-gray-500 border-b whitespace-nowrap">
                    <th className="py-3 px-4 text-left font-semibold">Transaction Type</th>
                    <th
                      className="py-3 px-4 text-left font-semibold"
                      scope="col"
                      aria-sort={sortKey === "amount" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <button
                        type="button"
                        className="flex items-center gap-1 text-left font-semibold"
                        aria-sort={getAriaSortValue("amount")}
                        aria-label="Sort by amount"
                        onClick={() => handleHeaderClick("amount")}
                        onKeyDown={(event) => handleHeaderKeyDown(event, "amount")}
                      >
                        <span>Amount</span>
                        {effectiveSortKey === "amount" ? (effectiveSortOrder === "asc" ? " ↑" : " ↓") : " ↕"}
                      </button>
                    </th>
                    <th className="py-3 px-4 text-left font-semibold" aria-sort="none">Asset</th>
                    <th className="py-3 px-4 text-left font-semibold" scope="col">
                      <button
                        type="button"
                        className="flex items-center gap-1 text-left font-semibold"
                        aria-sort={getAriaSortValue("date")}
                        aria-label="Sort by date"
                        onClick={() => handleHeaderClick("date")}
                        onKeyDown={(event) => handleHeaderKeyDown(event, "date")}
                      >
                        <span>Date</span>
                        {effectiveSortKey === "date" ? (effectiveSortOrder === "asc" ? " ↑" : " ↓") : " ↕"}
                      </button>
                    </th>
                    <th
                      className="py-3 px-4 text-left font-semibold"
                      scope="col"
                      aria-sort={sortKey === "status" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <button
                        type="button"
                        className="flex items-center gap-1 text-left font-semibold"
                        aria-sort={getAriaSortValue("status")}
                        aria-label="Sort by status"
                        onClick={() => handleHeaderClick("status")}
                        onKeyDown={(event) => handleHeaderKeyDown(event, "status")}
                      >
                        <span>Status</span>
                        {effectiveSortKey === "status" ? (effectiveSortOrder === "asc" ? " ↑" : " ↓") : " ↕"}
                      </button>
                    </th>
                    <th className="py-3 px-4 text-left font-semibold" aria-sort="none">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shouldVirtualize && topSpacerHeight > 0 && (
                    <tr aria-hidden="true" style={{ height: `${topSpacerHeight}px` }}>
                      <td colSpan={6} />
                    </tr>
                  )}
                  {visibleTransactions.map((txn, idx) => {
                    const actualIndex = startIndex + idx;
                    const isPending = isPendingRow(txn);
                    return (
                      <TransactionRow
                        key={isPending ? `pending-${txn.id}` : (txn.id ?? actualIndex)}
                        txn={txn}
                        actualIndex={actualIndex}
                        isFocused={focusedRowIndex === actualIndex}
                        isExpanded={isDetailOpen && selectedTxn?.id === txn.id}
                        isPending={isPending}
                        onFocusRow={handleFocusRow}
                        onKeyDownRow={handleRowKeyDown}
                        onSelectTxn={handleSelectTxn}
                        setRowRef={setRowRef}
                      />
                    );
                  })}
                  {shouldVirtualize && bottomSpacerHeight > 0 && (
                    <tr aria-hidden="true" style={{ height: `${bottomSpacerHeight}px` }}>
                      <td colSpan={6} />
                    </tr>
                  )}
                  {!shouldVirtualize && displayTransactions.length === 0 && !displayLoading && (
                    <tr>
                      <td colSpan={6} className="text-center py-6">
                        No transactions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
              {visibleTransactions.map((txn, idx) => {
                const actualIndex = startIndex + idx;
                const isPending = isPendingRow(txn);
                return (
                  <TransactionMobileRow
                    key={isPending ? `pending-${txn.id}` : (txn.id ?? actualIndex)}
                    txn={txn}
                    isExpanded={isDetailOpen && selectedTxn?.id === txn.id}
                    isPending={isPending}
                    onSelectTxn={handleSelectTxn}
                  />
                );
              })}
              {displayTransactions.length === 0 && !displayLoading && (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <p className="text-gray-500">No transactions found.</p>
                </div>
              )}
            </div>
          </>
        )}

        <div className="">
          {showPagination && totalCount > 0 && (
            <Pagination
              totalItems={totalCount}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
            />
          )}
        </div>
      </div>

      {isDetailOpen && (
        <TransactionDetail transaction={selectedTxn} isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} />
      )}
    </section>
  );
};

interface CustomDateInputProps {
  value: string;
  onClick: () => void;
  placeholder: string;
  icon: React.ReactNode;
}

const CustomDateInput = React.forwardRef<HTMLInputElement, CustomDateInputProps>(
  ({ value, onClick, placeholder, icon }, ref) => {
    return (
      <div className="relative">
        <span className="absolute left-2 top-1.5 text-gray-400 pointer-events-none mt-[2px]">
          {icon}
        </span>
        <input
          ref={ref}
          type="text"
          className="pl-8 pr-2 py-1.5 rounded-lg text-sm bg-white border border-gray-300 focus:border-gray-400 focus:outline-none focus:ring-0 w-[140px]"
          value={value}
          placeholder={placeholder}
          onClick={onClick}
          readOnly
        />
      </div>
    );
  }
);
CustomDateInput.displayName = "CustomDateInput";