"use client";

import React, { useState, useEffect, forwardRef, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";
import { CalendarDays, X, Search } from "lucide-react";

interface TransactionFiltersProps {
  totalCount: number;
}

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
        className="pl-8 pr-2 py-1.5 rounded-lg text-sm bg-white border border-gray-300 focus:border-gray-400 focus:outline-none focus:ring-0 w-full md:w-[140px]"
        value={value}
        placeholder={placeholder}
        onClick={onClick}
        readOnly
      />
    </div>
  );
});
CustomDateInput.displayName = "CustomDateInput";

export default function TransactionFilters({ totalCount }: TransactionFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local state initialized from URL params
  const [asset, setAsset] = useState(searchParams.get("asset") || "");
  const [type, setType] = useState(searchParams.get("type") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  
  const fromDateStr = searchParams.get("fromDate");
  const toDateStr = searchParams.get("toDate");
  
  const [dateFromObj, setDateFromObj] = useState<Date | null>(
    fromDateStr ? new Date(fromDateStr) : null
  );
  const [dateToObj, setDateToObj] = useState<Date | null>(
    toDateStr ? new Date(toDateStr) : null
  );

  // Sync back to URL when local state changes
  // Debounce search slightly
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (asset) params.set("asset", asset);
    else params.delete("asset");

    if (type) params.set("type", type);
    else params.delete("type");

    if (status) params.set("status", status);
    else params.delete("status");

    if (dateFromObj) params.set("fromDate", format(dateFromObj, "yyyy-MM-dd"));
    else params.delete("fromDate");

    if (dateToObj) params.set("toDate", format(dateToObj, "yyyy-MM-dd"));
    else params.delete("toDate");

    // We reset page to 1 on filter changes if there's a page param, but page might be managed separately.
    // For now just update the URL.
    params.delete("page");
    
    // Create query string
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [asset, type, status, dateFromObj, dateToObj, pathname, router, searchParams]);

  // Handle Search separately with debounce or on Enter
  const handleSearchBlur = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set("search", search);
    else params.delete("search");
    params.delete("page");
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  };
  
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchBlur();
    }
  };

  const handleClearAll = () => {
    setAsset("");
    setType("");
    setStatus("");
    setSearch("");
    setDateFromObj(null);
    setDateToObj(null);
    router.replace(pathname, { scroll: false });
  };

  const hasFilters = asset || type || status || dateFromObj || dateToObj || search;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col">
            <label htmlFor="filter-asset" className="text-xs font-semibold text-gray-500 mb-1">Asset</label>
            <select
              id="filter-asset"
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All Assets</option>
              <option value="XLM">XLM</option>
              <option value="BTC">BTC</option>
              <option value="STRK">STRK</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label htmlFor="filter-type" className="text-xs font-semibold text-gray-500 mb-1">Type</label>
            <select
              id="filter-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All Types</option>
              <option value="lend">Lend</option>
              <option value="borrow">Borrow</option>
              <option value="repay">Repay</option>
              <option value="withdraw">Withdraw</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label htmlFor="filter-status" className="text-xs font-semibold text-gray-500 mb-1">Status</label>
            <select
              id="filter-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Processing">Processing</option>
              <option value="Failed">Failed</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-500 mb-1">Date Range</label>
            <div className="flex items-center gap-2">
              <DatePicker
                selected={dateFromObj}
                onChange={(date: Date | null) => setDateFromObj(date)}
                customInput={
                  <CustomDateInput
                    value={dateFromObj ? format(dateFromObj, "MM-dd-yyyy") : ""}
                    placeholder="From Date"
                    icon={<CalendarDays size={16} />}
                    onClick={() => {}}
                  />
                }
                dateFormat="MM-dd-yyyy"
                maxDate={new Date()}
                isClearable
                placeholderText="From Date"
              />
              <span className="text-gray-400 text-sm">-</span>
              <DatePicker
                selected={dateToObj}
                onChange={(date: Date | null) => setDateToObj(date)}
                customInput={
                  <CustomDateInput
                    value={dateToObj ? format(dateToObj, "MM-dd-yyyy") : ""}
                    placeholder="To Date"
                    icon={<CalendarDays size={16} />}
                    onClick={() => {}}
                  />
                }
                dayClassName={(date) => (date < new Date() ? "text-gray-400" : "")}
                dateFormat="MM-dd-yyyy"
                maxDate={new Date()}
                isClearable
                placeholderText="To Date"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col self-start md:self-end">
          <label htmlFor="filter-search" className="text-xs font-semibold text-gray-500 mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              id="filter-search"
              type="text"
              placeholder="Search IDs or amounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={handleSearchBlur}
              onKeyDown={handleSearchKeyDown}
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 w-full md:w-[220px]"
            />
          </div>
        </div>

      </div>

      <div className="flex items-center justify-between mt-2 pt-4 border-t border-gray-100">
        <div aria-live="polite" className="text-sm font-medium text-gray-600">
          Showing <span className="font-bold text-gray-900">{totalCount}</span> results
        </div>
        
        {hasFilters && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-md transition-colors"
          >
            <X size={16} />
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}
