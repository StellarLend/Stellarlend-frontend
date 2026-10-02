import React from "react";
import { render, screen, fireEvent } from "@/test/test-utils";
import BorrowingForm from "./BorrowingForm";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ASSETS } from "@/lib/assets";

/**
 * #1452 regression guard.
 *
 * `BorrowingForm` validates `collateralAmount` against
 * `collateralAsset.balance` and clamps its target-collateral shortcut to the
 * same number. Those tests pin the source of that number to the live
 * `useWalletBalances()` output instead of the made-up constants in
 * `lib/assets.ts`.
 */

const mockUseWalletBalances = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useWalletBalances", () => ({
  useWalletBalances: mockUseWalletBalances,
}));

vi.mock("@/hooks/useWalletConnection", () => ({
  useWalletConnection: () => ({
    walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    isConnected: true,
    isLoading: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

const INITIAL_DATA = {
  asset: "USDC",
  amount: 0,
  collateral: "XLM",
  collateralAmount: 0,
  duration: 30,
};

/** Canonical ASSETS list with the given symbols replaced by live balances. */
function liveBalances(overrides: Record<string, number>) {
  return ASSETS.map((asset) =>
    asset.symbol in overrides
      ? { ...asset, balance: overrides[asset.symbol] }
      : asset,
  );
}

function mockWallet(balances: Record<string, number>) {
  mockUseWalletBalances.mockReturnValue({
    assetsWithBalances: liveBalances(balances),
    loading: false,
    error: null,
  });
}

const mockOnSubmit = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  mockOnSubmit.mockClear();
  mockWallet({});
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes("/api/markets")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            markets: [
              {
                asset: "USDC",
                supplyApr: 5.5,
                borrowApr: 11.25,
                utilization: 0.5,
                totalSupply: 1000,
                totalBorrow: 500,
              },
            ],
            timestamp: "2026-06-29T12:00:00.000Z",
            source: "test",
          }),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          prices: { XLM: 0.12, USDC: 1, BTC: 65000, ETH: 3500 },
        }),
      } as Response);
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("BorrowingForm live collateral balance", () => {
  it("rejects collateral that exceeds the live wallet balance", () => {
    mockWallet({ XLM: 100 });

    const { container } = render(
      <BorrowingForm initialData={INITIAL_DATA} onSubmit={mockOnSubmit} />,
    );

    // 100 USDC at 150% coverage needs 1,250 XLM; the wallet only has 100. The
    // form auto-fills the required collateral, so the value under test is the
    // required 1,250 — which the hardcoded ASSETS constant (3,750) would have
    // accepted. Rejecting therefore proves the live balance is used.
    fireEvent.change(screen.getByLabelText(/Amount to Borrow/i), {
      target: { value: "100" },
    });

    // The shared <Button> swallows the click before jsdom's implicit form
    // submission, so drive the form element directly.
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    expect(
      screen.getByText(/Insufficient collateral balance/i),
    ).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("leaves the target-collateral suggestion alone when the live balance covers it", () => {
    mockWallet({ XLM: 5000 });

    render(
      <BorrowingForm
        initialData={{ ...INITIAL_DATA, amount: 100 }}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText("2,000 XLM")).toBeInTheDocument();
    expect(
      screen.queryByText(/Target requires more than your balance/i),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Apply Suggested Collateral/i }),
    );

    expect(screen.getByLabelText(/Collateral Amount/i)).toHaveValue("2,000");
  });

  it("clamps the target-collateral shortcut to the live balance", () => {
    mockWallet({ XLM: 300 });

    render(
      <BorrowingForm
        initialData={{ ...INITIAL_DATA, amount: 100 }}
        onSubmit={mockOnSubmit}
      />,
    );

    // A 2x target health needs 2,000 XLM, more than the 300 the wallet holds.
    expect(
      screen.getByText(/Target requires more than your balance/i),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Apply Available Balance/i }),
    );

    expect(screen.getByLabelText(/Collateral Amount/i)).toHaveValue("300");
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
