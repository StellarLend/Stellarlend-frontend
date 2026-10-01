/**
 * InterestCalculator.failure.test.tsx
 *
 * Failure-path and boundary coverage for InterestCalculator.tsx (#1530).
 *
 * Each describe block maps to an invariant documented in the component:
 *   I1  single terminal state per effect run
 *   I2  parent notified on every transition (incl. `null`) — no stale state
 *   I3  validation routing — never a permanently-shimmering skeleton
 *   I4  exception containment — throws become diagnosable alerts
 *   I5  a throwing parent callback cannot crash the component
 *   I6  deterministic recompute — duplicate inputs / new callback identities
 *       are no-ops
 *   I7  amortization-schedule partial failure never blocks the summary
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// Load AmortizationSchedule synchronously so borrow-mode assertions do not
// depend on dynamic-import timing.
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: React.ComponentType<any> }>) => {
    function DynamicImportedComponent(props: any) {
      const [Loaded, setLoaded] =
        React.useState<React.ComponentType<any> | null>(null);
      React.useEffect(() => {
        let active = true;
        loader().then((module) => {
          if (active) setLoaded(() => module.default);
        });
        return () => {
          active = false;
        };
      }, []);
      if (!Loaded) return <div>Loading…</div>;
      return <Loaded {...props} />;
    }
    return DynamicImportedComponent;
  },
}));

import InterestCalculator from "./InterestCalculator";
import type { LendingData } from "@/lib/lending/types";

vi.mock("@/lib/lending/quote", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/lending/quote")>();
  return { ...actual, calculateQuote: vi.fn(actual.calculateQuote) };
});

vi.mock("@/lib/lending/amortization", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/lending/amortization")>();
  return {
    ...actual,
    generateAmortizationSchedule: vi.fn(actual.generateAmortizationSchedule),
  };
});

import { calculateQuote } from "@/lib/lending/quote";
import { generateAmortizationSchedule } from "@/lib/lending/amortization";

const mockedQuote = vi.mocked(calculateQuote);
const mockedSchedule = vi.mocked(generateAmortizationSchedule);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseData: LendingData = {
  asset: "XLM",
  amount: 1000,
  interestRate: 10,
  duration: 30,
};

function renderCalc(
  data: LendingData = baseData,
  type: "lend" | "borrow" = "lend",
  onCalculate: ReturnType<typeof vi.fn> = vi.fn(),
) {
  const utils = render(
    <InterestCalculator data={data} type={type} onCalculate={onCalculate} />,
  );
  return { ...utils, onCalculate };
}

/** The pre-first-calc skeleton is the only animate-pulse element in lend mode. */
function skeletonVisible(container: HTMLElement): boolean {
  return container.querySelector(".animate-pulse") !== null;
}

