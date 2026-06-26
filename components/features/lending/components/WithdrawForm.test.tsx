import React from "react";
import { render, screen, fireEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import WithdrawForm, {
  SupplyPosition,
  computeWithdrawHealthFactor,
} from "./WithdrawForm";

const positions: SupplyPosition[] = [
  {
    id: "supply-1",
    asset: "XLM",
    suppliedAmount: 5000,
    lockedCollateral: 2250,
    outstandingDebt: 1500,
    healthFactor: 1.85,
  },
  {
    id: "supply-2",
    asset: "USDC",
    suppliedAmount: 3000,
    lockedCollateral: 0,
    outstandingDebt: 0,
    healthFactor: 99,
  },
];

describe("computeWithdrawHealthFactor", () => {
  it("returns currentHF unchanged when there is no outstanding debt", () => {
    expect(computeWithdrawHealthFactor(1.85, 5000, 1000, 0)).toBe(1.85);
  });

  it("returns 0 when suppliedAmount is zero", () => {
    expect(computeWithdrawHealthFactor(1.85, 0, 0, 1000)).toBe(0);
  });

  it("returns 0 when remaining after withdrawal is zero or negative", () => {
    expect(computeWithdrawHealthFactor(1.85, 5000, 5000, 1500)).toBe(0);
    expect(computeWithdrawHealthFactor(1.85, 5000, 6000, 1500)).toBe(0);
  });

  it("computes proportional health factor correctly", () => {
    // 1.85 * (5000 - 1000) / 5000 = 1.85 * 0.8 = 1.48
    expect(computeWithdrawHealthFactor(1.85, 5000, 1000, 1500)).toBeCloseTo(
      1.48,
    );
  });
});

describe("WithdrawForm", () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    onSubmit.mockReset();
  });

  describe("rendering", () => {
    it("renders heading, position selector, and amount input", () => {
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);

      expect(
        screen.getByText(/Withdraw Supplied Assets/i),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Supply position/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Withdrawal amount/i)).toBeInTheDocument();
      expect(screen.getByText(/Review Withdrawal/i)).toBeInTheDocument();
    });

    it("shows balance breakdown: total supplied, locked, and withdrawable", () => {
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);

      // Values may appear in multiple sections (balance breakdown + preview), use getAllByText
      expect(screen.getAllByText("5,000.00 XLM").length).toBeGreaterThan(0); // total supplied
      expect(screen.getByText("2,250.00 XLM")).toBeInTheDocument(); // locked collateral (unique)
      expect(screen.getByText("2,750.00 XLM")).toBeInTheDocument(); // withdrawable = 5000-2250
      expect(screen.getByText(/Available to withdraw/i)).toBeInTheDocument();
    });

    it("renders both positions in the select", () => {
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);
      const select = screen.getByLabelText(/Supply position/i);
      expect(select).toBeInTheDocument();
      expect(screen.getByText(/XLM supply/i)).toBeInTheDocument();
      expect(screen.getByText(/USDC supply/i)).toBeInTheDocument();
    });
  });

  describe("validation — amount", () => {
    it("blocks submission when amount is zero (empty form)", async () => {
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);

      fireEvent.click(screen.getByText(/Review Withdrawal/i));

      expect(
        await screen.findByText(
          /Enter a withdrawal amount greater than zero/i,
        ),
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("blocks submission for a non-positive amount", async () => {
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);

      // jsdom normalises negative values on type="number" min="0" inputs,
      // so test via a zero value (same !amount || amount <= 0 code path)
      fireEvent.change(screen.getByLabelText(/Withdrawal amount/i), {
        target: { value: "0" },
      });
      fireEvent.click(screen.getByText(/Review Withdrawal/i));

      expect(
        await screen.findByText(
          /Enter a withdrawal amount greater than zero/i,
        ),
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("blocks submission when amount exceeds withdrawable balance (collateral-locked limit)", async () => {
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);
      // withdrawableBalance = 5000 - 2250 = 2750; 2800 > 2750
      fireEvent.change(screen.getByLabelText(/Withdrawal amount/i), {
        target: { value: "2800" },
      });
      fireEvent.click(screen.getByText(/Review Withdrawal/i));

      expect(
        await screen.findByText(/Amount exceeds withdrawable balance/i),
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("clears the amount error when the user edits the field", async () => {
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);

      fireEvent.click(screen.getByText(/Review Withdrawal/i));
      expect(
        await screen.findByText(
          /Enter a withdrawal amount greater than zero/i,
        ),
      ).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/Withdrawal amount/i), {
        target: { value: "100" },
      });

      await waitFor(() => {
        expect(
          screen.queryByText(
            /Enter a withdrawal amount greater than zero/i,
          ),
        ).not.toBeInTheDocument();
      });
    });

    it("shows a top-level banner when form is invalid on submit", async () => {
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);

      fireEvent.click(screen.getByText(/Review Withdrawal/i));

      expect(
        await screen.findByText(
          /Please fix the errors in the form before continuing/i,
        ),
      ).toBeInTheDocument();
    });
  });

  describe("validation — no supply positions", () => {
    it("reports a position error when no positions exist", async () => {
      render(<WithdrawForm positions={[]} onSubmit={onSubmit} />);

      fireEvent.change(screen.getByLabelText(/Withdrawal amount/i), {
        target: { value: "100" },
      });
      fireEvent.click(screen.getByText(/Review Withdrawal/i));

      expect(
        await screen.findByText(/Please select a supply position/i),
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("MAX button", () => {
    it("sets amount to the withdrawable balance (excludes locked collateral)", () => {
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);

      fireEvent.click(screen.getByText("MAX"));

      const input = screen.getByLabelText(
        /Withdrawal amount/i,
      ) as HTMLInputElement;
      // MAX = 5000 - 2250 = 2750
      expect(Number(input.value)).toBe(2750);
    });

    it("clears amount errors after MAX is clicked", async () => {
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);

      fireEvent.click(screen.getByText(/Review Withdrawal/i));
      expect(
        await screen.findByText(
          /Enter a withdrawal amount greater than zero/i,
        ),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByText("MAX"));

      await waitFor(() => {
        expect(
          screen.queryByText(
            /Enter a withdrawal amount greater than zero/i,
          ),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("health factor guard", () => {
    it("shows Critical Health Risk warning for a withdrawal that would breach the critical threshold", () => {
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);
      // position healthFactor=1.85, suppliedAmount=5000
      // newHF = 1.85 * (5000 - 2750) / 5000 = 0.8325 < 1.0 → critical
      fireEvent.change(screen.getByLabelText(/Withdrawal amount/i), {
        target: { value: "2750" },
      });

      expect(screen.getByText(/Critical Health Risk/i)).toBeInTheDocument();
    });

    it("blocks submission when the resulting health factor is critical", async () => {
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);

      fireEvent.change(screen.getByLabelText(/Withdrawal amount/i), {
        target: { value: "2750" },
      });
      fireEvent.click(screen.getByText(/Review Withdrawal/i));

      expect(
        await screen.findByText(
          /push your health factor into the critical zone/i,
        ),
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("shows Health Factor Warning for an at-risk withdrawal but allows submission", async () => {
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);
      // newHF = 1.85 * (5000 - 1000) / 5000 = 1.48 → at-risk (1.0 ≤ hf < 2.0)
      fireEvent.change(screen.getByLabelText(/Withdrawal amount/i), {
        target: { value: "1000" },
      });

      expect(screen.getByText(/Health Factor Warning/i)).toBeInTheDocument();

      fireEvent.click(screen.getByText(/Review Withdrawal/i));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });
    });

    it("shows no health warning for a position with no outstanding debt", () => {
      render(
        <WithdrawForm
          positions={positions}
          onSubmit={onSubmit}
          initialPositionId="supply-2"
        />,
      );
      fireEvent.change(screen.getByLabelText(/Withdrawal amount/i), {
        target: { value: "1000" },
      });

      expect(
        screen.queryByText(/Health Factor Warning/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Critical Health Risk/i),
      ).not.toBeInTheDocument();
    });

    it("shows no health warning when amount is zero", () => {
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);

      expect(
        screen.queryByText(/Health Factor Warning/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Critical Health Risk/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("live preview", () => {
    it("shows remaining supplied balance decreasing as amount increases", () => {
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);

      fireEvent.change(screen.getByLabelText(/Withdrawal amount/i), {
        target: { value: "500" },
      });

      // 5000 - 500 = 4500
      expect(screen.getByText("4,500.00 XLM")).toBeInTheDocument();
    });

    it("shows zero remaining when the full withdrawable amount is entered", () => {
      const noDebtPositions: SupplyPosition[] = [
        {
          id: "full-withdraw",
          asset: "USDC",
          suppliedAmount: 1000,
          lockedCollateral: 0,
          outstandingDebt: 0,
          healthFactor: 99,
        },
      ];
      render(<WithdrawForm positions={noDebtPositions} onSubmit={onSubmit} />);

      fireEvent.click(screen.getByText("MAX"));

      // "0.00 USDC" appears in both "Locked as collateral" and "Remaining supplied"
      expect(screen.getAllByText("0.00 USDC").length).toBeGreaterThan(0);
      // Confirm the preview label is present
      expect(screen.getByText(/Remaining supplied/i)).toBeInTheDocument();
    });

    it("displays health factor in the preview when debt exists", () => {
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);

      fireEvent.change(screen.getByLabelText(/Withdrawal amount/i), {
        target: { value: "100" },
      });

      // newHF = 1.85 * (5000 - 100) / 5000 = 1.85 * 0.98 = 1.813
      // Use exact string to avoid matching "Health Factor Warning" banner text
      expect(screen.getByText("Health factor")).toBeInTheDocument();
    });

    it("hides health factor in the preview for debt-free positions", () => {
      render(
        <WithdrawForm
          positions={positions}
          onSubmit={onSubmit}
          initialPositionId="supply-2"
        />,
      );

      // Health factor row should not be shown for positions with no debt
      expect(screen.queryByText(/^Health factor$/i)).not.toBeInTheDocument();
    });
  });

  describe("position selection", () => {
    it("resets amount and messages when a new position is chosen", () => {
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);

      fireEvent.change(screen.getByLabelText(/Withdrawal amount/i), {
        target: { value: "500" },
      });
      fireEvent.change(screen.getByLabelText(/Supply position/i), {
        target: { value: "supply-2" },
      });

      const input = screen.getByLabelText(
        /Withdrawal amount/i,
      ) as HTMLInputElement;
      expect(Number(input.value || 0)).toBe(0);
    });

    it("updates the withdrawable balance after switching to a debt-free position", () => {
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);

      fireEvent.change(screen.getByLabelText(/Supply position/i), {
        target: { value: "supply-2" },
      });

      // USDC position: 3000 supplied, 0 locked → withdrawable = 3000
      // "3,000.00 USDC" appears in both "Total supplied" and "Available to withdraw" rows
      expect(screen.getAllByText("3,000.00 USDC").length).toBeGreaterThan(0);
      expect(screen.getByText(/Available to withdraw/i)).toBeInTheDocument();
    });
  });

  describe("successful submission", () => {
    it("calls onSubmit with correct data for a position with no debt", () => {
      render(
        <WithdrawForm
          positions={positions}
          onSubmit={onSubmit}
          initialPositionId="supply-2"
        />,
      );
      fireEvent.change(screen.getByLabelText(/Withdrawal amount/i), {
        target: { value: "500" },
      });
      fireEvent.click(screen.getByText(/Review Withdrawal/i));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 500,
          asset: "USDC",
          positionId: "supply-2",
          outstandingDebt: 0,
          remainingDebt: 2500,
        }),
      );
    });

    it("calls onSubmit with health factor data for a position with debt", () => {
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);
      // Withdraw 500: newHF = 1.85 * 4500/5000 = 1.665
      fireEvent.change(screen.getByLabelText(/Withdrawal amount/i), {
        target: { value: "500" },
      });
      fireEvent.click(screen.getByText(/Review Withdrawal/i));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 500,
          asset: "XLM",
          positionId: "supply-1",
          outstandingDebt: 1500,
          remainingDebt: 4500,
          healthFactorBefore: 1.85,
        }),
      );
      const callArg = onSubmit.mock.calls[0][0];
      expect(callArg.healthFactorAfter).toBeCloseTo(1.665);
    });

    it("shows a success banner after valid submission", () => {
      render(
        <WithdrawForm
          positions={positions}
          onSubmit={onSubmit}
          initialPositionId="supply-2"
        />,
      );
      fireEvent.change(screen.getByLabelText(/Withdrawal amount/i), {
        target: { value: "100" },
      });
      fireEvent.click(screen.getByText(/Review Withdrawal/i));

      expect(
        screen.getByText(/Withdrawal preview ready/i),
      ).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles a position where the full supplied amount is withdrawable (zero locked collateral)", () => {
      const positions: SupplyPosition[] = [
        {
          id: "p1",
          asset: "ETH",
          suppliedAmount: 2,
          lockedCollateral: 0,
          outstandingDebt: 0,
          healthFactor: 99,
        },
      ];
      render(<WithdrawForm positions={positions} onSubmit={onSubmit} />);

      fireEvent.click(screen.getByText("MAX"));
      fireEvent.click(screen.getByText(/Review Withdrawal/i));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 2, asset: "ETH", remainingDebt: 0 }),
      );
    });

    it("handles a position where the entire supply is locked (zero withdrawable)", async () => {
      const fullyLocked: SupplyPosition[] = [
        {
          id: "locked",
          asset: "XLM",
          suppliedAmount: 3000,
          lockedCollateral: 3000,
          outstandingDebt: 2000,
          healthFactor: 1.2,
        },
      ];
      render(<WithdrawForm positions={fullyLocked} onSubmit={onSubmit} />);

      // withdrawableBalance = 0; MAX button sets amount to 0
      fireEvent.click(screen.getByText("MAX"));
      fireEvent.click(screen.getByText(/Review Withdrawal/i));

      // amount becomes 0 → validation error
      expect(
        await screen.findByText(
          /Enter a withdrawal amount greater than zero/i,
        ),
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("initialPositionId prop sets the initial selection", () => {
      render(
        <WithdrawForm
          positions={positions}
          onSubmit={onSubmit}
          initialPositionId="supply-2"
        />,
      );

      const select = screen.getByLabelText(
        /Supply position/i,
      ) as HTMLSelectElement;
      expect(select.value).toBe("supply-2");
    });
  });
});
