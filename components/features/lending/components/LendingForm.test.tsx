import React from 'react';
import { render, screen, fireEvent, waitFor, act } from "@/test/test-utils";
import LendingForm from "./LendingForm";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("LendingForm Component", () => {
  const mockInitialData = {
    asset: 'XLM',
    amount: 0,
    interestRate: 8.5,
  };
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders correctly", () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);
    
    expect(screen.getByText(/Lend Your Assets/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount to Lend/i)).toBeInTheDocument();
  });

  it("validates amount is positive", async () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);
    
    const submitButton = screen.getByText(/Review Lending Offer/i);
    fireEvent.click(submitButton);
    
    expect(await screen.findByText(/Please enter a valid amount/i)).toBeInTheDocument();
    // Verify our new top-level error banner
    expect(screen.getByText(/Please fix the errors in the form before continuing/i)).toBeInTheDocument();
  });

  it("validates balance", async () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);
    
    const amountInput = screen.getByLabelText(/Amount to Lend/i);
    fireEvent.change(amountInput, { target: { value: "10000" } }); // Above XLM balance
    
    const submitButton = screen.getByText(/Review Lending Offer/i);
    fireEvent.click(submitButton);
    
    expect(await screen.findByText(/Insufficient balance/i)).toBeInTheDocument();
  });

  it("handles MAX button click", () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);
    
    const maxButton = screen.getByRole("button", { name: /^MAX$/i });
    fireEvent.click(maxButton);
    
    const amountInput = screen.getByLabelText(/Amount to Lend/i) as HTMLInputElement;
    expect(amountInput.value).toBe("3,750.0000000"); // XLM balance is 3750, formatted to precision 7
  });

  it("submits successfully with valid data", async () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);
    
    fireEvent.change(screen.getByLabelText(/Amount to Lend/i), { target: { value: "100" } });
    
    const submitButton = screen.getByText(/Review Lending Offer/i);
    fireEvent.click(submitButton);
    
    // Fast-forward through the 800ms simulated loading delay
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    await waitFor(() => {
      // Verify our new success banner
      expect(screen.getByText(/Details validated successfully/i)).toBeInTheDocument();
      expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
        amount: 100,
        asset: 'XLM'
      }));
    });
  });

  it("rejects zero and negative amounts", async () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

    const amountInput = screen.getByLabelText(/Amount to Lend/i);

    // Zero amount
    fireEvent.change(amountInput, { target: { value: "0" } });
    fireEvent.click(screen.getByText(/Review Lending Offer/i));
    expect(await screen.findByText(/Please enter a valid amount/i)).toBeInTheDocument();

    // Negative amount
    fireEvent.change(amountInput, { target: { value: "-50" } });
    fireEvent.click(screen.getByText(/Review Lending Offer/i));
    expect(await screen.findByText(/Please enter a valid amount/i)).toBeInTheDocument();
  });

  it("rejects interest rate below minimum", async () => {
    render(<LendingForm initialData={{ ...mockInitialData, interestRate: 2.0 }} onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByLabelText(/Amount to Lend/i), { target: { value: "100" } });
    fireEvent.click(screen.getByText(/Review Lending Offer/i));

    expect(await screen.findByText(/Interest rate must be between/)).toBeInTheDocument();
  });

  it("rejects interest rate above maximum", async () => {
    render(<LendingForm initialData={{ ...mockInitialData, interestRate: 15.0 }} onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByLabelText(/Amount to Lend/i), { target: { value: "100" } });
    fireEvent.click(screen.getByText(/Review Lending Offer/i));

    expect(await screen.findByText(/Interest rate must be between/)).toBeInTheDocument();
  });

  it("updates default interest rate when asset changes", async () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

    // XLM default is 8.5
    expect(screen.getByText(/8\.5% APY/)).toBeInTheDocument();

    // Switch to USDC — default should become 6.5
    const optionUSDC = screen.getByRole("option", { name: /USDC/i });
    fireEvent.click(optionUSDC);

    // After the useEffect fires, the rate should update
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByText(/6\.5% APY/)).toBeInTheDocument();
  });

  it("resets errors after editing amount", async () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

    // Submit empty form to trigger validation
    fireEvent.click(screen.getByText(/Review Lending Offer/i));
    expect(await screen.findByText(/Please enter a valid amount/i)).toBeInTheDocument();

    // Edit the amount — error should be cleared
    fireEvent.change(screen.getByLabelText(/Amount to Lend/i), { target: { value: "200" } });

    await waitFor(() => {
      expect(screen.queryByText(/Please enter a valid amount/i)).not.toBeInTheDocument();
    });
  });

  it("shows submit error banner when validation fails on submit", async () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

    fireEvent.click(screen.getByText(/Review Lending Offer/i));

    expect(await screen.findByText(/Please fix the errors in the form before continuing/i)).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("disables submit button while submitting (loading state)", async () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByLabelText(/Amount to Lend/i), { target: { value: "100" } });
    fireEvent.click(screen.getByText(/Review Lending Offer/i));

    // Button should show loading state
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /review lending offer/i })).toBeDisabled();
    });
  });

  it("renders lending terms section", () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

    expect(screen.getByText("Lending Terms")).toBeInTheDocument();
    expect(screen.getByText(/Minimum lending period: 7 days/)).toBeInTheDocument();
    expect(screen.getByText(/Interest is calculated daily and compounded/)).toBeInTheDocument();
  });

  it("renders interest rate min/max/default markers", () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

    expect(screen.getByText(/MIN: 5\.0%/)).toBeInTheDocument();
    expect(screen.getByText(/DEFAULT: 8\.5%/)).toBeInTheDocument();
    expect(screen.getByText(/MAX: 12\.0%/)).toBeInTheDocument();
  });

  it("accepts rate at boundary values (min and max)", async () => {
    const { rerender } = render(
      <LendingForm initialData={{ ...mockInitialData, interestRate: 5.0 }} onSubmit={mockOnSubmit} />,
    );

    fireEvent.change(screen.getByLabelText(/Amount to Lend/i), { target: { value: "100" } });
    fireEvent.click(screen.getByText(/Review Lending Offer/i));

    // Rate = min (5.0) should be valid
    act(() => { vi.advanceTimersByTime(1000); });
    await waitFor(() => {
      expect(screen.getByText(/Details validated successfully/i)).toBeInTheDocument();
    });

    // Now test with rate = max (12.0)
    rerender(
      <LendingForm initialData={{ ...mockInitialData, interestRate: 12.0 }} onSubmit={mockOnSubmit} />,
    );

    fireEvent.click(screen.getByText(/Review Lending Offer/i));
    act(() => { vi.advanceTimersByTime(1000); });
    await waitFor(() => {
      expect(screen.getByText(/Details validated successfully/i)).toBeInTheDocument();
    });
  });
});