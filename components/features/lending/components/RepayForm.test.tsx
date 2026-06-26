import React from "react";
import { render, screen, fireEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import RepayForm, { BorrowPosition } from "./RepayForm";

const positions: BorrowPosition[] = [
  {
    id: "loan-1",
    asset: "XLM",
    outstandingDebt: 1500,
    interestRate: 12,
    collateralAsset: "XLM",
    collateralAmount: 5000,
    healthFactor: 1.5,
    duration: 30,
  },
  {
    id: "loan-2",
    asset: "USDC",
    outstandingDebt: 900,
    interestRate: 9,
    collateralAsset: "ETH",
    collateralAmount: 3000,
    healthFactor: 2.1,
    duration: 60,
  },
];

const quoteResult = {
  totalEarnings: 5,
  dailyEarnings: 0.16,
  totalRepayment: 505,
  monthlyPayment: 505,
};

describe("RepayForm Component", () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    onSubmit.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: quoteResult }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the repayment workflow", () => {
    render(<RepayForm positions={positions} onSubmit={onSubmit} />);

    expect(screen.getByText(/Repay Borrowed Assets/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Borrow position/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Repayment amount/i)).toBeInTheDocument();
  });

  it("validates repayment amount is greater than zero", async () => {
    render(<RepayForm positions={positions} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByText(/Review Repayment/i));

    expect(
      await screen.findByText(/Enter a repayment amount greater than zero/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("surfaces a clear error when there are no open positions", async () => {
    render(<RepayForm positions={[]} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Repayment amount/i), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByText(/Review Repayment/i));

    expect(
      await screen.findByText(/Please select an open borrow position/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("validates repayment does not exceed outstanding debt", async () => {
    render(<RepayForm positions={positions} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Repayment amount/i), {
      target: { value: "1500.01" },
    });
    fireEvent.click(screen.getByText(/Review Repayment/i));

    expect(
      await screen.findByText(/Repayment cannot exceed 1,500.00 XLM/i),
    ).toBeInTheDocument();
  });

  it("shows partial repayment preview with updated debt and health factor", () => {
    render(<RepayForm positions={positions} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Repayment amount/i), {
      target: { value: "500" },
    });

    expect(screen.getByText("1,000.00 XLM")).toBeInTheDocument();
    expect(screen.getByText(/2.25 \(Healthy\)/i)).toBeInTheDocument();
  });

  it("shows full repayment preview as debt cleared", () => {
    render(<RepayForm positions={positions} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByText("MAX"));

    expect(screen.getByText("0.00 XLM")).toBeInTheDocument();
    expect(screen.getAllByText(/Debt cleared/i).length).toBeGreaterThan(0);
  });

  it("submits quote preview and repayment data", async () => {
    render(<RepayForm positions={positions} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Repayment amount/i), {
      target: { value: "500" },
    });
    fireEvent.click(screen.getByText(/Review Repayment/i));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/quote",
        expect.objectContaining({
          method: "POST",
          headers: { "content-type": "application/json" },
        }),
      );
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 500,
          asset: "XLM",
          positionId: "loan-1",
          remainingDebt: 1000,
          healthFactorAfter: 2.25,
        }),
        quoteResult,
      );
    });
    expect(screen.getByText(/Repayment preview ready/i)).toBeInTheDocument();
  });

  it("shows loading and error states when quote preview fails", async () => {
    let rejectPreview: () => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((_resolve, reject) => {
            rejectPreview = () => reject(new Error("network"));
          }),
      ),
    );

    render(<RepayForm positions={positions} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Repayment amount/i), {
      target: { value: "250" },
    });
    fireEvent.click(screen.getByText(/Review Repayment/i));

    expect(
      await screen.findByText(/Preparing repayment preview/i),
    ).toBeInTheDocument();

    rejectPreview();

    expect(
      await screen.findByText(/Unable to prepare repayment preview/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
