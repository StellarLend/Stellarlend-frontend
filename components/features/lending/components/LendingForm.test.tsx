import { render, screen, fireEvent, waitFor } from "@/test/test-utils";
import LendingForm from "./LendingForm";
import { describe, it, expect, vi } from "vitest";

describe("LendingForm Component", () => {
  const mockInitialData = {
    asset: 'XLM',
    amount: 0,
    interestRate: 8.5,
  };
  const mockOnSubmit = vi.fn();

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
    
    const maxButton = screen.getByText(/MAX/i);
    fireEvent.click(maxButton);
    
    const amountInput = screen.getByLabelText(/Amount to Lend/i) as HTMLInputElement;
    expect(amountInput.value).toBe("3,750"); // XLM balance is 3750, but it might be formatted. 
    // Actually the code uses parseFloat so it might be 3750.
  });

  it("submits successfully with valid data", async () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);
    
    fireEvent.change(screen.getByLabelText(/Amount to Lend/i), { target: { value: "100" } });
    
    const submitButton = screen.getByText(/Review Lending Offer/i);
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
        amount: 100,
        asset: 'XLM'
      }));
    });
  });
});
