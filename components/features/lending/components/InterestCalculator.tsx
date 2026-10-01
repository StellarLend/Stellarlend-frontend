"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { LendingData, CalculationResult } from "@/lib/lending/types";
import { calculateQuote } from "@/lib/lending/quote";
import type { QuoteError, QuoteOutcome } from "@/lib/lending/quote";
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

/**
 * InterestCalculator — deterministic quote display for lend/borrow.
 *
 * Failure-path & boundary invariants (#1530):
 *
 * I1  Single terminal state: every calculation-effect run writes
 *     `calculation`, `quoteError` and `schedule` together, so the render can
 *     never observe a mix of stale and fresh values.
 * I2  Parent sync: `onCalculate` fires on EVERY terminal transition — with the
 *     fresh result on success and `null` when inputs are invalid or the quote
 *     failed — so a parent (TransactionSummary/ConfirmModal) can never keep a
 *     rejected or stale CalculationResult.
 * I3  Validation routing: a non-finite or <= 0 amount clears to the friendly
 *     empty state; every other invalid term (rate <= 0, NaN rate, bad
 *     duration) surfaces as a distinct `role="alert"` error, never as a
 *     permanently-shimmering "calculating" skeleton.
 * I4  Exception containment: a throw from `calculateQuote` becomes a
 *     diagnosable UNEXPECTED_ERROR alert plus a name/message-only log — the
 *     tree never unmounts to an error boundary and no stack or input payload
 *     reaches the DOM.
 * I5  Callback isolation: internal state is committed before `onCalculate`
 *     runs, and the call is guarded — a throwing parent callback cannot crash
 *     the component or leave half-committed state.
 * I6  Deterministic recompute: the effect re-runs only when the inputs
 *     (`amount`, `interestRate`, `duration`, `type`) change, never when a
 *     parent re-renders with a new inline `onCalculate` identity. Duplicate
 *     input events are therefore no-ops.
 * I7  Partial failure: a failed amortization schedule is logged and dropped
 *     without blocking the loan summary render.
 */
interface InterestCalculatorProps {
  data: LendingData;
  type: "lend" | "borrow";
  /**
   * Fresh result on success; `null` whenever the current inputs are invalid
   * or the quote failed (invariant I2, #1530).
   */
  onCalculate: (result: CalculationResult | null) => void;
}

/** Library quote errors plus the component-local contained-exception code (I4). */
type CalculationError = {
  code: QuoteError["code"] | "UNEXPECTED_ERROR";
  message: string;
};

export default function InterestCalculator({
  data,
  type,
  onCalculate,
}: InterestCalculatorProps) {
  const [calculation, setCalculation] = useState<CalculationResult | null>(
    null,
  );
  const [quoteError, setQuoteError] = useState<CalculationError | null>(null);
  const [schedule, setSchedule] = useState<ReturnType<
    typeof generateAmortizationSchedule
  > | null>(null);

  // Latest-callback ref (invariant I6): the calculation effect reads the
  // callback through this ref so it can stay out of the dependency array and
  // re-run only when the inputs change.
  const onCalculateRef = useRef(onCalculate);
  useEffect(() => {
    onCalculateRef.current = onCalculate;
  });

  useEffect(() => {
    // I1 — helpers always write the three state slots together.
    const clear = () => {
      setCalculation(null);
      setQuoteError(null);
      setSchedule(null);
    };

    // I2 — the parent is notified of every terminal transition, including
    // clearing, so it can never hold a stale CalculationResult.
    const notify = (result: CalculationResult | null) => {
      try {
        onCalculateRef.current(result);
      } catch (err) {
        // I5 — a throwing parent callback must not crash the calculator.
        // Log name + message only: no stack frames, no input payload.
        console.error(
          "[InterestCalculator] onCalculate callback threw:",
          err instanceof Error
            ? `${err.name}: ${err.message}`
            : "unknown error",
        );
      }
    };

    const fail = (error: CalculationError) => {
      clear();
      setQuoteError(error);
      notify(null);
    };

    // I3 — missing/non-finite principal resolves to the empty state.
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      clear();
      notify(null);
      return;
    }

    // I4 — a thrown calculation is contained, not an app crash.
    let outcome: QuoteOutcome;
    try {
      outcome = calculateQuote(type, data);
    } catch (err) {
      console.error(
        "[InterestCalculator] calculateQuote threw:",
        err instanceof Error ? `${err.name}: ${err.message}` : "unknown error",
      );
      fail({
        code: "UNEXPECTED_ERROR",
        message: "Unable to calculate — an unexpected error occurred.",
      });
      return;
    }

    if (!outcome.ok) {
      fail(outcome.error);
      return;
    }

    // I7 — schedule generation is best-effort: a failure is logged and
    // dropped without blocking the summary.
    let nextSchedule: ReturnType<typeof generateAmortizationSchedule> | null =
      null;
    if (type === "borrow") {
      try {
        nextSchedule = generateAmortizationSchedule(data);
        if (!nextSchedule.ok) {
          console.warn(
            "[InterestCalculator] amortization schedule unavailable:",
            nextSchedule.error,
          );
        }
      } catch (err) {
        console.error(
          "[InterestCalculator] generateAmortizationSchedule threw:",
          err instanceof Error
            ? `${err.name}: ${err.message}`
            : "unknown error",
        );
        nextSchedule = null;
      }
    }

    // I1/I5 — commit state before notifying the parent.
    setQuoteError(null);
    setCalculation(outcome.result);
    setSchedule(nextSchedule);
    notify(outcome.result);
    // `onCalculate` is read via the latest-callback ref (I6), so only the
    // inputs are reactive dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.amount, data.interestRate, data.duration, type]);

  // Calculation failed with a specific error — surface it distinctly so the
  // user knows their input was rejected, not just empty.
  if (quoteError) {
    return (
      <div
        role="alert"
        className="bg-white rounded-xl shadow-sm border border-red-200 p-6 h-full flex flex-col justify-center"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {type === "lend" ? "Earnings Calculator" : "Loan Calculator"}
        </h3>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>
          <p className="text-red-600 text-sm font-medium">
            Unable to calculate: {quoteError.message}
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Error code: {quoteError.code}
          </p>
        </div>
      </div>
    );
  }

  // Still waiting for the first calculation effect for a plausible amount.
  // I3: non-finite amounts (NaN/Infinity) must fall through to the empty
  // state instead of shimmering forever, and after the effect runs every
  // finite positive amount has either a result or an error — so this
  // skeleton only ever appears before the first calculation.
  if (!calculation && Number.isFinite(data.amount) && data.amount > 0) {
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
