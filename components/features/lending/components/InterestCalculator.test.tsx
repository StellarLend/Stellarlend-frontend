/**
 * InterestCalculator.test.tsx
 *
 * Covers the error-state branch introduced to fix #1183:
 *   When calculateQuote returns { ok: false, error } for a positive, non-zero
 *   amount (e.g. DIVIDE_BY_ZERO or NON_FINITE_RESULT), the component must
 *   render a distinct error state that surfaces the error message — NOT the
 *   generic "enter an amount" empty-state copy a user would see before typing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import InterestCalculator from "./InterestCalculator";
import type { LendingData } from "@/lib/lending/types";

// ---------------------------------------------------------------------------
// Mock calculateQuote so we can inject controlled error outcomes.
// ---------------------------------------------------------------------------

vi.mock("@/lib/lending/quote", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/lending/quote")>();
  return {
    ...actual,
    calculateQuote: vi.fn(actual.calculateQuote),
  };
});

import { calculateQuote } from "@/lib/lending/quote";
import type { QuoteOutcome } from "@/lib/lending/quote";

const mockedCalculateQuote = vi.mocked(calculateQuote);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseData: LendingData = {
  asset: "XLM",
  amount: 1000,
  interestRate: 10,
  duration: 30,
};

function renderCalculator(
  data: LendingData = baseData,
  type: "lend" | "borrow" = "lend",
) {
  const onCalculate = vi.fn();
  const result = render(
    <InterestCalculator data={data} type={type} onCalculate={onCalculate} />,
  );
  return { ...result, onCalculate };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InterestCalculator — error state (#1183)", () => {
  beforeEach(() => {
    mockedCalculateQuote.mockReset();
  });

  it("renders a distinct error state when calculateQuote returns DIVIDE_BY_ZERO", async () => {
    const errorOutcome: QuoteOutcome = {
      ok: false,
      error: {
        code: "DIVIDE_BY_ZERO",
        message: "Denominator is zero.",
      },
    };
    mockedCalculateQuote.mockReturnValue(errorOutcome);

    await act(async () => {
      renderCalculator();
    });

    // Must show an error alert — not the generic empty state copy.
    const alert = screen.getByRole("alert");
    expect(alert).toBeTruthy();

    expect(screen.getByText(/unable to calculate/i)).toBeTruthy();
    expect(screen.getByText(/denominator is zero/i)).toBeTruthy();
    expect(screen.getByText(/DIVIDE_BY_ZERO/)).toBeTruthy();

    // Must NOT show the generic "Enter an amount" placeholder.
    expect(
      screen.queryByText(/enter an amount above 0/i),
    ).toBeNull();
  });

  it("renders a distinct error state when calculateQuote returns NON_FINITE_RESULT", async () => {
    const errorOutcome: QuoteOutcome = {
      ok: false,
      error: {
        code: "NON_FINITE_RESULT",
        message: "Non-finite result.",
      },
    };
    mockedCalculateQuote.mockReturnValue(errorOutcome);

    await act(async () => {
      renderCalculator();
    });

    const alert = screen.getByRole("alert");
    expect(alert).toBeTruthy();

    expect(screen.getByText(/non-finite result/i)).toBeTruthy();
    expect(screen.getByText(/NON_FINITE_RESULT/)).toBeTruthy();

    expect(screen.queryByText(/enter an amount above 0/i)).toBeNull();
  });

  it("renders a distinct error state when calculateQuote returns INVALID_INPUT for a positive amount", async () => {
    const errorOutcome: QuoteOutcome = {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Invalid input for borrowing quote.",
      },
    };
    mockedCalculateQuote.mockReturnValue(errorOutcome);

    await act(async () => {
      renderCalculator(baseData, "borrow");
    });

    const alert = screen.getByRole("alert");
    expect(alert).toBeTruthy();

    expect(
      screen.getByText(/invalid input for borrowing quote/i),
    ).toBeTruthy();
    expect(screen.getByText(/INVALID_INPUT/)).toBeTruthy();

    expect(screen.queryByText(/enter an amount above 0/i)).toBeNull();
  });

  it("notifies the parent with null (not a stale result) when calculateQuote fails", async () => {
    // #1530 / invariant I2: on failure the parent must be told to clear, so it
    // can never keep a previously-good CalculationResult that the calculator
    // itself has rejected. Migration: this previously asserted
    // "does NOT call onCalculate", which encoded the stale-parent bug.
    mockedCalculateQuote.mockReturnValue({
      ok: false,
      error: { code: "DIVIDE_BY_ZERO", message: "Denominator is zero." },
    });

    let onCalculate!: ReturnType<typeof vi.fn>;

    await act(async () => {
      ({ onCalculate } = renderCalculator());
    });

    expect(onCalculate).toHaveBeenCalledWith(null);
    // A calculation result must never be published alongside the failure.
    expect(onCalculate).not.toHaveBeenCalledWith(
      expect.objectContaining({ dailyEarnings: expect.any(Number) }),
    );
  });

  it("shows the generic empty state when amount is 0 (no error)", async () => {
    // Pass-through to real implementation — amount 0 → early return, no call.
    // NOTE (#1530): use vi.importActual so we restore the *real* function;
    // previously this passed the mock to itself, which recursed infinitely.
    const actual = await vi.importActual<typeof import("@/lib/lending/quote")>(
      "@/lib/lending/quote",
    );
    mockedCalculateQuote.mockImplementation(actual.calculateQuote);

    await act(async () => {
      renderCalculator({ ...baseData, amount: 0 });
    });

    expect(screen.getByText(/enter an amount above 0/i)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows calculation results when calculateQuote succeeds", async () => {
    // Let the real implementation run — 1000 XLM at 10% for 30 days.
    // Use vi.importActual (see #1530 note above) instead of the mock itself.
    const actual = await vi.importActual<typeof import("@/lib/lending/quote")>(
      "@/lib/lending/quote",
    );
    mockedCalculateQuote.mockImplementation(actual.calculateQuote);

    await act(async () => {
      renderCalculator();
    });

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/enter an amount above 0/i)).toBeNull();
    expect(screen.getByText(/earnings summary/i)).toBeTruthy();
  });
});
