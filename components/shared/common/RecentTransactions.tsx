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

export type TransactionStatus = "Completed" | "Processing" | "Failed";
export type Transaction = {
  id: string;
  type: string;
  amount: number;
  asset: "XLM" | "BTC" | "STRK";
  date: string;
  time: string;
  status: TransactionStatus;
};

export const fetchTransactions = async (): Promise<Transaction[]> => {
  await new Promise((res) => setTimeout(res, 300));
  return [
    {
      id: "TXN12345",
      type: "Deposit",
      amount: 2000,
      asset: "XLM",
      date: "2025-04-12",
      time: "09:32AM",
      status: "Completed",
    },
    {
      id: "TXN12346",
      type: "Loan Payment",
      amount: -250,
      asset: "BTC",
      date: "2025-03-10",
      time: "11:15AM",
      status: "Processing",
    },
    {
      id: "TXN12347",
      type: "Withdrawal",
      amount: -7500,
      asset: "STRK",
      date: "2025-02-28",
      time: "04:45PM",
      status: "Completed",
    },
    {
      id: "TXN12348",
      type: "Lend Funds",
      amount: -1500,
      asset: "XLM",
      date: "2025-01-05",
      time: "08:00AM",
      status: "Completed",
    },
    {
      id: "TXN12349",
      type: "Lend Funds",
      amount: -607.87,
      asset: "BTC",
      date: "2024-12-20",
      time: "10:20PM",
      status: "Failed",
    },
    {
      id: "TXN12350",
      type: "Deposit",
      amount: 20000,
      asset: "STRK",
      date: "2024-11-15",
      time: "01:05PM",
      status: "Completed",
    },
  ];
};

const statusColors: Record<TransactionStatus, string> = {
  Completed: "bg-green-100 text-green-700",
  Processing: "bg-yellow-100 text-yellow-700",
  Failed: "bg-red-100 text-red-700",
};

const statusOptions: (TransactionStatus | "All")[] = [
  "All",
  "Completed",
  "Processing",
  "Failed",
];

export default function RecentTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"All" | TransactionStatus>("All");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const [dateFromObj, setDateFromObj] = useState<Date | null>(null);
  const [dateToObj, setDateToObj] = useState<Date | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchTransactions().then((data) => {
      setTransactions(data);
      setLoading(false);
    });
  }, []);

  let filtered = transactions.filter((txn) => {
    const matchesSearch =
      txn.type.toLowerCase().includes(search.toLowerCase()) ||
      txn.id.toLowerCase().includes(search.toLowerCase()) ||
      txn.asset.toLowerCase().includes(search.toLowerCase()) ||
      txn.amount.toString().includes(search);
    const matchesStatus = status === "All" || txn.status === status;
    const matchesDateFrom =
      !dateFrom || new Date(txn.date) >= new Date(dateFrom);
    const matchesDateTo = !dateTo || new Date(txn.date) <= new Date(dateTo);
    return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  filtered = filtered.sort((a, b) => {
    if (sortBy === "date") {
      const aDate = new Date(a.date);
      const bDate = new Date(b.date);
      return sortDir === "asc"
        ? aDate.getTime() - bDate.getTime()
        : bDate.getTime() - aDate.getTime();
    } else {
      return sortDir === "asc" ? a.amount - b.amount : b.amount - a.amount;
    }
  });

  const formatDateTime = (date: string, time: string) => {
    let fixedTime = time.replace(/(AM|PM)$/i, " $1");
    const d = new Date(date + " " + fixedTime);
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "2-digit",
      year: "numeric",
    };
    const dateStr = d.toLocaleDateString("en-US", options);
    let [h, m] = [d.getHours(), d.getMinutes()];
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    h = h ? h : 12;
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

  return (
    <section className="bg-white rounded-xl shadow p-0 ">
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <h2 className="text-xl font-bold text-gray-900">Recent Transactions</h2>
        <button className="flex items-center gap-1 px-4 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-500 bg-white hover:bg-gray-50">
          View All <ArrowRight size={16} />
        </button>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 pb-2 gap-2">
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
                  className="border rounded px-2 py-1 text-sm w-48 focus:outline-none"
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
              <div className="absolute left-0 mt-2 w-32 bg-white border rounded shadow z-10">
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
              <div className="absolute left-0 mt-2 w-32 bg-white border rounded shadow z-10">
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
        <div className="flex gap-2 items-center mt-2 sm:mt-0">
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
            className="w-[140px]"
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
            className="w-[140px]"
            maxDate={new Date()}
            isClearable
            placeholderText="MM-DD-YYYY"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : (
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
              {filtered.map((txn, idx) => (
                <tr
                  key={idx}
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
                    {formatDateTime(txn.date, txn.time)}
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
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-gray-400">
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
