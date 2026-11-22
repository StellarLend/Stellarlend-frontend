import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SwapQuotePanel from "./swap-quote";
import type { PoolSnapshot, SimulatedSwapQuote } from "@/lib/amm/liquidity-client";
import { IMPACT_GUARD_DISABLED } from "@/lib/amm/quote";

const walletState = vi.hoisted(() => ({
  address: "GUSER123456789012345678901234567890123456789012345678901234" as string | null,
}));

vi.mock("@/components/wallet", () => ({
  useWallet: () => ({
    address: walletState.address,
    connect: vi.fn(),
  }),
}));

const mockSnapshot: PoolSnapshot = {
  reserveA: 1_000_000_000_000n, // 100,000 tokens with 7 decimals
  reserveB: 1_000_000_000_000n,
  totalSupply: 1_000_000_000_000n,
  minimumReserve: 1_000_000n, // 0.1 tokens
  userShares: 10_000_000_000n,
  feeBps: 30n,
  minSwapIn: 1_000_000n, // 0.1 tokens
  maxImpactBps: 500, // 5%
  tokenA: { decimals: 7, balance: 50_000_000_000n, trustline: "active" },
  tokenB: { decimals: 7, balance: 50_000_000_000n, trustline: "active" },
  ledger: 123456,
  fetchedAt: 1000,
};

const defaultMockSim = vi.fn(async (): Promise<SimulatedSwapQuote> => ({
  amountOut: 99_690_060n,
  fee: 300_000n,
  reserveAAfter: 1_000_100_000_000n,
  reserveBAfter: 999_900_309_940n,
}));

