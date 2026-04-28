import { render, screen, fireEvent, waitFor } from "@/test/test-utils";
import BorrowingForm from "./BorrowingForm";
import { describe, it, expect, vi } from "vitest";

describe("BorrowingForm Component", () => {
  const mockInitialData = {
    asset: 'USDC',
    amount: 0,
    collateral: 'XLM',
    collateralAmount: 0,
    duration: 30,
  };
  const mockOnSubmit = vi.fn();

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

  it("validates insufficient collateral balance", async () => {
    render(<BorrowingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);
    
    const amountInput = screen.getByLabelText(/Amount to Borrow/i);
    fireEvent.change(amountInput, { target: { value: "5000" } }); // 150% is 7500, balance is 3750
    
    const submitButton = screen.getByText(/Review Loan Request/i);
    fireEvent.click(submitButton);
    
    expect(await screen.findByText(/Insufficient collateral balance/i)).toBeInTheDocument();
  });

  it("submits successfully with valid data", async () => {
    render(<BorrowingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);
    
    fireEvent.change(screen.getByLabelText(/Amount to Borrow/i), { target: { value: "10" } });
    
    const submitButton = screen.getByText(/Review Loan Request/i);
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
        amount: 10,
        collateral: 'XLM'
      }));
    });
  });
});
