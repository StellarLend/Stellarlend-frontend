"use client";

import React, { useMemo } from "react";
import { usePositions, BorrowPosition } from "@/hooks/usePositions";
import { formatCurrency } from "@/lib/utils/format";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react";

export interface NextPaymentDueProps {
  positions?: BorrowPosition[];
  isLoading?: boolean;
  error?: Error | null;
}

interface ParsedDuePosition {
  id: string;
  asset: string;
  originalAmount: number;
  amount: number;
  daysRemaining: number;
  countdown: string;
  formattedAmount: string;
  dueDate: Date;
}

export function parseNextDue(
  nextDueStr: string,
  fallbackAmount: number,
  asset: string
): {
  daysRemaining: number;
  amount: number;
  countdown: string;
  formattedAmount: string;
  dueDate: Date;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let daysRemaining = 999;
  let parsedAmount = fallbackAmount;

  // 1. Try to extract amount from string (e.g. "$250.00 in 4 days")
  const amountMatch = nextDueStr.match(/\$([0-9,.]+)/);
  if (amountMatch) {
    const amt = parseFloat(amountMatch[1].replace(/,/g, ""));
    if (!isNaN(amt) && amt > 0) {
      parsedAmount = amt;
    }
  }

  // 2. Parse relative days or absolute date
  const cleanStr = nextDueStr.toLowerCase().trim();
  const dateMatch = cleanStr.match(/(\d{4}-\d{2}-\d{2})/);

  if (dateMatch) {
    const parsedDate = new Date(dateMatch[1]);
    if (!isNaN(parsedDate.getTime())) {
      parsedDate.setHours(0, 0, 0, 0);
      const diffTime = parsedDate.getTime() - today.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
  } else if (cleanStr.includes("overdue")) {
    const numMatch = cleanStr.match(/(\d+)\s*days?/);
    const days = numMatch ? parseInt(numMatch[1], 10) : 1;
    daysRemaining = -days;
  } else if (
    cleanStr.includes("today") ||
    cleanStr.includes("same-day") ||
    cleanStr.includes("same day")
  ) {
    daysRemaining = 0;
  } else {
    const inDaysMatch = cleanStr.match(/(\d+)\s*days?/);
    if (inDaysMatch) {
      daysRemaining = parseInt(inDaysMatch[1], 10);
    }
  }

  // Compute actual due date
  const dueDate = new Date(today);
  dueDate.setDate(today.getDate() + daysRemaining);

  // Normalised countdown
  let countdown = "";
  if (daysRemaining < 0) {
    const absDays = Math.abs(daysRemaining);
    countdown = `overdue by ${absDays} day${absDays === 1 ? "" : "s"}`;
  } else if (daysRemaining === 0) {
    countdown = "due today";
  } else {
    countdown = `in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  }

  const formattedAmount = `${formatCurrency(parsedAmount)} ${asset}`;

  return {
    daysRemaining,
    amount: parsedAmount,
    countdown,
    formattedAmount,
    dueDate,
  };
}

export function getSeverityStatus(daysRemaining: number): {
  status: "info" | "warning" | "critical";
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  iconBgColor: string;
} {
  if (daysRemaining < 0) {
    return {
      status: "critical",
      label: "Overdue",
      color: "text-red-400",
      bgColor: "bg-red-950",
      borderColor: "border-red-700",
      iconBgColor: "bg-red-900",
    };
  }
  if (daysRemaining <= 1) {
    return {
      status: "critical",
      label: "Due Today",
      color: "text-red-400",
      bgColor: "bg-red-950",
      borderColor: "border-red-700",
      iconBgColor: "bg-red-900",
    };
  }
  if (daysRemaining <= 3) {
    return {
      status: "warning",
      label: "Due Soon",
      color: "text-amber-400",
      bgColor: "bg-amber-950",
      borderColor: "border-amber-700",
      iconBgColor: "bg-amber-900",
    };
  }
  return {
    status: "info",
    label: "Upcoming",
    color: "text-emerald-400",
    bgColor: "bg-emerald-950",
    borderColor: "border-emerald-700",
    iconBgColor: "bg-emerald-900",
  };
}

export const NextPaymentDue: React.FC<NextPaymentDueProps> = ({
  positions: customPositions,
  isLoading: customIsLoading,
  error: customError,
}) => {
  const hookResult = usePositions();
  const shouldReduceMotion = useReducedMotion();

  const positions = customPositions ?? hookResult.positions;
  const isLoading = customIsLoading ?? hookResult.isLoading;
  const error = customError ?? hookResult.error;

  const sortedDuePositions = useMemo(() => {
    if (!positions || positions.length === 0) return [];

    return positions
      .filter((pos) => pos.nextDue)
      .map((pos) => {
        const parsed = parseNextDue(pos.nextDue!, pos.amount, pos.asset);
        return {
          id: pos.id,
          asset: pos.asset,
          originalAmount: pos.amount,
          ...parsed,
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [positions]);

  if (isLoading) {
    return (
      <div
        className={`rounded-xl border border-[#71B48D33] bg-[#0A3D1E] p-6 text-white mb-6 ${
          shouldReduceMotion ? "" : "animate-pulse"
        }`}
        role="status"
        aria-label="Loading next payment due"
      >
        <div className="h-6 bg-[#072815] rounded w-32 mb-4" />
        <div className="h-10 bg-[#072815] rounded w-64 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="h-16 bg-[#072815] rounded-lg" />
          <div className="h-16 bg-[#072815] rounded-lg" />
          <div className="h-16 bg-[#072815] rounded-lg" />
          <div className="h-16 bg-[#072815] rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <section
        className="rounded-xl border border-[#71B48D33] bg-[#0A3D1E] p-6 text-white mb-6"
        aria-label="Next payment due"
      >
        <p role="alert" className="text-sm font-medium text-red-200">
          Failed to load next payment due reminder.
        </p>
      </section>
    );
  }

  if (sortedDuePositions.length === 0) {
    return (
      <section
        className="rounded-xl border border-[#71B48D33] bg-[#0A3D1E] p-6 text-white mb-6"
        aria-labelledby="next-payment-title"
      >
        <div className="flex items-center gap-3">
          <div className="bg-emerald-950 p-2 rounded-md border border-emerald-700 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h2 id="next-payment-title" className="text-lg font-bold">
              Next Payment Due
            </h2>
            <p className="text-sm text-[#D4F3E6] mt-1">
              No upcoming payments. All borrow positions are up to date.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const soonest = sortedDuePositions[0];
  const severity = getSeverityStatus(soonest.daysRemaining);

  const formattedDate = soonest.dueDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <section
      className="rounded-xl border border-[#71B48D33] bg-[#0A3D1E] p-6 text-white mb-6 hover:border-[#71B48D66] transition-colors"
      aria-labelledby="next-payment-title"
    >
      <div className="flex items-start gap-4">
        <div
          className={`${severity.iconBgColor} ${severity.color} p-3 rounded-xl border ${severity.borderColor} flex-shrink-0 mt-1`}
        >
          {soonest.daysRemaining <= 1 ? (
            <AlertTriangle className="w-6 h-6" />
          ) : (
            <Clock className="w-6 h-6" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 id="next-payment-title" className="text-lg font-bold">
              Next Payment Due
            </h2>
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${severity.bgColor} ${severity.borderColor} ${severity.color}`}
            >
              {severity.label}
            </span>
          </div>
          <p className="text-sm text-[#AAABAB] mt-1">
            Soonest repayment reminder across your borrow positions.
          </p>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#072815] rounded-lg p-3 border border-[#71B48D33]">
              <p className="text-[#AAABAB] text-xs font-medium mb-1">Amount Due</p>
              <p className="text-white text-base font-bold font-mono">
                {soonest.formattedAmount}
              </p>
            </div>

            <div className="bg-[#072815] rounded-lg p-3 border border-[#71B48D33]">
              <p className="text-[#AAABAB] text-xs font-medium mb-1">Asset</p>
              <p className="text-white text-base font-bold font-mono">
                {soonest.asset}
              </p>
            </div>

            <div className="bg-[#072815] rounded-lg p-3 border border-[#71B48D33]">
              <p className="text-[#AAABAB] text-xs font-medium mb-1">Due Date</p>
              <p className="text-white text-base font-bold font-mono">
                {formattedDate}
              </p>
            </div>

            <div className="bg-[#072815] rounded-lg p-3 border border-[#71B48D33]">
              <p className="text-[#AAABAB] text-xs font-medium mb-1">Countdown</p>
              <p
                className={`text-base font-bold font-mono ${
                  soonest.daysRemaining <= 1
                    ? "text-red-400"
                    : soonest.daysRemaining <= 3
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              >
                {soonest.countdown}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NextPaymentDue;
