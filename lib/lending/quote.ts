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

