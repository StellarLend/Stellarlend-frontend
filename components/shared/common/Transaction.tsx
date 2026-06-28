"use client";

import React, { useState, useEffect, useRef, forwardRef } from "react";
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
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Pagination } from "./Pagination";
import { EmptyState } from "./EmptyState";
import { TransactionsSkeleton } from "./Skeleton";
import { StatusBadge, transactionStatusToVariant } from "@/components/shared/ui/StatusBadge";
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

const statusOptions: (TransactionStatus | "All")[] = [
  "All",
  "Completed",
  "Processing",
  "Failed",
];

interface TransactionsProps {
  showPagination?: boolean;
  infiniteScroll?: boolean;
  hideToolbar?: boolean;
  onDataLoad?: (totalCount: number) => void;
}

export const Transactions = ({
  showPagination = true,
  infiniteScroll = false,
  hideToolbar = false,
  onDataLoad,
}: TransactionsProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"All" | TransactionStatus>("All");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
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
  const itemsPerPage = 6;
  const router = useRouter();

  const { pendingTxs, ItemTrackers } = usePendingTransactions();

  useEffect(() => {
    setCurrentPage(1);
  }, [search, status, sortBy, sortDir, dateFrom, dateTo]);

  useEffect(() => {
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
        console.error(err);
        setTransactions([]);
        setTotalCount(0);
        onDataLoad?.(0);
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [currentPage, search, status, sortBy, sortDir, dateFrom, dateTo, onDataLoad]);

  const formatDateTime = (date: string, time: string) => {
    let fixedTime = time.replace(/(AM|PM)$/i, " $1");
    const d = new Date(date + " " + fixedTime);

    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "2-digit",
      year: "numeric",
    };

    const dateStr = isNaN(d.getTime()) ? date : d.toLocaleDateString("en-US", options);
    let timeStr = time;
    if (!isNaN(d.getTime())) {
      let [h, m] = [d.getHours(), d.getMinutes()];
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}${ampm}`;
    }

    return (
      <span className="flex items-center gap-2">
        <span>{dateStr}</span>
        <span className="w-px h-4 bg-gray-300 mx-1 inline-block" />
        <span>{timeStr}</span>
      </span>
    );
  };

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

  // Reconcile and deduplicate pending transactions against indexed transactions
  const activePendingRows = pendingTxs.filter((ptx) => {
    return !transactions.some(
      (tx) => tx.id === ptx.hash || (ptx.hash && tx.id.includes(ptx.hash)),
    );
  });

  return (
    <section className="h-full bg-white rounded-t-xl shadow md:p-8 p-6">
      <ItemTrackers />
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
        ) : transactions.length === 0 && activePendingRows.length === 0 ? (
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
              <table className="min-w-full text-sm border">
                <thead>
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
                  {/* Optimistic Pending Rows */}
                  {activePendingRows.map((ptx) => {
                    const now = new Date();
                    const pDate = ptx.date || format(now, "yyyy-MM-dd");
                    let h = now.getHours();
                    const m = now.getMinutes();
                    const ampm = h >= 12 ? "PM" : "AM";
                    h = h % 12 || 12;
                    const pTime =
                      ptx.time ||
                      `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}${ampm}`;

                    return (
                      <tr
                        key={ptx.hash}
                        data-testid={`pending-row-${ptx.hash}`}
                        className="border-b border-amber-200 bg-amber-50/50 whitespace-nowrap hover:bg-amber-50/70 transition text-black font-semibold"
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium text-black">{ptx.type}</div>
                          <div className="text-sm font-normal text-[#667185]">
                            #{ptx.hash}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {ptx.amount > 0
                            ? `+$${ptx.amount}`
                            : `-$${Math.abs(ptx.amount)}`}
                        </td>
                        <td className="py-6 px-4 flex items-center gap-2">
                          <Image
                            src={`/icons/${ptx.asset.toLowerCase()}.svg`}
                            alt={ptx.asset}
                            width={24}
                            height={24}
                            className="inline-block"
                          />
                          <span className="ml-1 font-medium ">{ptx.asset}</span>
                        </td>
                        <td className="py-3 px-4 ">
                          {formatDateTime(pDate, pTime)}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge variant="pending" label="Processing" />
                        </td>
                        <td className="py-3 px-4 text-gray-400 italic text-xs">
                          In-flight...
                        </td>
                      </tr>
                    );
                  })}

                  {/* Confirmed Transactions */}
                  {transactions.map((txn, idx) => (
                    <tr
                      key={txn.id || idx}
                      className="border-b border-gray-300 whitespace-nowrap last:border-0 hover:bg-gray-50 transition text-black"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-black">{txn.type}</div>
                        <div className="text-sm font-normal text-[#667185]">
                          #{txn.id}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {txn.amount > 0
                          ? `+$${txn.amount}`
                          : `-$${Math.abs(txn.amount)}`}
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
                          onClick={() => {
                            setSelectedTxn(txn);
                            setIsDetailOpen(true);
                          }}
                          className="text-blue-600 hover:underline"
                          aria-expanded={isDetailOpen && selectedTxn?.id === txn.id}
                          aria-controls="transaction-detail-drawer"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
              {/* Optimistic Pending Mobile Cards */}
              {activePendingRows.map((ptx) => {
                const now = new Date();
                const pDate = ptx.date || format(now, "yyyy-MM-dd");
                let h = now.getHours();
                const m = now.getMinutes();
                const ampm = h >= 12 ? "PM" : "AM";
                h = h % 12 || 12;
                const pTime =
                  ptx.time ||
                  `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}${ampm}`;

                return (
                  <div
                    key={ptx.hash}
                    data-testid={`pending-card-${ptx.hash}`}
                    className="p-4 border border-amber-200 rounded-xl bg-amber-50/40 shadow-sm transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">
                          Type (Pending)
                        </span>
                        <div className="font-bold text-gray-900">{ptx.type}</div>
                        <div className="text-xs text-gray-500 font-mono">
                          #{ptx.hash}
                        </div>
                      </div>
                      <StatusBadge variant="pending" label="Processing" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-amber-100">
                      <div>
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                          Asset
                        </span>
                        <div className="flex items-center gap-2">
                          <Image
                            src={`/icons/${ptx.asset.toLowerCase()}.svg`}
                            alt={ptx.asset}
                            width={20}
                            height={20}
                          />
                          <span className="font-bold text-gray-900">
                            {ptx.asset}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                          Amount
                        </span>
                        <div
                          className={`font-mono font-bold text-base ${
                            ptx.amount > 0 ? "text-green-600" : "text-gray-900"
                          }`}
                        >
                          {ptx.amount > 0
                            ? `+$${ptx.amount}`
                            : `-$${Math.abs(ptx.amount)}`}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-amber-100 flex justify-between items-center">
                      <div>
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                          Date & Time
                        </span>
                        <div className="text-sm text-gray-700">
                          {formatDateTime(pDate, pTime)}
                        </div>
                      </div>
                      <span className="text-xs text-amber-700 italic">
                        In-flight...
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Confirmed Mobile Cards */}
              {transactions.map((txn, idx) => (
                <div
                  key={txn.id || idx}
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
                      className="mt-2 text-blue-600 hover:underline"
                      aria-expanded={isDetailOpen && selectedTxn?.id === txn.id}
                      aria-controls="transaction-detail-drawer"
                    >
                      Details
                    </button>
                  </div>
                </div>
              ))}
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
