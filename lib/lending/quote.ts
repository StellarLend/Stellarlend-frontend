import type { CalculationResult, LendingData } from "@/lib/lending/types";

export type LendingQuoteType = "lend" | "borrow";

export type QuoteErrorCode =
  | "INVALID_INPUT"
  | "DIVIDE_BY_ZERO"
  | "NON_FINITE_RESULT";

export type QuoteError = {
  code: QuoteErrorCode;
  message: string;
};

export type QuoteOutcome =
  | { ok: true; result: CalculationResult }
  | { ok: false; error: QuoteError };

const DEFAULT_DURATION_DAYS = 30;

const isPositiveFinite = (value: number) =>
  Number.isFinite(value) && value > 0;

const assertValidType = (type: unknown): type is LendingQuoteType =>
  type === "lend" || type === "borrow";

/**
 * Calculates lending or borrowing quotes with interest and repayment figures.
 *
 * ## Lending Mode ("lend")
 * Returns daily and total earnings using a simple daily compounding model:
 * - dailyEarnings = amount × (interestRate / 365 / 100)
 * - totalEarnings = dailyEarnings × duration
 *
 * ## Borrowing Mode ("borrow")
 * Returns amortized monthly payments using the standard loan formula:
 * - Calculates monthly payment based on compound interest
 * - totalRepayment = monthlyPayment × numberOfPayments
 * - totalInterest = totalRepayment - principal
 *
 * ## Verified Mathematical Properties
 * Property-based tests (fast-check) verify the following invariants:
 *
 * 1. **Monotonicity in Rate (Lending)**
 *    - Higher interest rates → higher total earnings
 *    - For rates r1 < r2: earnings(r1) ≤ earnings(r2)
 *    - See: quote.property.test.ts - "lending earnings increase monotonically"
 *
 * 2. **Monotonicity in Rate (Borrowing)**
 *    - Higher interest rates → higher total repayment
 *    - For rates r1 < r2: repayment(r1) ≤ repayment(r2)
 *    - See: quote.property.test.ts - "borrowing repayment increases monotonically"
 *
 * 3. **Repayment >= Principal**
 *    - For all valid borrowing scenarios: totalRepayment ≥ principal
 *    - Guarantees borrower always pays at least the amount borrowed
 *    - See: quote.property.test.ts - "total repayment always >= principal"
 *
 * 4. **No NaN/Infinity**
 *    - All numeric results are finite non-NaN values for valid inputs
 *    - Handles edge cases: fractional principals, fractional rates
 *    - See: quote.property.test.ts - "finite numbers (no NaN/Infinity)" tests
 *
 * 5. **Monotonicity in Principal (Lending)**
 *    - Higher principal amounts → higher absolute earnings
 *    - For principals p1 < p2: earnings(p1) ≤ earnings(p2)
 *
 * 6. **Daily Earnings Accumulation (Lending)**
 *    - Mathematical relationship: totalEarnings ≈ dailyEarnings × duration
 *    - Validates internal consistency of calculations
 *
 * ## Input Validation
 * - amount: must be positive and finite
 * - interestRate: must be positive and finite (in percentage, e.g., 12 for 12%)
 * - duration: must be positive finite integer (in days), defaults to 30
 *
 * ## Error Handling
 * Returns error outcomes for:
 * - Invalid inputs (non-positive, non-finite, wrong type)
 * - Division by zero scenarios
 * - Non-finite intermediate results
 *
 * @param type - Either "lend" or "borrow" operation
 * @param data - Lending data including amount, interest rate, and optional duration
 * @returns QuoteOutcome with either calculation result or detailed error
 *
 * @example
 * // Lending quote
 * const lendResult = calculateQuote("lend", {
 *   asset: "XLM",
 *   amount: 1000,
 *   interestRate: 10,
 *   duration: 30,
 * });
 *
 * @example
 * // Borrowing quote
 * const borrowResult = calculateQuote("borrow", {
 *   asset: "USDC",
 *   amount: 5000,
 *   interestRate: 8.5,
 *   duration: 90,
 * });
 */
export function calculateQuote(
  type: LendingQuoteType,
  data: LendingData
): QuoteOutcome {
  const amount = data.amount;
  const interestRate = data.interestRate;
  const durationDays = data.duration ?? DEFAULT_DURATION_DAYS;

  if (
    !isPositiveFinite(amount) ||
    !isPositiveFinite(interestRate) ||
    !isPositiveFinite(durationDays) ||
    !assertValidType(type)
  ) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Invalid input for quote calculation.",
      },
    };
  }

  if (type === "lend") {
    const dailyRate = interestRate / 365 / 100;
    const dailyEarnings = amount * dailyRate;
    const totalEarnings = dailyEarnings * durationDays;

    if (
      !Number.isFinite(dailyEarnings) ||
      !Number.isFinite(totalEarnings)
    ) {
      return {
        ok: false,
        error: { code: "NON_FINITE_RESULT", message: "Non-finite result." },
      };
    }

    return {
      ok: true,
      result: {
        totalEarnings,
        dailyEarnings,
      },
    };
  }

  const monthlyRate = interestRate / 12 / 100;
  const numberOfPayments = Math.ceil(durationDays / 30);

  if (!isPositiveFinite(monthlyRate) || numberOfPayments <= 0) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Invalid input for borrowing quote.",
      },
    };
  }

  const growth = Math.pow(1 + monthlyRate, numberOfPayments);
  const denominator = growth - 1;

  if (!Number.isFinite(growth) || !Number.isFinite(denominator)) {
    return {
      ok: false,
      error: { code: "NON_FINITE_RESULT", message: "Non-finite result." },
    };
  }

  if (denominator === 0) {
    return {
      ok: false,
      error: { code: "DIVIDE_BY_ZERO", message: "Denominator is zero." },
    };
  }

  const monthlyPayment =
    (amount * monthlyRate * growth) / denominator;

  const totalRepayment = monthlyPayment * numberOfPayments;
  const totalInterest = totalRepayment - amount;
  const dailyEarnings = totalInterest / durationDays;

  if (
    !Number.isFinite(monthlyPayment) ||
    !Number.isFinite(totalRepayment) ||
    !Number.isFinite(totalInterest) ||
    !Number.isFinite(dailyEarnings)
  ) {
    return {
      ok: false,
      error: { code: "NON_FINITE_RESULT", message: "Non-finite result." },
    };
  }

  return {
    ok: true,
    result: {
      totalEarnings: totalInterest,
      dailyEarnings,
      totalRepayment,
      monthlyPayment,
    },
  };
}

