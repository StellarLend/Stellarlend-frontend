/**
 * Tests for the tx-toasts store and TxToastRegion component.
 *
 * Covers:
 *  - Rendering a pending toast and aria-live region.
 *  - confirmed → auto-dismiss after 6 s (fake timers).
 *  - cancelled → auto-dismiss after 3 s (fake timers).
 *  - failed → persists; can be manually dismissed.
 *  - timeout → persists; shows explorer link.
 *  - Multiple concurrent toasts stack up to MAX_VISIBLE (4).
 *  - Localized messages per status.
 */

import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";

import { TxToastsProvider, TxToastRegion, useTxToasts } from "./tx-toasts";
import type { LendingTx } from "@/lib/lending-client";

// ─── helpers ──────────────────────────────────────────────────────────────────

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <TxToastsProvider>
        {children}
        <TxToastRegion />
      </TxToastsProvider>
    </NextIntlClientProvider>
  );
}

/** Minimal trigger component that calls addToast on click. */
function AddToastButton({
  id,
  tx,
  label = "add",
}: {
  id?: string;
  tx: LendingTx;
  label?: string;
}) {
  const { addToast } = useTxToasts();
  return (
    <button
      onClick={() => addToast({ id, action: "deposit", symbol: "XLM", tx })}
    >
      {label}
    </button>
  );
}

function AddToastReturnsId({ onId }: { onId: (id: string) => void }) {
  const { addToast } = useTxToasts();
  return (
    <button
      onClick={() => {
        const id = addToast({
          action: "borrow",
          symbol: "USDC",
          tx: { status: "pending", hash: null, error: null },
        });
        onId(id);
      }}
    >
      add
    </button>
  );
}

// ─── setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── tests ────────────────────────────────────────────────────────────────────

describe("TxToastRegion – aria-live region", () => {
  it("renders an aria-live polite region", () => {
    render(
      <Wrapper>
        <></>
      </Wrapper>,
    );
    expect(
      screen.getByRole("region", { name: /transaction notifications/i }),
    ).toHaveAttribute("aria-live", "polite");
  });
});

describe("TxToastRegion – pending toast", () => {
  it("shows a pending message with the correct role and text", () => {
    render(
      <Wrapper>
        <AddToastButton
          tx={{ status: "pending", hash: null, error: null }}
        />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: "add" }));

    const statuses = screen.getAllByRole("status");
    const toastStatus = statuses.find((el) =>
      el.textContent?.includes("Supply of XLM pending"),
    );
    expect(toastStatus).toBeTruthy();
  });
});

describe("TxToastRegion – confirmed auto-dismiss", () => {
  it("auto-dismisses a confirmed toast after 6 s", async () => {
    render(
      <Wrapper>
        <AddToastButton
          tx={{ status: "confirmed", hash: null, error: null }}
        />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: "add" }));

    // Toast is visible right after adding.
    expect(
      screen.getAllByRole("status").find((el) =>
        el.textContent?.includes("Supply of XLM confirmed"),
      ),
    ).toBeTruthy();

    // After 6 s it should vanish.
    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    expect(
      screen.queryAllByRole("status").find((el) =>
        el.textContent?.includes("Supply of XLM confirmed"),
      ),
    ).toBeFalsy();
  });
});

describe("TxToastRegion – cancelled auto-dismiss", () => {
  it("auto-dismisses a cancelled toast after 3 s", () => {
    render(
      <Wrapper>
        <AddToastButton
          tx={{ status: "cancelled", hash: null, error: null }}
        />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: "add" }));

    // Still visible at < 3 s.
    act(() => {
      vi.advanceTimersByTime(2_900);
    });
    expect(
      screen.getAllByRole("status").find((el) =>
        el.textContent?.includes("Supply of XLM cancelled"),
      ),
    ).toBeTruthy();

    // Gone after 3 s.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(
      screen.queryAllByRole("status").find((el) =>
        el.textContent?.includes("Supply of XLM cancelled"),
      ),
    ).toBeFalsy();
  });
});

