import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@/test/test-utils";
import RepayForm from "./RepayForm";
import { usePositions, BorrowPosition } from "@/hooks/usePositions";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the usePositions hook
vi.mock("@/hooks/usePositions", () => {
  return {
    usePositions: vi.fn(),
  };
});

describe("RepayForm Component", () => {
  const mockOnSubmit = vi.fn();

  const mockPositions: BorrowPosition[] = [
    { id: "borrow-XLM", asset: "XLM", amount: 1500, healthFactor: 1.5, nextDue: "in 4 days" },
    { id: "borrow-USDC", asset: "USDC", amount: 500, healthFactor: 2.1 },
  ];

  beforeEach(() => {
    vi.mocked(usePositions).mockReturnValue({
      positions: [],
      isLoading: false,
      error: null,
      refetch: async () => {},
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders with positions override prop (Storybook fixture path)", () => {
    render(<RepayForm positions={mockPositions} onSubmit={mockOnSubmit} />);

    expect(screen.getByText(/Repay Borrowed Assets/i)).toBeInTheDocument();
    expect(screen.getByText(/Select Active Borrow Position/i)).toBeInTheDocument();
    expect(screen.getByText(/Outstanding: 1,500 XLM/i)).toBeInTheDocument();
    expect(screen.getByText(/Outstanding: 500 USDC/i)).toBeInTheDocument();
  });

  it("renders skeletons during loading state", () => {
    vi.mocked(usePositions).mockReturnValue({
      positions: [],
      isLoading: true,
      error: null,
      refetch: async () => {},
    });

    render(<RepayForm onSubmit={mockOnSubmit} />);

    expect(screen.getByLabelText(/Loading repayment details/i)).toBeInTheDocument();
    expect(screen.queryByText(/Repay Borrowed Assets/i)).not.toBeInTheDocument();
  });

  it("renders EmptyState when user has no borrows", () => {
    vi.mocked(usePositions).mockReturnValue({
      positions: [],
      isLoading: false,
      error: null,
      refetch: async () => {},
    });

    render(<RepayForm onSubmit={mockOnSubmit} />);

    expect(screen.getByText(/No Outstanding Borrows/i)).toBeInTheDocument();
    expect(screen.getByText(/You do not have any active borrow positions to repay at the moment./i)).toBeInTheDocument();
  });

  it("surfaces fetch errors via toast system", () => {
    const mockError = new Error("API route not found");
    let errorCallback: ((err: Error) => void) | undefined = undefined;

    vi.mocked(usePositions).mockImplementation((onError) => {
      errorCallback = onError;
      return {
        positions: [],
        isLoading: false,
        error: mockError,
        refetch: async () => {},
      };
    });

    render(<RepayForm onSubmit={mockOnSubmit} />);

    // Trigger error callback manually if mock hook didn't invoke it automatically
    if (errorCallback) {
      act(() => {
        errorCallback!(mockError);
      });
    }

    expect(screen.getByText(/Failed to load borrow positions: API route not found/i)).toBeInTheDocument();
  });

  it("validates amount is positive and within limit", () => {
    render(<RepayForm positions={mockPositions} onSubmit={mockOnSubmit} />);

    // Auto-selected first position (XLM, 1500)
    const amountInput = screen.getByLabelText(/Amount to Repay/i);

    // Test negative/zero value
    fireEvent.change(amountInput, { target: { value: "-50" } });
    fireEvent.click(screen.getByText(/Submit Repayment/i));
    expect(screen.getByText(/Please enter a valid positive amount/i)).toBeInTheDocument();

    // Test value exceeding limit
    fireEvent.change(amountInput, { target: { value: "2000" } });
    fireEvent.click(screen.getByText(/Submit Repayment/i));
    expect(screen.getByText(/Repayment amount exceeds outstanding borrow amount/i)).toBeInTheDocument();
  });

  it("sets outstanding balance value on MAX button click", () => {
    render(<RepayForm positions={mockPositions} onSubmit={mockOnSubmit} />);

    // Click MAX button
    fireEvent.click(screen.getByText(/Max/i));

    const amountInput = screen.getByLabelText(/Amount to Repay/i) as HTMLInputElement;
    expect(amountInput.value).toBe("1500");
  });

  it("submits successfully with valid data", async () => {
    render(<RepayForm positions={mockPositions} onSubmit={mockOnSubmit} />);

    const amountInput = screen.getByLabelText(/Amount to Repay/i);
    fireEvent.change(amountInput, { target: { value: "350" } });

    fireEvent.click(screen.getByText(/Submit Repayment/i));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByText(/Repayment transaction details validated successfully/i)).toBeInTheDocument();
    expect(mockOnSubmit).toHaveBeenCalledWith({
      asset: "XLM",
      amount: 350,
      interestRate: 0,
    });
  });
});
