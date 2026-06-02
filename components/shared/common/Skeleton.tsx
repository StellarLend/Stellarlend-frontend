import React from "react";
import { cn } from "@/lib/utils/cn";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width as a Tailwind class or inline style value */
  width?: string;
  /** Height as a Tailwind class or inline style value */
  height?: string;
}

/**
 * Skeleton – shared loading placeholder.
 *
 * Uses `animate-pulse` (consistent with InterestCalculator.tsx).
 * Respects `prefers-reduced-motion`: when the user has requested reduced motion
 * the pulse animation is suppressed via the `motion-reduce:animate-none` class.
 *
 * Usage:
 *   <Skeleton className="h-4 w-32" />
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => (
  <div
    role="status"
    aria-label="Loading"
    aria-busy="true"
    className={cn(
      "bg-gray-200 rounded animate-pulse motion-reduce:animate-none",
      className
    )}
    {...props}
  />
);

// ---------------------------------------------------------------------------
// TransactionRowSkeleton – matches the 5-column desktop table layout and the
// mobile card layout used in components/shared/common/Transaction.tsx.
// ---------------------------------------------------------------------------

/**
 * Desktop skeleton row – mirrors the five <td> cells:
 *   Transaction Type | Amount | Asset | Date | Status
 */
export const TransactionRowSkeleton: React.FC<{ index?: number }> = ({ index = 0 }) => (
  <tr
    aria-hidden="true"
    className="border-b border-gray-300 whitespace-nowrap last:border-0"
    style={{ opacity: 1 - index * 0.1 }}
  >
    {/* Transaction Type */}
    <td className="py-3 px-4">
      <Skeleton className="h-4 w-24 mb-1" />
      <Skeleton className="h-3 w-16" />
    </td>
    {/* Amount */}
    <td className="py-3 px-4">
      <Skeleton className="h-4 w-20" />
    </td>
    {/* Asset */}
    <td className="py-6 px-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-4 w-12" />
      </div>
    </td>
    {/* Date */}
    <td className="py-3 px-4">
      <Skeleton className="h-4 w-36" />
    </td>
    {/* Status */}
    <td className="py-3 px-4">
      <Skeleton className="h-6 w-20 rounded-full" />
    </td>
  </tr>
);

/**
 * Mobile skeleton card – mirrors the mobile card layout in Transaction.tsx.
 */
export const TransactionCardSkeleton: React.FC<{ index?: number }> = ({ index = 0 }) => (
  <div
    aria-hidden="true"
    className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm"
    style={{ opacity: 1 - index * 0.1 }}
  >
    <div className="flex justify-between items-start mb-3">
      <div>
        <Skeleton className="h-3 w-8 mb-1" />
        <Skeleton className="h-4 w-20 mb-1" />
        <Skeleton className="h-3 w-12" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
      <div>
        <Skeleton className="h-3 w-10 mb-1" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-4 w-10" />
        </div>
      </div>
      <div className="text-right">
        <Skeleton className="h-3 w-14 mb-1 ml-auto" />
        <Skeleton className="h-4 w-16 ml-auto" />
      </div>
    </div>
    <div className="mt-3 pt-3 border-t border-gray-100">
      <Skeleton className="h-3 w-20 mb-1" />
      <Skeleton className="h-4 w-32" />
    </div>
  </div>
);

/**
 * TransactionsSkeleton – renders `count` skeleton rows (desktop) and cards
 * (mobile) to fill the loading state of the transactions table.
 *
 * Loading / empty / error sequencing (alongside EmptyState):
 *
 *   1. loading === true  → render <TransactionsSkeleton />
 *   2. loading === false && transactions.length === 0 → render <EmptyState />
 *   3. loading === false && error              → render error message / retry
 *   4. loading === false && transactions.length > 0  → render table rows
 */
export const TransactionsSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  const rows = Array.from({ length: count }, (_, i) => i);
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto" aria-label="Loading transactions">
        <table className="min-w-full text-sm border" aria-busy="true">
          <thead>
            <tr className="bg-gray-50 text-gray-500 border-b whitespace-nowrap">
              <th className="py-3 px-4 text-left font-semibold">Transaction Type</th>
              <th className="py-3 px-4 text-left font-semibold">Amount</th>
              <th className="py-3 px-4 text-left font-semibold">Asset</th>
              <th className="py-3 px-4 text-left font-semibold">Date</th>
              <th className="py-3 px-4 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <TransactionRowSkeleton key={i} index={i} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-4">
        {rows.map((i) => (
          <TransactionCardSkeleton key={i} index={i} />
        ))}
      </div>
    </>
  );
};
