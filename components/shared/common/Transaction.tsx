"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback, forwardRef } from "react";
import {
  Search,
  ArrowRight,
  ChevronsUpDown,
  ListFilter,
  CalendarDays,
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Pagination } from "./Pagination";
import { EmptyState } from "./EmptyState";
import { TransactionsSkeleton } from "./Skeleton";
import dynamic from "next/dynamic";
import { usePendingTransactions } from "@/hooks/usePendingTransactions";

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

import {
  fetchTransactions,
  type Transaction,
  type TransactionStatus,
  type FetchTransactionsResponse,
} from "@/types/Transaction";
import { clientLog } from "@/lib/utils/client-log";

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
  rowComponent?: React.ComponentType<TransactionRowProps>;
  mobileRowComponent?: React.ComponentType<TransactionMobileRowProps>;
  transactions?: Transaction[];
  pendingTx?: Transaction;
}

export const Transactions = ({
  showPagination = true,
  rowHeight: rowHeightProp = 72,
  viewportHeight: viewportHeightProp = 560,
  hideToolbar = false,
  infiniteScroll = false,
  onDataLoad,
  rowComponent: RowComponent = TransactionRow,
  mobileRowComponent: MobileRowComponent = TransactionMobileRow,
  transactions: controlledTransactions,
  pendingTx,
}: TransactionsProps) => {
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
  const itemsPerPage = 6;
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement | null>>(new Map());
  const rowHeight = rowHeightProp;
  const viewportHeight = viewportHeightProp;
  const overscan = 4;

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

        setInternalTransactions(payload.transactions);
        setTotalCount(payload.total);
        onDataLoad?.(payload.total);
      } catch (err) {
        clientLog.error("Failed to load transactions", err);
        setTransactions([]);
        setTotalCount(0);
        onDataLoad?.(0);
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [currentPage, search, status, sortBy, sortDir, dateFrom, dateTo]);

  const handleSort = useCallback((field: "date" | "amount") => {
    if (sortBy === field) {
      // Toggle direction if already sorting by this field
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      // Switch to new field with descending as default
      setSortBy(field);
      setSortDir("desc");
    }
  }, [sortBy]);

  const handleHeaderKeyDown = useCallback((
    event: React.KeyboardEvent<HTMLButtonElement>,
    field: "date" | "amount"
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSort(field);
    }
  }, [handleSort]);

  const getAriaSortValue = useCallback((column: string): "none" | "ascending" | "descending" => {
    if (column !== sortBy) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  }, [sortBy, sortDir]);

  const formatDateTime = (date: string, time: string) => {
    let fixedTime = time.replace(/(AM|PM)$/i, " $1");
    const d = new Date(date + " " + fixedTime);

    //  date for month
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
  }, [controlledTransactions, currentPage, search, status, sortBy, sortDir, dateFrom, dateTo, onDataLoad]);

  useEffect(() => {
    setScrollTop(0);
    setFocusedRowIndex(null);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [currentPage, search, status, sortBy, sortDir, dateFrom, dateTo]);

  const displayTransactions = useMemo(() => {
    if (!pendingTx) return transactions;
    const isDuplicate = transactions.some(
      (t) =>
        t.type === pendingTx.type &&
        t.amount === pendingTx.amount &&
        t.asset === pendingTx.asset
    );
    if (isDuplicate) return transactions;
    return [pendingTx, ...transactions];
  }, [pendingTx, transactions]);

  const shouldVirtualize = displayTransactions.length > 20;
  const visibleRowCount = shouldVirtualize
    ? Math.min(displayTransactions.length, Math.max(10, Math.ceil(viewportHeight / rowHeight)))
    : displayTransactions.length;
  const virtualizerHeight = shouldVirtualize ? viewportHeight : displayTransactions.length * rowHeight;

  const { startIndex, endIndex } = useMemo(() => {
    if (!shouldVirtualize) {
      return { startIndex: 0, endIndex: displayTransactions.length };
    }

    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const end = Math.min(displayTransactions.length, start + visibleRowCount + overscan * 2);
    return { startIndex: start, endIndex: end };
  }, [shouldVirtualize, displayTransactions.length, scrollTop, rowHeight, visibleRowCount]);

  const visibleTransactions = useMemo(() => {
    return displayTransactions.slice(startIndex, endIndex);
  }, [displayTransactions, startIndex, endIndex]);

  const topSpacerHeight = shouldVirtualize ? startIndex * rowHeight : 0;
  const bottomSpacerHeight = shouldVirtualize
    ? Math.max(0, displayTransactions.length - endIndex) * rowHeight
    : 0;

  const focusRow = useCallback(
    (index: number) => {
      if (index < 0 || index >= transactions.length) return;

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
    [transactions.length, rowHeight, viewportHeight]
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
          focusRow(transactions.length - 1);
          break;
        default:
          break;
      }
    },
    [focusRow, transactions.length]
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        showSearch &&
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      )
        setShowSearch(false);
      if (
        showFilter &&
        filterRef.current &&
        !filterRef.current.contains(e.target as Node)
      )
        setShowFilter(false);
      if (
        showSort &&
        sortRef.current &&
        !sortRef.current.contains(e.target as Node)
      )
        setShowSort(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSearch, showFilter, showSort]);

  const CustomDateInput = forwardRef<
    HTMLInputElement,
    {
      value: string;
      onClick: () => void;
      placeholder: string;
      icon: React.ReactNode;
    }
  >(({ value, onClick, placeholder, icon }, ref) => {
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
  });
  CustomDateInput.displayName = "CustomDateInput";

  const isPendingRow = (txn: Transaction) => pendingTx && txn.id === pendingTx.id;

  return (
    <section className="h-full bg-white rounded-t-xl shadow md:p-8 p-6">
      {!hideToolbar && (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-3 border pb-2 gap-2">
        <div className="flex gap-6 items-center flex-wrap text-gray-400 font-normal text-base select-none">
          <div className="relative" ref={searchRef} id="transaction-detail-drawer">
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
                  className=" rounded p-1  text-sm w-48 focus:outline-none"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
              {showSearch && (
                <div className="absolute left-0 mt-2 z-10 bg-white border rounded shadow p-2">
                  <input
                    type="text"
                    placeholder="Search by type, amount, asset, id"
                    className=" rounded p-1  text-sm w-48 focus:outline-none"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
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
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                      sortBy === "date" ? "font-bold text-primary-700" : ""
                    }`}
                    onClick={() => {
                      setSortBy("date");
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
                      setSortBy("amount");
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
                      setSortDir(sortDir === "asc" ? "desc" : "asc");
                    }}
                    type="button"
                  >
                    Toggle Direction
                  </button>
                </div>
              )}
            </div>
          </div>

            {showSort && (
              <div className="absolute left-0 mt-2 w-38 rounded-md bg-white shadow z-10">
                <button
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                    sortBy === "date" ? "font-bold text-primary-700" : ""
                  }`}
                  onClick={() => {
                    setSortBy("date");
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
                    setSortBy("amount");
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
                    setSortDir(sortDir === "asc" ? "desc" : "asc");
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
              setDateFrom(date ? format(date, "yyyy-MM-dd") : "");
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
              setDateTo(date ? format(date, "yyyy-MM-dd") : "");
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
              if (date < new Date()) {
                return "text-gray-400";
              }
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
        {loading ? (
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
            <div className="hidden md:block overflow-x-auto">
              <div
                ref={scrollContainerRef}
                data-testid={shouldVirtualize ? "transactions-virtualizer" : undefined}
                className="overflow-y-auto"
                style={{ maxHeight: `${viewportHeight}px`, height: `${virtualizerHeight}px` }}
                onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
              >
                <table className="min-w-full text-sm border" aria-rowcount={displayTransactions.length + 1}>
                  <thead className="sticky top-0 z-10 bg-gray-50">
                    <tr className="bg-gray-50 text-gray-500 border-b whitespace-nowrap">
                      <th className="py-3 px-4 text-left font-semibold" aria-sort="none">
                        Transaction Type
                      </th>
                      <th 
                        className="py-3 px-4 text-left font-semibold" 
                        aria-sort={getAriaSortValue("amount")}
                      >
                        <button
                          onClick={() => handleSort("amount")}
                          onKeyDown={(e) => handleHeaderKeyDown(e, "amount")}
                          className="flex items-center gap-2 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded px-1 -mx-1 transition-colors"
                          aria-label={`Sort by Amount ${sortBy === "amount" ? (sortDir === "asc" ? "ascending" : "descending") : ""}`}
                          type="button"
                        >
                          <span>Amount</span>
                          {sortBy === "amount" && (
                            <span aria-hidden="true">{sortDir === "asc" ? "↑" : "↓"}</span>
                          )}
                        </button>
                      </th>
                      <th className="py-3 px-4 text-left font-semibold" aria-sort="none">
                        Asset
                      </th>
                      <th 
                        className="py-3 px-4 text-left font-semibold" 
                        aria-sort={getAriaSortValue("date")}
                      >
                        <button
                          onClick={() => handleSort("date")}
                          onKeyDown={(e) => handleHeaderKeyDown(e, "date")}
                          className="flex items-center gap-2 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded px-1 -mx-1 transition-colors"
                          aria-label={`Sort by Date ${sortBy === "date" ? (sortDir === "asc" ? "ascending" : "descending") : ""}`}
                          type="button"
                        >
                          <span>Date</span>
                          {sortBy === "date" && (
                            <span aria-hidden="true">{sortDir === "asc" ? "↑" : "↓"}</span>
                          )}
                        </button>
                      </th>
                      <th className="py-3 px-4 text-left font-semibold" aria-sort="none">
                        Status
                      </th>
                      <th className="py-3 px-4 text-left font-semibold" aria-sort="none">
                        Actions
                      </th>
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
                        <RowComponent
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

                    {!shouldVirtualize && displayTransactions.length === 0 && !loading && (
                      <tr>
                        <td colSpan={6} className="text-center py-6">
                          No transactions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
              {visibleTransactions.map((txn, idx) => (
                <div
                  key={txn.id ?? startIndex + idx}
                  className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                        Type
                      </span>
                      <div className="font-bold text-gray-900">{txn.type}</div>
                      <div className="text-xs text-gray-500 font-mono">
                        #{txn.id}
                      </div>
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
                        <span className="font-bold text-gray-900">
                          {txn.asset}
                        </span>
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
                        {txn.amount > 0
                          ? `+$${txn.amount}`
                          : `-$${Math.abs(txn.amount)}`}
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
                      onClick={() => {
                        setSelectedTxn(txn);
                        setIsDetailOpen(true);
                      }}
                      className="mt-2 text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1 transition-colors"
                      aria-expanded={isDetailOpen && selectedTxn?.id === txn.id}
                      aria-controls="transaction-detail-drawer"
                      aria-label={`View details for transaction ${txn.id}`}
                      type="button"
                    >
                      Details
                    </button>
                  </div>
                </div>
              ))}
              {visibleTransactions.map((txn, idx) => {
                const actualIndex = startIndex + idx;
                const isPending = isPendingRow(txn);
                return (
                  <MobileRowComponent
                    key={isPending ? `pending-${txn.id}` : (txn.id ?? actualIndex)}
                    txn={txn}
                    isExpanded={isDetailOpen && selectedTxn?.id === txn.id}
                    isPending={isPending}
                    onSelectTxn={handleSelectTxn}
                  />
                );
              })}

              {displayTransactions.length === 0 && !loading && (
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
