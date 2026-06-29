"use client";

import React, { useState, useEffect, useRef, forwardRef, useMemo, useCallback } from "react";
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
import {
  TransactionRow,
  TransactionMobileRow,
  type TransactionRowProps,
  type TransactionMobileRowProps,
} from "./TransactionRow";

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
}: TransactionsProps) => {
  const [internalTransactions, setInternalTransactions] = useState<Transaction[]>([]);
  const transactions = controlledTransactions ?? internalTransactions;
  const [totalCount, setTotalCount] = useState(controlledTransactions?.length ?? 0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"All" | TransactionStatus>("All");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(!controlledTransactions);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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

  const transactionsRef = useRef(transactions);
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

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
        setInternalTransactions([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [controlledTransactions, currentPage, search, status, sortBy, sortDir, dateFrom, dateTo, onDataLoad]);

  useEffect(() => {
    setScrollTop(0);
    setFocusedRowIndex(null);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [currentPage, search, status, sortBy, sortDir, dateFrom, dateTo]);

  const shouldVirtualize = transactions.length > 20;
  const visibleRowCount = shouldVirtualize
    ? Math.min(transactions.length, Math.max(10, Math.ceil(viewportHeight / rowHeight)))
    : transactions.length;
  const virtualizerHeight = shouldVirtualize ? viewportHeight : transactions.length * rowHeight;

  const { startIndex, endIndex } = useMemo(() => {
    if (!shouldVirtualize) {
      return { startIndex: 0, endIndex: transactions.length };
    }

    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const end = Math.min(transactions.length, start + visibleRowCount + overscan * 2);
    return { startIndex: start, endIndex: end };
  }, [shouldVirtualize, transactions.length, scrollTop, rowHeight, visibleRowCount]);

  const visibleTransactions = useMemo(() => {
    return transactions.slice(startIndex, endIndex);
  }, [transactions, startIndex, endIndex]);

  const topSpacerHeight = shouldVirtualize ? startIndex * rowHeight : 0;
  const bottomSpacerHeight = shouldVirtualize
    ? Math.max(0, transactions.length - endIndex) * rowHeight
    : 0;

  const focusRow = useCallback(
    (index: number) => {
      if (index < 0 || index >= transactionsRef.current.length) return;

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
    [rowHeight, viewportHeight]
  );

  const handleFocusRow = useCallback((index: number) => {
    setFocusedRowIndex(index);
  }, []);

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
          focusRow(transactionsRef.current.length - 1);
          break;
        default:
          break;
      }
    },
    [focusRow]
  );

  const handleSelectTxn = useCallback((txn: Transaction) => {
    setSelectedTxn(txn);
    setIsDetailOpen(true);
  }, []);

  const setRowRef = useCallback((index: number, node: HTMLTableRowElement | null) => {
    if (node) {
      rowRefs.current.set(index, node);
    } else {
      rowRefs.current.delete(index);
    }
  }, []);

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

            {/*  */}
            {showFilter && (
              <div className="absolute left-0 mt-2 w-38 rounded-md bg-white shadow z-10">
                {statusOptions.map((opt) => (
                  <button
                    key={opt}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                      status === opt ? "font-bold text-primary-700" : ""
                    }`}
                    onClick={() => {
                      setStatus(opt);
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

            {/*  */}
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
        ) : transactions.length === 0 ? (
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
                <table className="min-w-full text-sm border" aria-rowcount={transactions.length + 1}>
                  <thead className="sticky top-0 z-10 bg-gray-50">
                    <tr className="bg-gray-50 text-gray-500 border-b whitespace-nowrap">
                      <th className="py-3 px-4 text-left font-semibold">
                        Transaction Type
                      </th>
                      <th className="py-3 px-4 text-left font-semibold">Amount</th>
                      <th className="py-3 px-4 text-left font-semibold">Asset</th>
                      <th className="py-3 px-4 text-left font-semibold">Date</th>
                      <th className="py-3 px-4 text-left font-semibold">Status</th>
                      <th className="py-3 px-4 text-left font-semibold">Actions</th>
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
                      return (
                        <RowComponent
                          key={txn.id ?? actualIndex}
                          txn={txn}
                          actualIndex={actualIndex}
                          isFocused={focusedRowIndex === actualIndex}
                          isExpanded={isDetailOpen && selectedTxn?.id === txn.id}
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

                    {!shouldVirtualize && transactions.length === 0 && !loading && (
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
              {visibleTransactions.map((txn, idx) => {
                const actualIndex = startIndex + idx;
                return (
                  <MobileRowComponent
                    key={txn.id ?? actualIndex}
                    txn={txn}
                    isExpanded={isDetailOpen && selectedTxn?.id === txn.id}
                    onSelectTxn={handleSelectTxn}
                  />
                );
              })}

              {transactions.length === 0 && !loading && (
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
