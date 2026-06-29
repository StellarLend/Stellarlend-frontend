import type { LendingData } from "./types";
import { calculateQuote } from "./quote";

export interface AmortizationPeriod {
  period: number;
  principal: number;
  interest: number;
  remainingBalance: number;
}

export interface AmortizationSchedule {
  periods: AmortizationPeriod[];
  monthlyPayment: number;
  totalInterest: number;
  totalRepayment: number;
}

/**
 * Generates an amortization schedule for a loan.
 * Reuses the interest calculation logic from calculateQuote to ensure consistency.
 *
 * @param data - Lending data including amount, interest rate, and duration
 * @returns AmortizationSchedule with per-period breakdown or error
 */
export function generateAmortizationSchedule(
  data: LendingData,
): { ok: true; schedule: AmortizationSchedule } | { ok: false; error: string } {
  // Validate inputs
  if (
    !data ||
    typeof data.amount !== "number" ||
    typeof data.interestRate !== "number" ||
    data.amount <= 0 ||
    data.interestRate <= 0
  ) {
    return {
      ok: false,
      error: "Invalid input: amount and interest rate must be positive numbers",
    };
  }

  const durationDays = data.duration ?? 30;
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    return {
      ok: false,
      error: "Invalid duration: must be a positive number",
    };
  }

  // Get the base calculation from calculateQuote to reuse the math
  const quoteOutcome = calculateQuote("borrow", data);

  if (!quoteOutcome.ok) {
    return {
      ok: false,
      error: quoteOutcome.error.message,
    };
  }

  const monthlyPayment = quoteOutcome.result.monthlyPayment;
  const totalRepayment = quoteOutcome.result.totalRepayment;

  if (!monthlyPayment || !totalRepayment) {
    return {
      ok: false,
      error: "Invalid calculation: missing payment information",
    };
  }

  // Calculate number of payments (same logic as quote.ts)
  const monthlyRate = data.interestRate / 12 / 100;
  const numberOfPayments = Math.ceil(durationDays / 30);

  if (numberOfPayments <= 0 || !Number.isFinite(monthlyRate)) {
    return {
      ok: false,
      error: "Invalid calculation parameters",
    };
  }

  // Generate amortization schedule
  const periods: AmortizationPeriod[] = [];
  let remainingBalance = data.amount;

  for (let period = 1; period <= numberOfPayments; period++) {
    // Interest for this period
    const interest = remainingBalance * monthlyRate;

    // Principal payment (monthlyPayment - interest)
    // For the last period, adjust to ensure balance reaches exactly zero
    let principal: number;
    if (period === numberOfPayments) {
      // Last period: pay off remaining balance
      principal = remainingBalance;
    } else {
      principal = monthlyPayment - interest;
    }

    // Update remaining balance
    remainingBalance -= principal;

    // Handle floating point precision issues
    if (remainingBalance < 0.001 && remainingBalance > -0.001) {
      remainingBalance = 0;
    }

    periods.push({
      period,
      principal: Math.max(0, principal),
      interest: Math.max(0, interest),
      remainingBalance: Math.max(0, remainingBalance),
    });
  }

  return {
    ok: true,
    schedule: {
      periods,
      monthlyPayment,
      totalInterest: quoteOutcome.result.totalEarnings,
      totalRepayment,
    },
  };
}

/**
 * Formats a currency value for display
 */
export function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

/**
 * Determines if a schedule should be collapsed based on length
 */
export function shouldCollapseSchedule(periods: AmortizationPeriod[]): boolean {
  return periods.length > 6;
}
