import React from 'react';
import { render, screen, fireEvent, waitFor, act } from "@/test/test-utils";
import BorrowingForm from "./BorrowingForm";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("BorrowingForm Component", () => {
  const mockInitialData = {
    asset: 'USDC',
    amount: 0,
    collateral: 'XLM',
    collateralAmount: 0,
    duration: 30,
  };
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnSubmit.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          prices: {
            XLM: 0.12,
            USDC: 1,
            BTC: 65000,
            ETH: 3500,
          },
        }),
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders correctly", () => {
    render(<BorrowingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);
    
    expect(screen.getByText(/Borrow Against Collateral/i)).toBeInTheDocument();
  });

  it("calculates required collateral", async () => {
    render(<BorrowingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);
    
    const amountInput = screen.getByLabelText(/Amount to Borrow/i);
    fireEvent.change(amountInput, { target: { value: "100" } });
    
    // Required collateral should be 150 (150% of 100)
    expect(screen.getByText("150 XLM")).toBeInTheDocument();
  });

  it("shows projected health preview from collateral and price data", async () => {
    render(<BorrowingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByLabelText(/Amount to Borrow/i), {
      target: { value: "100" },
    });

    expect(screen.getByText(/Projected Health Preview/i)).toBeInTheDocument();
    expect(screen.getByText(/Health factor/i)).toBeInTheDocument();
    expect(screen.getByText(/Critical/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/prices?assets=USDC,XLM",
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });
  });

  it("updates the projected band when collateral amount changes", () => {
    render(
      <BorrowingForm
        initialData={{
          ...mockInitialData,
          amount: 100,
          collateral: "USDC",
          collateralAmount: 300,
        }}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText(/Healthy/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Collateral Amount/i), {
      target: { value: "120" },
    });

    expect(screen.getByText(/At Risk/i)).toBeInTheDocument();
  });

  it("validates insufficient collateral balance", async () => {
    render(<BorrowingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);
    
    const amountInput = screen.getByLabelText(/Amount to Borrow/i);
    fireEvent.change(amountInput, { target: { value: "5000" } }); // 150% is 7500, balance is 3750
    
    const submitButton = screen.getByText(/Review Loan Request/i);
    fireEvent.click(submitButton);
    
    expect(await screen.findByText(/Insufficient collateral balance/i)).toBeInTheDocument();
    // Verify our new top-level error banner
    expect(screen.getByText(/Please fix the errors in the form before continuing/i)).toBeInTheDocument();
  });

  it("submits successfully with valid data", async () => {
    render(<BorrowingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);
    
    fireEvent.change(screen.getByLabelText(/Amount to Borrow/i), { target: { value: "10" } });
    
    const submitButton = screen.getByText(/Review Loan Request/i);
    fireEvent.click(submitButton);
    
    // Fast-forward through the 800ms simulated loading delay
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    await waitFor(() => {
      // Verify our new success banner
      expect(screen.getByText(/Details validated successfully/i)).toBeInTheDocument();
      expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
        amount: 10,
        collateral: 'XLM'
      }));
    });
  });
});
