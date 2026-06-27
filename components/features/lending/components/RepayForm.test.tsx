import React from "react";
import { render, screen, fireEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import RepayForm, {
  BorrowPosition,
  computeHealthAfterRepayment,
} from "./RepayForm";

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
    expect(screen.getByText("2.25")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /Projected health: Healthy/i }),
    ).toBeInTheDocument();
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

  it("switching selected position updates the preview", () => {
    render(<RepayForm positions={positions} onSubmit={onSubmit} />);

    expect(screen.getByText(/XLM debt/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Borrow position/i), {
      target: { value: "loan-2" },
    });

    expect(screen.getByText(/USDC debt/)).toBeInTheDocument();
    expect(screen.getByText(/Outstanding: 900.00 USDC/i)).toBeInTheDocument();
  });

  it("shows error for zero amount", async () => {
    render(<RepayForm positions={positions} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Repayment amount/i), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByText(/Review Repayment/i));

    await waitFor(() => {
      expect(
        screen.getByText(/Enter a repayment amount greater than zero/i),
      ).toBeInTheDocument();
    });
  });

  it("shows error for negative amount", async () => {
    render(<RepayForm positions={positions} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Repayment amount/i), {
      target: { value: "-50" },
    });
    fireEvent.click(screen.getByText(/Review Repayment/i));

    await waitFor(() => {
      expect(
        screen.getByText(/Enter a repayment amount greater than zero/i),
      ).toBeInTheDocument();
    });
  });

  it("exact full repayment shows Debt cleared", () => {
    render(<RepayForm positions={positions} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Repayment amount/i), {
      target: { value: "1500" },
    });

    expect(screen.getByText("0.00 XLM")).toBeInTheDocument();
    expect(screen.getAllByText(/Debt cleared/i).length).toBeGreaterThan(0);
  });

  it("caps projected health at debt cleared when the input exceeds outstanding debt", () => {
    expect(computeHealthAfterRepayment(1.5, 1500, 2000)).toBe(Infinity);
  });

  it("shows Healthy label for health factor >= 2", () => {
    const highHealthPositions: BorrowPosition[] = [
      {
        id: "loan-healthy",
        asset: "XLM",
        outstandingDebt: 1000,
        interestRate: 10,
        collateralAsset: "XLM",
        collateralAmount: 10000,
        healthFactor: 3.0,
        duration: 30,
      },
    ];

    render(<RepayForm positions={highHealthPositions} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Repayment amount/i), {
      target: { value: "100" },
    });

    expect(screen.getAllByText(/Healthy/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows At Risk label for health factor between 1 and 2", () => {
    const atRiskPositions: BorrowPosition[] = [
      {
        id: "loan-at-risk",
        asset: "XLM",
        outstandingDebt: 1000,
        interestRate: 12,
        collateralAsset: "XLM",
        collateralAmount: 5000,
        healthFactor: 1.2,
        duration: 30,
      },
    ];

    render(<RepayForm positions={atRiskPositions} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Repayment amount/i), {
      target: { value: "100" },
    });

    expect(screen.getAllByText(/At Risk/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows Critical label for health factor below 1", () => {
    const criticalPositions: BorrowPosition[] = [
      {
        id: "loan-critical",
        asset: "XLM",
        outstandingDebt: 1000,
        interestRate: 15,
        collateralAsset: "XLM",
        collateralAmount: 2000,
        healthFactor: 0.8,
        duration: 30,
      },
    ];

    render(<RepayForm positions={criticalPositions} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Repayment amount/i), {
      target: { value: "100" },
    });

    expect(screen.getAllByText(/Critical/i).length).toBeGreaterThanOrEqual(1);
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

  it("syncs slider changes to repayment amount", () => {
    render(<RepayForm positions={positions} onSubmit={onSubmit} />);
    
    const slider = screen.getByLabelText(/Repayment percentage/i);
    const amountInput = screen.getByLabelText(/Repayment amount/i);

    fireEvent.change(slider, { target: { value: "50" } });
    expect(amountInput).toHaveValue(750);
  });

  it("syncs amount changes to slider percentage", () => {
    render(<RepayForm positions={positions} onSubmit={onSubmit} />);
    
    const slider = screen.getByLabelText(/Repayment percentage/i);
    const amountInput = screen.getByLabelText(/Repayment amount/i);

    fireEvent.change(amountInput, { target: { value: "375" } });
    expect(slider).toHaveValue("25");
  });

  it("handles 0% slider value", () => {
    render(<RepayForm positions={positions} onSubmit={onSubmit} />);
    
    const slider = screen.getByLabelText(/Repayment percentage/i);
    const amountInput = screen.getByLabelText(/Repayment amount/i);

    fireEvent.change(slider, { target: { value: "0" } });
    expect(amountInput).toHaveValue(0);
  });

  it("handles 100% full repay slider value", () => {
    render(<RepayForm positions={positions} onSubmit={onSubmit} />);
    
    const slider = screen.getByLabelText(/Repayment percentage/i);
    const amountInput = screen.getByLabelText(/Repayment amount/i);

    fireEvent.change(slider, { target: { value: "100" } });
    expect(amountInput).toHaveValue(1500);
    expect(screen.getAllByText(/Debt cleared/i).length).toBeGreaterThan(0);
  });

  it("slider stays at 0 when outstanding debt is zero", () => {
    const zeroDebtPositions: BorrowPosition[] = [
      {
        id: "loan-zero",
        asset: "XLM",
        outstandingDebt: 0,
        interestRate: 10,
        collateralAsset: "XLM",
        collateralAmount: 5000,
        healthFactor: Infinity,
      },
    ];

    render(<RepayForm positions={zeroDebtPositions} onSubmit={onSubmit} />);
    
    const slider = screen.getByLabelText(/Repayment percentage/i);
    expect(slider).toHaveValue("0");

    fireEvent.change(slider, { target: { value: "50" } });
    const amountInput = screen.getByLabelText(/Repayment amount/i);
    expect(amountInput).toHaveValue(0);
  });
});