describe("SwapQuotePanel component", () => {
  beforeEach(() => {
    walletState.address = "GUSER123456789012345678901234567890123456789012345678901234";
    window.sessionStorage.clear();
  });
  it("renders direction toggle and switches direction", async () => {
    render(<SwapQuotePanel initialSnapshot={mockSnapshot} onSimulateQuote={defaultMockSim} />);
    expect(screen.getByText("Token A")).toBeInTheDocument();
    expect(screen.getByText("Token B")).toBeInTheDocument();

    const switchBtn = screen.getByRole("button", { name: "Reverse swap direction" });
    fireEvent.click(switchBtn);

    expect(screen.getByText("You Pay (Token B)")).toBeInTheDocument();
  });

  it("debounces user input before computing quote and simulation", async () => {
    const mockSim = vi.fn(async (): Promise<SimulatedSwapQuote> => ({
      amountOut: 98_715_803n,
      fee: 300_000n,
      reserveAAfter: 1_000_100_000_000n,
      reserveBAfter: 999_901_284_197n,
    }));

    render(<SwapQuotePanel initialSnapshot={mockSnapshot} onSimulateQuote={mockSim} />);

    const input = screen.getByLabelText("You Pay (Token A)");
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.change(input, { target: { value: "10" } });

    expect(mockSim).not.toHaveBeenCalled();

    await waitFor(
      () => {
        expect(mockSim).toHaveBeenCalledWith(
          expect.any(String),
          100_000_000n,
          30n,
          true,
        );
      },
      { timeout: 3000 },
    );
    expect(mockSim).toHaveBeenCalledTimes(1);
  });

  it("shows Quote Verified when simulation matches local calculation exactly", async () => {
    const mockSim = vi.fn(async (): Promise<SimulatedSwapQuote> => ({
      amountOut: 99_690_060n,
      fee: 300_000n,
      reserveAAfter: 1_000_100_000_000n,
      reserveBAfter: 999_900_309_940n,
    }));

    render(<SwapQuotePanel initialSnapshot={mockSnapshot} onSimulateQuote={mockSim} />);

    const input = screen.getByLabelText("You Pay (Token A)");
    fireEvent.change(input, { target: { value: "10" } });

    await waitFor(
      () => {
        expect(screen.getByTestId("quote-verified")).toBeInTheDocument();
        expect(screen.getByText(/Quote verified on-chain/)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("shows visible warning when local calculation and simulation differ", async () => {
    const mockSim = vi.fn(async (): Promise<SimulatedSwapQuote> => ({
      amountOut: 99_999_999n,
      fee: 300_000n,
      reserveAAfter: 1_000_100_000_000n,
      reserveBAfter: 999_900_000_001n,
    }));

    render(<SwapQuotePanel initialSnapshot={mockSnapshot} onSimulateQuote={mockSim} />);

    const input = screen.getByLabelText("You Pay (Token A)");
    fireEvent.change(input, { target: { value: "10" } });

    await waitFor(
      () => {
        expect(screen.getByTestId("quote-disagreement")).toBeInTheDocument();
        expect(screen.getByText("Quote Disagreement Warning")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("rejects input with more decimals than token supports", async () => {
    render(<SwapQuotePanel initialSnapshot={mockSnapshot} onSimulateQuote={defaultMockSim} />);

    const input = screen.getByLabelText("You Pay (Token A)");
    fireEvent.change(input, { target: { value: "1.12345678" } });

    await waitFor(
      () => {
        expect(screen.getByText(/Amount exceeds maximum token decimals \(7\)/)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("rejects negative, scientific notation, and leading zeros", async () => {
    render(<SwapQuotePanel initialSnapshot={mockSnapshot} onSimulateQuote={defaultMockSim} />);

    const input = screen.getByLabelText("You Pay (Token A)");

    fireEvent.change(input, { target: { value: "1e5" } });
    await waitFor(
      () => {
        expect(screen.getByText(/Scientific exponential notation/)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    fireEvent.change(input, { target: { value: "-5" } });
    await waitFor(
      () => {
        expect(screen.getByText(/Negative amounts are not allowed/)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    fireEvent.change(input, { target: { value: "05" } });
    await waitFor(
      () => {
        expect(screen.getByText(/Invalid number format with leading zeros/)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("displays guard violation when input is below min_swap_in", async () => {
    render(<SwapQuotePanel initialSnapshot={mockSnapshot} onSimulateQuote={defaultMockSim} />);

    const input = screen.getByLabelText("You Pay (Token A)");
    fireEvent.change(input, { target: { value: "0.05" } });

    await waitFor(
      () => {
        const msgs = screen.getAllByText("Input amount is below the pool's minimum swap requirement.");
        expect(msgs.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  });

  it("disables Swap button when price impact exceeds maxImpactBps and enables when IMPACT_GUARD_DISABLED", async () => {
    // Pool reserves = 100,000 tokens each; swapping 10,000 tokens causes ~17.3% impact (> 5% maxImpactBps=500)
    const highImpactSim = vi.fn(async (): Promise<SimulatedSwapQuote> => ({
      amountOut: 90_661_089_388n,
      fee: 300_000_000n,
      reserveAAfter: 1_100_000_000_000n,
      reserveBAfter: 909_338_910_612n,
    }));

    const { rerender } = render(
      <SwapQuotePanel initialSnapshot={mockSnapshot} onSimulateQuote={highImpactSim} />,
    );

    const input = screen.getByLabelText("You Pay (Token A)");
    fireEvent.change(input, { target: { value: "10000" } });

    await waitFor(
      () => {
        const swapBtn = screen.getByTestId("swap-submit-button");
        expect(swapBtn).toBeDisabled();
        expect(swapBtn).toHaveTextContent("Price impact exceeds the pool's safety threshold.");
      },
      { timeout: 3000 },
    );

    rerender(
      <SwapQuotePanel
        initialSnapshot={{ ...mockSnapshot, maxImpactBps: IMPACT_GUARD_DISABLED }}
        onSimulateQuote={highImpactSim}
      />,
    );

    await waitFor(
      () => {
        const swapBtn = screen.getByTestId("swap-submit-button");
        expect(swapBtn).not.toBeDisabled();
        expect(swapBtn).toHaveTextContent("Swap");
      },
      { timeout: 3000 },
    );
  });

  it("disables Swap button for empty pool and disconnected wallet", async () => {
    const emptySnapshot: PoolSnapshot = { ...mockSnapshot, reserveA: 0n };
    const { rerender } = render(
      <SwapQuotePanel initialSnapshot={emptySnapshot} onSimulateQuote={defaultMockSim} />,
    );

    expect(screen.getByTestId("swap-submit-button")).toBeDisabled();
    expect(screen.getByTestId("swap-submit-button")).toHaveTextContent("Pool is Empty");

    walletState.address = null;
    rerender(<SwapQuotePanel initialSnapshot={mockSnapshot} onSimulateQuote={defaultMockSim} />);
    expect(screen.getByTestId("swap-submit-button")).toBeDisabled();
    expect(screen.getByTestId("swap-submit-button")).toHaveTextContent("Connect Wallet to Swap");
  });

  it("validates slippage bounds and persists valid slippage in sessionStorage", async () => {
    render(<SwapQuotePanel initialSnapshot={mockSnapshot} onSimulateQuote={defaultMockSim} />);
    const slippageInput = screen.getByLabelText("Slippage Tolerance (%)");

    expect(slippageInput).toHaveValue("0.5");

    fireEvent.change(slippageInput, { target: { value: "0" } });
    expect(screen.getByText(/between 0.01% and 50%/)).toBeInTheDocument();

    fireEvent.change(slippageInput, { target: { value: "51" } });
    expect(screen.getByText(/between 0.01% and 50%/)).toBeInTheDocument();

    fireEvent.change(slippageInput, { target: { value: "1.25" } });
    expect(window.sessionStorage.getItem("stellarlend:amm-slippage-pct")).toBe("1.25");
  });

  it("submits swap, shows tx explorer link on success, and maps SlippageExceeded error", async () => {
    const mockSubmit = vi.fn(async () => "abc123txhash");

    render(
      <SwapQuotePanel
        initialSnapshot={mockSnapshot}
        onSimulateQuote={defaultMockSim}
        onSubmitSwap={mockSubmit}
      />,
    );

    const input = screen.getByLabelText("You Pay (Token A)");
    fireEvent.change(input, { target: { value: "10" } });

    await waitFor(
      () => {
        expect(screen.getByTestId("swap-submit-button")).not.toBeDisabled();
      },
      { timeout: 3000 },
    );

    fireEvent.click(screen.getByTestId("swap-submit-button"));

    await waitFor(
      () => {
        expect(mockSubmit).toHaveBeenCalledWith(
          walletState.address,
          expect.objectContaining({
            amountIn: 100_000_000n,
            aForB: true,
            slippageBps: 50n,
            quotedAmountOut: 99_690_060n,
          }),
        );
        const link = screen.getByRole("link", { name: /abc123txhash/i });
        expect(link).toHaveAttribute("href", expect.stringContaining("abc123txhash"));
      },
      { timeout: 3000 },
    );

    // Test SlippageExceeded error mapping
    mockSubmit.mockRejectedValueOnce(new Error("HostError: Error(Contract, SlippageExceeded)"));
    fireEvent.change(input, { target: { value: "10" } });

    await waitFor(
      () => {
        expect(screen.getByTestId("swap-submit-button")).not.toBeDisabled();
      },
      { timeout: 3000 },
    );

    fireEvent.click(screen.getByTestId("swap-submit-button"));

    await waitFor(
      () => {
        expect(screen.getByTestId("swap-error")).toHaveTextContent(
          /minimum received amount|slippage tolerance exceeded/i,
        );
      },
      { timeout: 3000 },
    );
  });
});
