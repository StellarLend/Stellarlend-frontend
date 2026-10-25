import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SwapQuotePanel from "./swap-quote";
import type { PoolSnapshot, SimulatedSwapQuote } from "@/lib/amm/liquidity-client";

vi.mock("@/components/wallet", () => ({
  useWallet: () => ({
    address: "GUSER123456789012345678901234567890123456789012345678901234",
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
});
