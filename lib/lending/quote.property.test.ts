import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { calculateQuote, type LendingQuoteType } from "./quote";

const quoteTypes: LendingQuoteType[] = ["lend", "borrow"];

const invalidNumber = fc.oneof(
  fc.constant(0),
  fc.integer({ min: -1000000, max: -1 }),
  fc.constant(Number.NaN),
  fc.constant(Number.POSITIVE_INFINITY),
  fc.constant(Number.NEGATIVE_INFINITY)
);

const validAmount = fc.double({ min: 0.001, max: 1000000, noNaN: true });
const validRate = fc.double({ min: 0.001, max: 100, noNaN: true });
const validDuration = fc.integer({ min: 1, max: 3650 });

const expectInvalidInput = (result: ReturnType<typeof calculateQuote>) => {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected quote calculation to reject invalid input");
  }
  expect(result.error.code).toBe("INVALID_INPUT");
};

describe("lending quote properties", () => {
  /**
   * Property 1: Monotonicity in lending rate
   * For lend operations, increasing the interest rate should not decrease total earnings.
   * Invariant: For rates r1 < r2, earnings(r1) < earnings(r2)
   */
  it("property: lending earnings increase monotonically with interest rate", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: 0.001, max: 1000, noNaN: true }),
          fc.double({ min: 0.001, max: 1000, noNaN: true }),
          fc.double({ min: 1, max: 1000000, noNaN: true }),
          fc.integer({ min: 1, max: 3650 })
        ),
        ([rate1, rate2, amount, duration]) => {
          const r1 = Math.min(rate1, rate2);
          const r2 = Math.max(rate1, rate2);

          const result1 = calculateQuote("lend", {
            asset: "XLM",
            amount,
            interestRate: r1,
            duration,
          });

          const result2 = calculateQuote("lend", {
            asset: "XLM",
            amount,
            interestRate: r2,
            duration,
          });

          if (!result1.ok || !result2.ok) {
            throw new Error(
              `Unexpected failure: ${!result1.ok ? result1.error.message : result2.error.message}`
            );
          }

          // Higher rate should yield higher or equal earnings (accounting for floating point precision)
          expect(result2.result.totalEarnings).toBeGreaterThanOrEqual(
            result1.result.totalEarnings - 1e-10
          );
        }
      ),
      { numRuns: 100, seed: 42 }
    );
  });

  /**
   * Property 2: Monotonicity in borrowing rate
   * For borrow operations, increasing the interest rate should increase total repayment.
   * Invariant: For rates r1 < r2, totalRepayment(r1) < totalRepayment(r2)
   */
  it("property: borrowing repayment increases monotonically with interest rate", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: 0.001, max: 100, noNaN: true }),
          fc.double({ min: 0.001, max: 100, noNaN: true }),
          fc.double({ min: 1, max: 1000000, noNaN: true }),
          fc.integer({ min: 1, max: 3650 })
        ),
        ([rate1, rate2, amount, duration]) => {
          const r1 = Math.min(rate1, rate2);
          const r2 = Math.max(rate1, rate2);

          const result1 = calculateQuote("borrow", {
            asset: "XLM",
            amount,
            interestRate: r1,
            duration,
          });

          const result2 = calculateQuote("borrow", {
            asset: "XLM",
            amount,
            interestRate: r2,
            duration,
          });

          if (!result1.ok || !result2.ok) {
            throw new Error(
              `Unexpected failure: ${!result1.ok ? result1.error.message : result2.error.message}`
            );
          }

          const repayment1 = result1.result.totalRepayment || 0;
          const repayment2 = result2.result.totalRepayment || 0;

          // Higher rate should yield higher repayment
          expect(repayment2).toBeGreaterThanOrEqual(repayment1 - 1e-10);
        }
      ),
      { numRuns: 100, seed: 42 }
    );
  });

  /**
   * Property 3: Repayment >= Principal
   * For borrow operations, the total repayment must always be >= the original principal.
   * Invariant: totalRepayment >= principal
   */
  it("property: borrowing total repayment always >= principal amount", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: 0.001, max: 100, noNaN: true }),
          fc.double({ min: 0.001, max: 10000000, noNaN: true }),
          fc.integer({ min: 1, max: 3650 })
        ),
        ([rate, amount, duration]) => {
          const result = calculateQuote("borrow", {
            asset: "XLM",
            amount,
            interestRate: rate,
            duration,
          });

          if (!result.ok) {
            throw new Error(`Unexpected failure: ${result.error.message}`);
          }

          const totalRepayment = result.result.totalRepayment || 0;

          // Repayment should be >= principal
          expect(totalRepayment).toBeGreaterThanOrEqual(amount - 1e-10);
        }
      ),
      { numRuns: 100, seed: 42 }
    );
  });

  /**
   * Property 4: No NaN or Infinity in results
   * All numeric results must be finite, non-NaN values for valid inputs.
   * Invariant: No result contains NaN or Infinity
   */
  it("property: lending results are always finite numbers (no NaN/Infinity)", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: 0.001, max: 1000, noNaN: true }),
          fc.double({ min: 0.001, max: 10000000, noNaN: true }),
          fc.integer({ min: 1, max: 3650 })
        ),
        ([rate, amount, duration]) => {
          const result = calculateQuote("lend", {
            asset: "XLM",
            amount,
            interestRate: rate,
            duration,
          });

          if (!result.ok) {
            throw new Error(`Unexpected failure: ${result.error.message}`);
          }

          const { totalEarnings, dailyEarnings } = result.result;

          // All values must be finite and >= 0
          expect(Number.isFinite(totalEarnings)).toBe(true);
          expect(Number.isFinite(dailyEarnings)).toBe(true);
          expect(totalEarnings).toBeGreaterThanOrEqual(0);
          expect(dailyEarnings).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100, seed: 42 }
    );
  });

  /**
   * Property 5: Borrow results are always finite numbers
   */
  it("property: borrowing results are always finite numbers (no NaN/Infinity)", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: 0.001, max: 100, noNaN: true }),
          fc.double({ min: 0.001, max: 10000000, noNaN: true }),
          fc.integer({ min: 1, max: 3650 })
        ),
        ([rate, amount, duration]) => {
          const result = calculateQuote("borrow", {
            asset: "XLM",
            amount,
            interestRate: rate,
            duration,
          });

          if (!result.ok) {
            throw new Error(`Unexpected failure: ${result.error.message}`);
          }

          const {
            totalEarnings,
            dailyEarnings,
            totalRepayment,
            monthlyPayment,
          } = result.result;

          // All values must be finite and >= 0
          expect(Number.isFinite(totalEarnings)).toBe(true);
          expect(Number.isFinite(dailyEarnings)).toBe(true);
          expect(Number.isFinite(totalRepayment || 0)).toBe(true);
          expect(Number.isFinite(monthlyPayment || 0)).toBe(true);

          expect(totalEarnings).toBeGreaterThanOrEqual(0);
          expect(dailyEarnings).toBeGreaterThanOrEqual(0);
          expect(totalRepayment || 0).toBeGreaterThanOrEqual(0);
          expect(monthlyPayment || 0).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100, seed: 42 }
    );
  });

  /**
   * Property 6: Earnings monotonicity with principal
   * For lend operations, higher principal amounts should yield higher absolute earnings.
   * Invariant: For principals p1 < p2, earnings(p1) < earnings(p2)
   */
  it("property: lending earnings increase monotonically with principal amount", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: 0.001, max: 1000000, noNaN: true }),
          fc.double({ min: 0.001, max: 1000000, noNaN: true }),
          fc.double({ min: 0.001, max: 100, noNaN: true }),
          fc.integer({ min: 1, max: 3650 })
        ),
        ([principal1, principal2, rate, duration]) => {
          const p1 = Math.min(principal1, principal2);
          const p2 = Math.max(principal1, principal2);

          const result1 = calculateQuote("lend", {
            asset: "XLM",
            amount: p1,
            interestRate: rate,
            duration,
          });

          const result2 = calculateQuote("lend", {
            asset: "XLM",
            amount: p2,
            interestRate: rate,
            duration,
          });

          if (!result1.ok || !result2.ok) {
            throw new Error(
              `Unexpected failure: ${!result1.ok ? result1.error.message : result2.error.message}`
            );
          }

          // Higher principal should yield higher or equal earnings
          expect(result2.result.totalEarnings).toBeGreaterThanOrEqual(
            result1.result.totalEarnings - 1e-10
          );
        }
      ),
      { numRuns: 100, seed: 42 }
    );
  });

  /**
   * Property 7: Equivalent valid scenarios stay numerically stable.
   * Lend and borrow use different interest models, so their earnings are not
   * directly ordered for every duration. Both should still produce finite,
   * non-negative earnings for the same valid inputs.
   */
  it("property: equivalent lend and borrow scenarios produce stable earnings", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: 0.001, max: 50, noNaN: true }),
          fc.double({ min: 1, max: 1000000, noNaN: true }),
          fc.integer({ min: 1, max: 3650 })
        ),
        ([rate, amount, duration]) => {
          const lendResult = calculateQuote("lend", {
            asset: "XLM",
            amount,
            interestRate: rate,
            duration,
          });

          const borrowResult = calculateQuote("borrow", {
            asset: "XLM",
            amount,
            interestRate: rate,
            duration,
          });

          if (!lendResult.ok || !borrowResult.ok) {
            throw new Error("Unexpected failure in quote calculation");
          }

          const lendEarnings = lendResult.result.totalEarnings;
          const borrowInterest = borrowResult.result.totalEarnings;

          expect(Number.isFinite(lendEarnings)).toBe(true);
          expect(Number.isFinite(borrowInterest)).toBe(true);
          expect(lendEarnings).toBeGreaterThanOrEqual(0);
          expect(borrowInterest).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100, seed: 42 }
    );
  });

  /**
   * Property 8: Edge case - Fractional principal amounts
   * The calculation should work correctly with very small principal amounts.
   * This tests numerical stability with tiny values.
   */
  it("property: lending works correctly with fractional principal amounts", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: 0.000001, max: 0.1, noNaN: true }),
          fc.double({ min: 0.001, max: 100, noNaN: true }),
          fc.integer({ min: 1, max: 365 })
        ),
        ([smallAmount, rate, duration]) => {
          const result = calculateQuote("lend", {
            asset: "XLM",
            amount: smallAmount,
            interestRate: rate,
            duration,
          });

          if (!result.ok) {
            throw new Error(`Unexpected failure: ${result.error.message}`);
          }

          const { totalEarnings, dailyEarnings } = result.result;

          // Results should be proportional to the principal
          expect(totalEarnings).toBeLessThanOrEqual(smallAmount);
          expect(dailyEarnings).toBeLessThanOrEqual(totalEarnings + 1e-10);
          expect(Number.isFinite(totalEarnings)).toBe(true);
        }
      ),
      { numRuns: 100, seed: 42 }
    );
  });

  /**
   * Property 9: Fractional rate stability
   * The calculation should handle fractional (very small) interest rates correctly.
   */
  it("property: lending works correctly with fractional interest rates", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: 0.0001, max: 0.1, noNaN: true }),
          fc.double({ min: 1, max: 1000000, noNaN: true }),
          fc.integer({ min: 1, max: 365 })
        ),
        ([fracRate, amount, duration]) => {
          const result = calculateQuote("lend", {
            asset: "XLM",
            amount,
            interestRate: fracRate,
            duration,
          });

          if (!result.ok) {
            throw new Error(`Unexpected failure: ${result.error.message}`);
          }

          const { totalEarnings } = result.result;

          // With very small rates, earnings should be proportionally tiny
          expect(totalEarnings).toBeLessThanOrEqual(amount);
          expect(totalEarnings).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(totalEarnings)).toBe(true);
        }
      ),
      { numRuns: 100, seed: 42 }
    );
  });

  /**
   * Property 10: Daily earnings accumulation
   * For lending, the sum of daily earnings over the duration should approximately
   * equal the total earnings.
   * Invariant: totalEarnings ≈ dailyEarnings * duration (with floating point tolerance)
   */
  it("property: lending daily earnings * duration ≈ total earnings", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: 0.001, max: 100, noNaN: true }),
          fc.double({ min: 1, max: 1000000, noNaN: true }),
          fc.integer({ min: 1, max: 3650 })
        ),
        ([rate, amount, duration]) => {
          const result = calculateQuote("lend", {
            asset: "XLM",
            amount,
            interestRate: rate,
            duration,
          });

          if (!result.ok) {
            throw new Error(`Unexpected failure: ${result.error.message}`);
          }

          const { totalEarnings, dailyEarnings } = result.result;
          const calculatedTotal = dailyEarnings * duration;

          // Total should equal daily earnings * duration
          expect(totalEarnings).toBeCloseTo(calculatedTotal, 5);
        }
      ),
      { numRuns: 100, seed: 42 }
    );
  });

  /**
   * Property 11: Invalid amounts are rejected for every quote type.
   * This keeps both lending and borrowing from treating non-positive or
   * non-finite principal values as valid quotes.
   */
  it("property: invalid amounts are rejected for lend and borrow quotes", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...quoteTypes),
        invalidNumber,
        validRate,
        validDuration,
        (type, amount, rate, duration) => {
          const result = calculateQuote(type, {
            asset: "XLM",
            amount,
            interestRate: rate,
            duration,
          });

          expectInvalidInput(result);
        }
      ),
      { numRuns: 100, seed: 42 }
    );
  });

  /**
   * Property 12: Invalid interest rates are rejected for every quote type.
   * This covers zero, negative, NaN, and infinite rates before any math runs.
   */
  it("property: invalid rates are rejected for lend and borrow quotes", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...quoteTypes),
        validAmount,
        invalidNumber,
        validDuration,
        (type, amount, rate, duration) => {
          const result = calculateQuote(type, {
            asset: "XLM",
            amount,
            interestRate: rate,
            duration,
          });

          expectInvalidInput(result);
        }
      ),
      { numRuns: 100, seed: 42 }
    );
  });

  /**
   * Property 13: Invalid durations are rejected for every quote type.
   * This prevents zero, negative, NaN, or infinite durations from producing
   * daily earnings or repayment schedules.
   */
  it("property: invalid durations are rejected for lend and borrow quotes", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...quoteTypes),
        validAmount,
        validRate,
        invalidNumber,
        (type, amount, rate, duration) => {
          const result = calculateQuote(type, {
            asset: "XLM",
            amount,
            interestRate: rate,
            duration,
          });

          expectInvalidInput(result);
        }
      ),
      { numRuns: 100, seed: 42 }
    );
  });

  /**
   * Property 14: Unsupported quote operation names are rejected.
   * Runtime validation should protect callers even if an invalid value crosses
   * a type boundary.
   */
  it("property: unsupported quote types are rejected", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("", "repay", "stake", "LEND", "BORROW"),
        validAmount,
        validRate,
        validDuration,
        (type, amount, rate, duration) => {
          const result = calculateQuote(type as LendingQuoteType, {
            asset: "XLM",
            amount,
            interestRate: rate,
            duration,
          });

          expectInvalidInput(result);
        }
      ),
      { numRuns: 50, seed: 42 }
    );
  });

  /**
   * Property 15: Extreme but positive values fail safely.
   * Inputs can be positive and finite but still overflow during quote math; in
   * that case the function should return a structured non-finite result error.
   */
  it("property: overflow-sized positive inputs return structured errors", () => {
    fc.assert(
      fc.property(fc.constantFrom(...quoteTypes), (type) => {
        const result = calculateQuote(type, {
          asset: "XLM",
          amount: Number.MAX_VALUE,
          interestRate: Number.MAX_VALUE,
          duration: 3650,
        });

        expect(result.ok).toBe(false);
        if (result.ok) {
          throw new Error("Expected overflow-sized inputs to fail safely");
        }
        expect(result.error.code).toBe("NON_FINITE_RESULT");
      }),
      { numRuns: 20, seed: 42 }
    );
  });
});
