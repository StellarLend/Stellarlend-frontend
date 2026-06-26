import { describe, it, expect } from "vitest";
import { calculateQuote } from "./quote";

describe("lending quote lib", () => {
  it("calculates lend quote with daily compounding model", () => {
    const outcome = calculateQuote("lend", {
      asset: "XLM",
      amount: 1000,
      interestRate: 10,
      duration: 30,
    });

    if (!outcome.ok) throw new Error(outcome.error.message);

    expect(outcome.result.dailyEarnings).toBeCloseTo(
      0.273972602739726,
      10
    );
    expect(outcome.result.totalEarnings).toBeCloseTo(8.21917808219178, 10);
  });

  it("calculates borrow quote with amortized monthly payment", () => {
    const outcome = calculateQuote("borrow", {
      asset: "XLM",
      amount: 1000,
      interestRate: 12,
      duration: 30,
    });

    if (!outcome.ok) throw new Error(outcome.error.message);

    expect(outcome.result.monthlyPayment).toBeCloseTo(1010, 10);
    expect(outcome.result.totalRepayment).toBeCloseTo(1010, 10);
    expect(outcome.result.totalEarnings).toBeCloseTo(10, 10);
    expect(outcome.result.dailyEarnings).toBeCloseTo(10 / 30, 10);
  });

  it("defaults borrow duration to 30 days when omitted", () => {
    const outcome = calculateQuote("borrow", {
      asset: "XLM",
      amount: 1000,
      interestRate: 12,
    });

    if (!outcome.ok) throw new Error(outcome.error.message);

    expect(outcome.result.monthlyPayment).toBeCloseTo(1010, 10);
    expect(outcome.result.totalRepayment).toBeCloseTo(1010, 10);
  });

  it("rejects non-positive input", () => {
    const outcome = calculateQuote("lend", {
      asset: "XLM",
      amount: 0,
      interestRate: 10,
      duration: 30,
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("expected failure");
    expect(outcome.error.code).toBe("INVALID_INPUT");
  });
});