beforeEach(() => {
  // mockReset clears the override; calls fall back to the real implementation
  // supplied in the vi.mock factory.
  mockedQuote.mockReset();
  mockedSchedule.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe("InterestCalculator — success path", () => {
  it("renders the lend summary and publishes exactly one result (I1/I2)", () => {
    const { container, onCalculate } = renderCalc();

    expect(screen.getByText(/earnings summary/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(skeletonVisible(container)).toBe(false);

    expect(onCalculate).toHaveBeenCalledTimes(1);
    expect(onCalculate).toHaveBeenCalledWith(
      expect.objectContaining({
        totalEarnings: expect.any(Number),
        dailyEarnings: expect.any(Number),
      }),
    );

    // Invariant: a rendered result is always display-safe.
    expect(container.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("renders the borrow summary with an amortization schedule on success", async () => {
    const { container, onCalculate } = renderCalc(baseData, "borrow");

    expect(screen.getByText(/loan summary/i)).toBeInTheDocument();
    // The schedule is a lazy import — await it so the assertion (and the
    // loader promise) resolve inside this test.
    expect(
      await screen.findByRole("table", { name: /amortization schedule/i }),
    ).toBeInTheDocument();

    expect(onCalculate).toHaveBeenCalledWith(
      expect.objectContaining({
        monthlyPayment: expect.any(Number),
        totalRepayment: expect.any(Number),
      }),
    );
    expect(container.textContent).not.toMatch(/NaN|Infinity/);
  });
});

// ---------------------------------------------------------------------------
// I3 — validation routing / boundary inputs
// ---------------------------------------------------------------------------

describe("InterestCalculator — validation routing & boundaries (I3)", () => {
  it("shows the empty state for amount 0 and notifies the parent with null", () => {
    const { container, onCalculate } = renderCalc({ ...baseData, amount: 0 });

    expect(screen.getByText(/enter an amount above 0/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(skeletonVisible(container)).toBe(false);
    expect(onCalculate).toHaveBeenCalledWith(null);
  });

  it("shows the empty state for a negative amount", () => {
    const { container, onCalculate } = renderCalc({
      ...baseData,
      amount: -100,
    });

    expect(screen.getByText(/enter an amount above 0/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onCalculate).toHaveBeenCalledWith(null);
  });

  it("shows the empty state for a NaN amount — never a skeleton or alert", () => {
    const { container, onCalculate } = renderCalc({
      ...baseData,
      amount: Number.NaN,
    });

    expect(screen.getByText(/enter an amount above 0/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(skeletonVisible(container)).toBe(false);
    expect(onCalculate).toHaveBeenCalledWith(null);
  });

  it("shows the empty state for an Infinity amount — never a permanent skeleton", () => {
    // Regression (#1530): `Infinity <= 0` is false, so the old guard let a
    // non-finite amount fall through and the skeleton branch shimmered
    // forever. The skeleton condition is now finite-guarded.
    const { container, onCalculate } = renderCalc({
      ...baseData,
      amount: Number.POSITIVE_INFINITY,
    });

    expect(screen.getByText(/enter an amount above 0/i)).toBeInTheDocument();
    expect(skeletonVisible(container)).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onCalculate).toHaveBeenCalledWith(null);
  });

  it("shows a diagnosable alert — not a permanent skeleton — when the rate is 0", () => {
    // Regression (#1530): the old guard reset state for rate <= 0 while
    // amount > 0, leaving the render stuck on the loading skeleton forever.
    const { container, onCalculate } = renderCalc({
      ...baseData,
      interestRate: 0,
    });

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toMatch(/invalid input/i);
    expect(skeletonVisible(container)).toBe(false);
    expect(onCalculate).toHaveBeenCalledWith(null);
  });

  it("shows an alert when the interest rate is negative", () => {
    const { container } = renderCalc({ ...baseData, interestRate: -5 });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(skeletonVisible(container)).toBe(false);
  });

  it("shows an alert when the interest rate is NaN", () => {
    renderCalc({ ...baseData, interestRate: Number.NaN });

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it.each([0, -30, Number.NaN])(
    "shows an alert for invalid duration %p (I1: error, not stale results)",
    (duration) => {
      const { onCalculate } = renderCalc({ ...baseData, duration });

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.queryByText(/earnings summary/i)).toBeNull();
      expect(onCalculate).toHaveBeenCalledWith(null);
    },
  );

  it("rejects an unknown quote type instead of rendering wrong-mode output", () => {
    const { onCalculate } = renderCalc(baseData, "repay" as never);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toMatch(/invalid input/i);
    expect(onCalculate).toHaveBeenCalledWith(null);
  });

  it("renders a tiny positive amount without NaN/Infinity", () => {
    const { container } = renderCalc({ ...baseData, amount: 0.01 });

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/earnings summary/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("handles a borrow quote with Number.MIN_VALUE rate without crashing", () => {
    const { container } = renderCalc(
      { ...baseData, interestRate: Number.MIN_VALUE },
      "borrow",
    );

    // Either outcome is valid and deterministic; crashing or rendering
    // non-finite numbers is not.
    const settled =
      screen.queryByRole("alert") ?? screen.queryByText(/loan summary/i);
    expect(settled).not.toBeNull();
    expect(container.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("maps a borrow quote that overflows to NON_FINITE_RESULT, not a crash", () => {
    renderCalc({ ...baseData, interestRate: Number.MAX_VALUE }, "borrow");

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toMatch(/NON_FINITE_RESULT/);
  });

  it("never renders NaN/Infinity for a huge lend amount", () => {
    const { container } = renderCalc({ ...baseData, amount: 1e308 });

    expect(container.textContent).not.toMatch(/NaN|Infinity/);
    expect(
      screen.queryByRole("alert") ?? screen.queryByText(/earnings summary/i),
    ).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// I2 — stale-state / state transitions
// ---------------------------------------------------------------------------

describe("InterestCalculator — state transitions clear stale parent state (I2)", () => {
  it("notifies null when inputs transition from valid back to amount 0", () => {
    const onCalculate = vi.fn();
    const { rerender } = renderCalc(baseData, "lend", onCalculate);

    expect(onCalculate).toHaveBeenCalledWith(
      expect.objectContaining({ dailyEarnings: expect.any(Number) }),
    );
    expect(onCalculate).toHaveBeenCalledTimes(1);

    act(() => {
      rerender(
        <InterestCalculator
          data={{ ...baseData, amount: 0 }}
          type="lend"
          onCalculate={onCalculate}
        />,
      );
    });

    // Parent must be told to clear — TransactionSummary can never keep the
    // previous result after the calculator rejects the input.
    expect(onCalculate).toHaveBeenLastCalledWith(null);
    expect(screen.getByText(/enter an amount above 0/i)).toBeInTheDocument();
    expect(screen.queryByText(/earnings summary/i)).toBeNull();
  });

  it("notifies null and swaps to the error alert when a good quote turns invalid", () => {
    const onCalculate = vi.fn();
    const { rerender } = renderCalc(baseData, "lend", onCalculate);

    act(() => {
      rerender(
        <InterestCalculator
          data={{ ...baseData, duration: 0 }}
          type="lend"
          onCalculate={onCalculate}
        />,
      );
    });

    expect(onCalculate).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/earnings summary/i)).toBeNull();
  });

  it("recovers to a rendered result when the user fixes an invalid input (retry path)", () => {
    const onCalculate = vi.fn();
    const { rerender } = renderCalc(
      { ...baseData, interestRate: 0 },
      "lend",
      onCalculate,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    act(() => {
      rerender(
        <InterestCalculator
          data={{ ...baseData, interestRate: 10 }}
          type="lend"
          onCalculate={onCalculate}
        />,
      );
    });

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/earnings summary/i)).toBeInTheDocument();
    expect(onCalculate).toHaveBeenLastCalledWith(
      expect.objectContaining({ dailyEarnings: expect.any(Number) }),
    );
  });

  it("produces a consistent final state after a rapid 1000 → 0 → 1000 sequence", () => {
    const onCalculate = vi.fn();
    const { rerender, container } = renderCalc(baseData, "lend", onCalculate);

    // Flush each transition separately (RTL's rerender is act-wrapped) so the
    // intermediate clear is observed exactly as a parent would see it.
    rerender(
      <InterestCalculator
        data={{ ...baseData, amount: 0 }}
        type="lend"
        onCalculate={onCalculate}
      />,
    );
    rerender(
      <InterestCalculator
        data={baseData}
        type="lend"
        onCalculate={onCalculate}
      />,
    );

    // Final render reflects the final input…
    expect(screen.getByText(/earnings summary/i)).toBeInTheDocument();
    expect(skeletonVisible(container)).toBe(false);
    // …and the notification trail ends with the final result.
    const lastCall = onCalculate.mock.calls.at(-1)?.[0];
    expect(lastCall).not.toBeNull();
    expect(lastCall).toEqual(
      expect.objectContaining({ dailyEarnings: expect.any(Number) }),
    );
    // The intermediate clearing was observed (no stale result published).
    expect(onCalculate.mock.calls.some((call) => call[0] === null)).toBe(true);
  });

  it("unmounts cleanly after rapid input changes without throwing", () => {
    const onCalculate = vi.fn();
    const { rerender, unmount } = renderCalc(baseData, "lend", onCalculate);

    expect(() => {
      act(() => {
        rerender(
          <InterestCalculator
            data={{ ...baseData, interestRate: 0 }}
            type="lend"
            onCalculate={onCalculate}
          />,
        );
        unmount();
      });
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// I6 — duplicate inputs / callback identity
// ---------------------------------------------------------------------------

describe("InterestCalculator — deterministic recompute (I6)", () => {
  it("does not recompute or re-notify when rerendered with identical inputs", () => {
    const onCalculate = vi.fn();
    const { rerender } = renderCalc(baseData, "lend", onCalculate);

    expect(mockedQuote).toHaveBeenCalledTimes(1);

    act(() => {
      rerender(
        <InterestCalculator
          data={{ ...baseData }}
          type="lend"
          onCalculate={onCalculate}
        />,
      );
      rerender(
        <InterestCalculator
          data={{ ...baseData }}
          type="lend"
          onCalculate={onCalculate}
        />,
      );
    });

    expect(mockedQuote).toHaveBeenCalledTimes(1);
    expect(onCalculate).toHaveBeenCalledTimes(1);
  });

  it("ignores a new inline onCalculate identity from a re-rendering parent", () => {
    // I6: the callback is read through a ref, so a parent re-render with a
    // fresh closure must not trigger recomputation or duplicate notifications.
    const { rerender } = render(
      <InterestCalculator data={baseData} type="lend" onCalculate={() => {}} />,
    );
    expect(mockedQuote).toHaveBeenCalledTimes(1);

    act(() => {
      rerender(
        <InterestCalculator
          data={baseData}
          type="lend"
          onCalculate={() => {}}
        />,
      );
    });

    expect(mockedQuote).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// I4 — exception containment
// ---------------------------------------------------------------------------

describe("InterestCalculator — exception containment (I4)", () => {
  it("converts a throwing calculateQuote into a diagnosable alert, not a crash", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedQuote.mockImplementation(() => {
      throw new Error("kernel panic in quote engine");
    });

    const { container, onCalculate } = renderCalc();

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toMatch(/UNEXPECTED_ERROR/);
    expect(alert.textContent).toMatch(/unable to calculate/i);

    // Raw error detail never reaches the DOM (no message, no stack frames).
    expect(container.textContent).not.toMatch(/kernel panic/);
    expect(container.textContent).not.toMatch(/\.test\.tsx/);

    // …but the failure is diagnosable via logs, name + message only.
    expect(errSpy).toHaveBeenCalledWith(
      "[InterestCalculator] calculateQuote threw:",
      "Error: kernel panic in quote engine",
    );

    expect(onCalculate).toHaveBeenCalledWith(null);
    expect(screen.queryByText(/enter an amount above 0/i)).toBeNull();
  });

  it("keeps rendering a standard quote error alert with message and code", () => {
    mockedQuote.mockReturnValue({
      ok: false,
      error: { code: "DIVIDE_BY_ZERO", message: "Denominator is zero." },
    });

    renderCalc();

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/denominator is zero/i);
    expect(alert.textContent).toMatch(/DIVIDE_BY_ZERO/);
    expect(screen.queryByText(/enter an amount above 0/i)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// I5 — parent callback isolation
// ---------------------------------------------------------------------------

describe("InterestCalculator — parent callback isolation (I5)", () => {
  it("still renders the committed result when onCalculate throws", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const throwing = vi.fn(() => {
      throw new Error("parent exploded");
    });

    const { container } = renderCalc(baseData, "lend", throwing);

    // State was committed before the callback ran; the throw was contained.
    expect(screen.getByText(/earnings summary/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/NaN|Infinity/);
    expect(errSpy).toHaveBeenCalledWith(
      "[InterestCalculator] onCalculate callback threw:",
      "Error: parent exploded",
    );
    // The raw callback failure is not rendered into the UI.
    expect(container.textContent).not.toMatch(/parent exploded/);
  });

  it("contains a throwing parent callback on the error path too", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedQuote.mockReturnValue({
      ok: false,
      error: { code: "INVALID_INPUT", message: "Invalid input." },
    });
    const throwing = vi.fn(() => {
      throw new Error("parent exploded");
    });

    expect(() => renderCalc(baseData, "lend", throwing)).not.toThrow();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(errSpy).toHaveBeenCalledWith(
      "[InterestCalculator] onCalculate callback threw:",
      "Error: parent exploded",
    );
  });
});

// ---------------------------------------------------------------------------
// I7 — partial failure of the amortization schedule
// ---------------------------------------------------------------------------

describe("InterestCalculator — schedule partial failure (I7)", () => {
  it("keeps the loan summary and logs when schedule generation fails", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockedSchedule.mockReturnValue({
      ok: false,
      error: "Invalid input: amount and interest rate must be positive numbers",
    });

    const { container } = renderCalc(baseData, "borrow");

    // Partial failure must not block the primary summary (I1: summary state
    // stays consistent even though the schedule slice failed).
    expect(screen.getByText(/loan summary/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: /amortization schedule/i }),
    ).toBeNull();
    expect(container.textContent).not.toMatch(/NaN|Infinity/);

    // Diagnosable without sensitive data: the error string is the generic
    // validation message from generateAmortizationSchedule.
    expect(warnSpy).toHaveBeenCalledWith(
      "[InterestCalculator] amortization schedule unavailable:",
      expect.stringContaining("positive numbers"),
    );
  });

  it("contains a schedule generator that throws and still renders the summary", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedSchedule.mockImplementation(() => {
      throw new Error("schedule exploded");
    });

    expect(() => renderCalc(baseData, "borrow")).not.toThrow();
    expect(screen.getByText(/loan summary/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: /amortization schedule/i }),
    ).toBeNull();
    expect(errSpy).toHaveBeenCalledWith(
      "[InterestCalculator] generateAmortizationSchedule threw:",
      "Error: schedule exploded",
    );
  });
});
