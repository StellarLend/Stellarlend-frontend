import { describe, it, expect } from "vitest";
import {
  generateAmortizationSchedule,
  formatCurrency,
  shouldCollapseSchedule,
} from "./amortization";
import type { AmortizationPeriod, AmortizationSchedule } from "./amortization";

describe("amortization schedule lib", () => {
  describe("generateAmortizationSchedule", () => {
    it("generates a valid schedule for a standard loan", () => {
      const outcome = generateAmortizationSchedule({
        asset: "XLM",
        amount: 1000,
        interestRate: 12,
        duration: 90,
      });

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) throw new Error("Expected success");

      const { schedule } = outcome;
      expect(schedule.periods.length).toBeGreaterThan(0);
      expect(schedule.monthlyPayment).toBeGreaterThan(0);
      expect(schedule.totalInterest).toBeGreaterThan(0);
      expect(schedule.totalRepayment).toBeGreaterThan(schedule.totalInterest);
    });

    it("handles zero interest rate", () => {
      const outcome = generateAmortizationSchedule({
        asset: "XLM",
        amount: 1000,
        interestRate: 0,
        duration: 30,
      });

      expect(outcome.ok).toBe(false);
      if (outcome.ok) throw new Error("Expected failure for zero interest");
      expect(outcome.error).toContain("positive numbers");
    });

    it("handles single period term (30 days)", () => {
      const outcome = generateAmortizationSchedule({
        asset: "XLM",
        amount: 1000,
        interestRate: 12,
        duration: 30,
      });

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) throw new Error("Expected success");

      const { schedule } = outcome;
      expect(schedule.periods.length).toBe(1);
      expect(schedule.periods[0].remainingBalance).toBeCloseTo(0, 5);
    });

    it("handles long-term loans with multiple periods", () => {
      const outcome = generateAmortizationSchedule({
        asset: "XLM",
        amount: 10000,
        interestRate: 8,
        duration: 365,
      });

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) throw new Error("Expected success");

      const { schedule } = outcome;
      // 365 days / 30 = 12.17, ceil = 13 periods
      expect(schedule.periods.length).toBe(13);
      expect(
        schedule.periods[schedule.periods.length - 1].remainingBalance,
      ).toBeCloseTo(0, 5);
    });

    it("ensures final period balance is exactly zero", () => {
      const outcome = generateAmortizationSchedule({
        asset: "XLM",
        amount: 5000,
        interestRate: 10,
        duration: 180,
      });

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) throw new Error("Expected success");

      const { schedule } = outcome;
      const lastPeriod = schedule.periods[schedule.periods.length - 1];
      expect(lastPeriod.remainingBalance).toBeCloseTo(0, 5);
    });

    it("rejects negative amounts", () => {
      const outcome = generateAmortizationSchedule({
        asset: "XLM",
        amount: -1000,
        interestRate: 12,
        duration: 30,
      });

      expect(outcome.ok).toBe(false);
      expect(outcome.error).toContain("positive numbers");
    });

    it("rejects missing duration", () => {
      const outcome = generateAmortizationSchedule({
        asset: "XLM",
        amount: 1000,
        interestRate: 12,
      });

      expect(outcome.ok).toBe(true); // Should default to 30 days
      if (!outcome.ok)
        throw new Error("Expected success with default duration");
    });

    it("calculates correct interest distribution over time", () => {
      const outcome = generateAmortizationSchedule({
        asset: "XLM",
        amount: 1000,
        interestRate: 12,
        duration: 60,
      });

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) throw new Error("Expected success");

      const { schedule } = outcome;

      // Early periods should have higher interest portion
      const earlyPeriod = schedule.periods[0];
      const latePeriod = schedule.periods[schedule.periods.length - 1];

      expect(earlyPeriod.interest).toBeGreaterThan(latePeriod.interest);
      expect(earlyPeriod.principal).toBeLessThan(latePeriod.principal);
    });

    it("maintains consistency with calculateQuote totals", () => {
      const outcome = generateAmortizationSchedule({
        asset: "XLM",
        amount: 1000,
        interestRate: 12,
        duration: 90,
      });

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) throw new Error("Expected success");

      const { schedule } = outcome;

      // Sum of all period payments should equal total repayment
      const sumOfPayments = schedule.periods.reduce(
        (sum, p) => sum + p.principal + p.interest,
        0,
      );
      expect(sumOfPayments).toBeCloseTo(schedule.totalRepayment, 5);

      // Sum of all interest should equal total interest
      const sumOfInterest = schedule.periods.reduce(
        (sum, p) => sum + p.interest,
        0,
      );
      expect(sumOfInterest).toBeCloseTo(schedule.totalInterest, 5);
    });

    it("handles edge case with very small amounts", () => {
      const outcome = generateAmortizationSchedule({
        asset: "XLM",
        amount: 0.01,
        interestRate: 12,
        duration: 30,
      });

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) throw new Error("Expected success");

      const { schedule } = outcome;
      expect(schedule.periods.length).toBeGreaterThan(0);
      expect(
        schedule.periods[schedule.periods.length - 1].remainingBalance,
      ).toBeCloseTo(0, 5);
    });

    it("handles high interest rates", () => {
      const outcome = generateAmortizationSchedule({
        asset: "XLM",
        amount: 1000,
        interestRate: 100,
        duration: 60,
      });

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) throw new Error("Expected success");

      const { schedule } = outcome;
      expect(schedule.totalInterest).toBeGreaterThan(
        schedule.totalRepayment / 2,
      );
    });
  });

  describe("formatCurrency", () => {
    it("formats positive values correctly", () => {
      expect(formatCurrency(1234.56)).toBe("$1234.56");
    });

    it("formats zero correctly", () => {
      expect(formatCurrency(0)).toBe("$0.00");
    });

    it("formats decimal values correctly", () => {
      expect(formatCurrency(99.9)).toBe("$99.90");
    });

    it("handles large numbers", () => {
      expect(formatCurrency(1000000.5)).toBe("$1000000.50");
    });
  });

  describe("shouldCollapseSchedule", () => {
    it("returns false for short schedules", () => {
      const shortSchedule: AmortizationPeriod[] = [
        { period: 1, principal: 100, interest: 10, remainingBalance: 0 },
        { period: 2, principal: 100, interest: 5, remainingBalance: 0 },
      ];
      expect(shouldCollapseSchedule(shortSchedule)).toBe(false);
    });

    it("returns false for schedules with exactly 6 periods", () => {
      const sixPeriodSchedule: AmortizationPeriod[] = Array.from(
        { length: 6 },
        (_, i) => ({
          period: i + 1,
          principal: 100,
          interest: 10,
          remainingBalance: 0,
        }),
      );
      expect(shouldCollapseSchedule(sixPeriodSchedule)).toBe(false);
    });

    it("returns true for schedules with more than 6 periods", () => {
      const longSchedule: AmortizationPeriod[] = Array.from(
        { length: 12 },
        (_, i) => ({
          period: i + 1,
          principal: 100,
          interest: 10,
          remainingBalance: 0,
        }),
      );
      expect(shouldCollapseSchedule(longSchedule)).toBe(true);
    });

    it("returns true for very long schedules", () => {
      const veryLongSchedule: AmortizationPeriod[] = Array.from(
        { length: 36 },
        (_, i) => ({
          period: i + 1,
          principal: 100,
          interest: 10,
          remainingBalance: 0,
        }),
      );
      expect(shouldCollapseSchedule(veryLongSchedule)).toBe(true);
    });
  });
});