describe("TxToastRegion – failed toast persists", () => {
  it("keeps a failed toast visible after 10 s and shows the decoded error", () => {
    render(
      <Wrapper>
        <AddToastButton
          tx={{
            status: "failed",
            hash: null,
            error: { name: "ContractError", code: 1, message: "Insufficient collateral", hint: undefined, raw: "" },
          }}
        />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: "add" }));

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    // Toast still present.
    const toastEl = screen.getAllByRole("status").find((el) =>
      el.textContent?.includes("Insufficient collateral"),
    );
    expect(toastEl).toBeTruthy();
  });

  it("dismisses a failed toast when the dismiss button is clicked", () => {
    render(
      <Wrapper>
        <AddToastButton
          tx={{
            status: "failed",
            hash: null,
            error: { name: "ContractError", code: 1, message: "Bad debt", hint: undefined, raw: "" },
          }}
        />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: "add" }));

    const dismissBtn = screen.getByRole("button", { name: /dismiss/i });
    fireEvent.click(dismissBtn);

    expect(
      screen.queryAllByRole("status").find((el) =>
        el.textContent?.includes("Bad debt"),
      ),
    ).toBeFalsy();
  });
});

describe("TxToastRegion – timeout toast persists", () => {
  it("keeps a timeout toast visible and shows explorer link when hash present", () => {
    render(
      <Wrapper>
        <AddToastButton
          tx={{
            status: "timeout",
            hash: "abc123def456",
            error: null,
          }}
        />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: "add" }));

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(
      screen.getAllByRole("status").find((el) =>
        el.textContent?.includes("Supply of XLM timed out"),
      ),
    ).toBeTruthy();

    const link = screen.getByRole("link", { name: /view transaction/i });
    expect(link).toHaveAttribute("href");
    expect(link.getAttribute("href")).toContain("abc123def456");
  });
});

describe("TxToastRegion – lifecycle upsert", () => {
  it("updates the same toast from pending to confirmed when the same id is re-used", () => {
    let capturedId = "";

    function LifecycleControl() {
      const { addToast } = useTxToasts();
      return (
        <>
          <button
            onClick={() => {
              capturedId = addToast({
                action: "borrow",
                symbol: "USDC",
                tx: { status: "pending", hash: null, error: null },
              });
            }}
          >
            start
          </button>
          <button
            onClick={() => {
              addToast({
                id: capturedId,
                action: "borrow",
                symbol: "USDC",
                tx: { status: "confirmed", hash: null, error: null },
              });
            }}
          >
            confirm
          </button>
        </>
      );
    }

    render(
      <Wrapper>
        <LifecycleControl />
      </Wrapper>,
    );

    // Start the transaction (pending).
    fireEvent.click(screen.getByRole("button", { name: "start" }));
    // Confirm it in-place.
    fireEvent.click(screen.getByRole("button", { name: "confirm" }));

    // Should be exactly one toast for USDC, showing confirmed.
    const toasts = screen.getAllByRole("status").filter((el) =>
      el.textContent?.includes("USDC"),
    );
    expect(toasts.length).toBe(1);
    expect(toasts[0].textContent).toContain("confirmed");
  });
});

describe("TxToastRegion – max 4 visible", () => {
  it("caps at 4 visible toasts and drops excess confirmed ones", () => {
    function AddMany() {
      const { addToast } = useTxToasts();
      return (
        <button
          onClick={() => {
            // Add 5 confirmed toasts.
            for (let i = 0; i < 5; i++) {
              addToast({
                action: "deposit",
                symbol: `TK${i}`,
                tx: { status: "confirmed", hash: null, error: null },
              });
            }
          }}
        >
          add5
        </button>
      );
    }

    render(
      <Wrapper>
        <AddMany />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: "add5" }));

    // Only 4 toasts should be visible (MAX_VISIBLE cap).
    const toasts = screen.getAllByRole("status").filter((el) =>
      el.textContent?.match(/Supply of TK\d/),
    );
    expect(toasts.length).toBeLessThanOrEqual(4);
  });
});

describe("TxToastRegion – announces via live region", () => {
  it("the live region contains the status text", () => {
    render(
      <Wrapper>
        <AddToastButton
          tx={{ status: "confirmed", hash: null, error: null }}
        />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: "add" }));

    const region = screen.getByRole("region", { name: /transaction notifications/i });
    expect(region.textContent).toContain("Supply of XLM confirmed");
  });
});
