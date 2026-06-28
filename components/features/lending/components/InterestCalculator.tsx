"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { LendingData, CalculationResult } from "@/lib/lending/types";
import { calculateQuote } from "@/lib/lending/quote";
import { generateAmortizationSchedule } from "@/lib/lending/amortization";
import { Tooltip } from "@/components/atoms/Tooltip/Tooltip";
import { IconButton } from "@/components/atoms/IconButton/IconButton";

const AmortizationSchedule = dynamic(() => import("./AmortizationSchedule"), {
  loading: () => (
    <div className="rounded-xl border border-gray-200 p-6">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2 animate-pulse" />
      <div className="h-4 bg-gray-200 rounded w-2/3 mb-2 animate-pulse" />
      <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
    </div>
  ),
});

interface InterestCalculatorProps {
  data: LendingData;
  type: "lend" | "borrow";
  onCalculate: (result: CalculationResult) => void;
}

export default function InterestCalculator({
  data,
  type,
  onCalculate,
}: InterestCalculatorProps) {
  const [calculation, setCalculation] = useState<CalculationResult | null>(
    null,
  );
  const [schedule, setSchedule] = useState<ReturnType<
    typeof generateAmortizationSchedule
  > | null>(null);

  useEffect(() => {
    if (data.amount <= 0 || data.interestRate <= 0) {
      setCalculation(null);
      setSchedule(null);
      return;
    }

    const outcome = calculateQuote(type, data);

    if (!outcome.ok) {
      setCalculation(null);
      setSchedule(null);
      return;
    }

    setCalculation(outcome.result);
    onCalculate(outcome.result);

    // Generate amortization schedule for borrow mode
    if (type === "borrow") {
      const scheduleResult = generateAmortizationSchedule(data);
      setSchedule(scheduleResult);
    } else {
      setSchedule(null);
    }
  }, [data.amount, data.interestRate, data.duration, type, onCalculate]);

  if (!calculation && data.amount > 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse h-full flex flex-col justify-center">
        <div className="h-6 bg-gray-200 rounded w-1/2 mb-6"></div>
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-4/6"></div>
        </div>
      </div>
    );
  }

  if (!calculation || data.amount <= 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full flex flex-col justify-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {type === "lend" ? "Earnings Calculator" : "Loan Calculator"}
        </h3>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-gray-500 text-sm font-medium">
            Enter an amount above 0 to see <br /> estimated calculations
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {type === "lend" ? "Earnings Summary" : "Loan Summary"}
          <Tooltip
            content={
              type === "lend"
                ? "Summary of your earnings based on the input amount and APR."
                : "Summary of loan repayment details."
            }
          >
            <IconButton aria-label="Help" size="sm" variant="ghost" />
          </Tooltip>
        </h3>
        <div className="space-y-2 text-sm text-gray-700">
          {type === "lend" ? (
            <>
              <div>
                <span className="font-medium">Daily Earnings:</span>
                <Tooltip content="Estimated earnings per day based on APR and amount.">
                  <IconButton aria-label="Help" size="sm" variant="ghost" />
                </Tooltip>
                {` $${calculation.dailyEarnings.toFixed(2)}`}
              </div>
              <div>
                <span className="font-medium">Total Earnings:</span>
                <Tooltip content="Total earnings over the selected period.">
                  <IconButton aria-label="Help" size="sm" variant="ghost" />
                </Tooltip>
                {` $${calculation.totalEarnings.toFixed(2)}`}
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="font-medium">Monthly Payment:</span>
                <Tooltip content="Amount to be paid each month based on loan terms.">
                  <IconButton aria-label="Help" size="sm" variant="ghost" />
                </Tooltip>
                {` $${calculation.monthlyPayment?.toFixed(2)}`}
              </div>
              <div>
                <span className="font-medium">Total Repayment:</span>
                <Tooltip content="Total amount to be repaid over the loan duration.">
                  <IconButton aria-label="Help" size="sm" variant="ghost" />
                </Tooltip>
                {` $${calculation.totalRepayment?.toFixed(2)}`}
              </div>
              <div>
                <span className="font-medium">Total Interest:</span>
                <Tooltip content="Total interest accrued over the loan period.">
                  <IconButton aria-label="Help" size="sm" variant="ghost" />
                </Tooltip>
                {` $${calculation.totalEarnings.toFixed(2)}`}
              </div>
              <div>
                <span className="font-medium">Daily Interest:</span>
                <Tooltip content="Interest earned per day.">
                  <IconButton aria-label="Help" size="sm" variant="ghost" />
                </Tooltip>
                {` $${calculation.dailyEarnings.toFixed(2)}`}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Amortization Schedule for borrow mode */}
      {type === "borrow" && schedule?.ok && (
        <AmortizationSchedule schedule={schedule.schedule} />
      )}
    </div>
  );
}
