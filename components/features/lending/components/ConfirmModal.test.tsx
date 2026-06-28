import React, { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import ConfirmModal from "./ConfirmModal";
import type { LendingData } from "@/app/lending/page";
import type { LendingActionType } from "@/lib/lending/types";

const lendingData: LendingData = {
  asset: "XLM",
  amount: 250,
  interestRate: 4.5,
};

function ConfirmModalHarness({
  onConfirm = vi.fn(),
  onClose = vi.fn(),
  data = lendingData,
  calculation = { dailyEarnings: 0.03, totalEarnings: 4.2 },
  type = "lend",
}: {
  onConfirm?: () => void | Promise<void>;
  onClose?: () => void;
  data?: LendingData;
  calculation?: { dailyEarnings: number; totalEarnings: number } | null;
  type?: LendingActionType;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open confirmation
      </button>
      <ConfirmModal
        isOpen={isOpen}
        onClose={() => {
          onClose();
          setIsOpen(false);
        }}
        onConfirm={onConfirm}
        data={data}
        calculation={calculation}
        type={type}
      />
    </div>
  );
}

describe("ConfirmModal accessibility", () => {
  it("renders as a labelled modal dialog with close, cancel, and confirm controls", async () => {
    const user = userEvent.setup();
    render(<ConfirmModalHarness />);

    await user.click(
      screen.getByRole("button", { name: /open confirmation/i }),
    );

    const dialog = screen.getByRole("dialog", {
      name: /confirm lending transaction/i,
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(
      within(dialog).getByRole("button", { name: /close modal/i }),
    ).toHaveFocus();
    expect(
      within(dialog).getByRole("button", { name: /^cancel$/i }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: /confirm lending/i }),
    ).toBeDisabled();
  });

  it("traps keyboard focus inside the dialog", async () => {
    const user = userEvent.setup();
    render(<ConfirmModalHarness />);

    await user.click(
      screen.getByRole("button", { name: /open confirmation/i }),
    );
    const dialog = screen.getByRole("dialog", {
      name: /confirm lending transaction/i,
    });
    const closeButton = within(dialog).getByRole("button", {
      name: /close modal/i,
    });
    const cancelButton = within(dialog).getByRole("button", {
      name: /^cancel$/i,
    });

    expect(closeButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(cancelButton).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ConfirmModalHarness onClose={onClose} />);

    const trigger = screen.getByRole("button", { name: /open confirmation/i });
    await user.click(trigger);
    expect(
      screen.getByRole("dialog", { name: /confirm lending transaction/i }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });

  it("fires confirm only after the terms checkbox is selected", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmModalHarness onConfirm={onConfirm} />);

    await user.click(
      screen.getByRole("button", { name: /open confirmation/i }),
    );
    const dialog = screen.getByRole("dialog", {
      name: /confirm lending transaction/i,
    });
    const confirmButton = within(dialog).getByRole("button", {
      name: /confirm lending/i,
    });

    expect(confirmButton).toBeDisabled();

    await user.click(within(dialog).getByRole("checkbox"));
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("closes from the close button, cancel button, and backdrop", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ConfirmModalHarness onClose={onClose} />);

    await user.click(
      screen.getByRole("button", { name: /open confirmation/i }),
    );
    await user.click(screen.getByRole("button", { name: /close modal/i }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole("button", { name: /open confirmation/i }),
    );
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole("button", { name: /open confirmation/i }),
    );
    await user.click(
      document.querySelector(
        ".fixed.inset-0.transition-opacity",
      ) as HTMLElement,
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe("ConfirmModal fee breakdown", () => {
  it("renders gross, estimated fee, and net using asset registry decimals", async () => {
    const user = userEvent.setup();
    render(<ConfirmModalHarness />);

    await user.click(
      screen.getByRole("button", { name: /open confirmation/i }),
    );

    const dialog = screen.getByRole("dialog", {
      name: /confirm lending transaction/i,
    });
    expect(
      within(dialog).getByText("Protocol Fee Estimate"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("250.0000000 XLM")).toBeInTheDocument();
    expect(within(dialog).getByText("0.2500000 XLM")).toBeInTheDocument();
    expect(within(dialog).getByText("249.7500000 XLM")).toBeInTheDocument();
  });

  it("recomputes when amount and action type change", async () => {
    const user = userEvent.setup();

    function RecomputingHarness() {
      const [amount, setAmount] = useState(100);
      const [type, setType] = useState<LendingActionType>("lend");

      return (
        <div>
          <button type="button" onClick={() => setAmount(200)}>
            Increase amount
          </button>
          <button type="button" onClick={() => setType("borrow")}>
            Switch to borrow
          </button>
          <ConfirmModal
            isOpen
            onClose={vi.fn()}
            onConfirm={vi.fn()}
            data={{ ...lendingData, amount }}
            calculation={null}
            type={type}
          />
        </div>
      );
    }

    render(<RecomputingHarness />);

    expect(screen.getByText("0.1000000 XLM")).toBeInTheDocument();
    expect(screen.getByText("99.9000000 XLM")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /increase amount/i }));
    expect(screen.getByText("0.2000000 XLM")).toBeInTheDocument();
    expect(screen.getByText("199.8000000 XLM")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /switch to borrow/i }));
    expect(screen.getByText("0.4000000 XLM")).toBeInTheDocument();
    expect(screen.getByText("199.6000000 XLM")).toBeInTheDocument();
  });

  it("shows zero fee for a zero amount", async () => {
    const user = userEvent.setup();
    render(<ConfirmModalHarness data={{ ...lendingData, amount: 0 }} />);

    await user.click(
      screen.getByRole("button", { name: /open confirmation/i }),
    );

    const dialog = screen.getByRole("dialog", {
      name: /confirm lending transaction/i,
    });
    expect(within(dialog).getAllByText("0.0000000 XLM")).toHaveLength(3);
  });

  it("rounds fractional fees with the selected asset precision", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmModalHarness
        data={{ ...lendingData, amount: 123.4567891 }}
        calculation={null}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /open confirmation/i }),
    );

    const dialog = screen.getByRole("dialog", {
      name: /confirm lending transaction/i,
    });
    expect(within(dialog).getByText("0.1234568 XLM")).toBeInTheDocument();
    expect(within(dialog).getByText("123.3333323 XLM")).toBeInTheDocument();
  });

  it("falls back when the action has no fee schedule", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmModalHarness
        data={{ ...lendingData, amount: 75 }}
        calculation={null}
        type="withdraw"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /open confirmation/i }),
    );

    const dialog = screen.getByRole("dialog", {
      name: /confirm withdrawal transaction/i,
    });
    expect(
      within(dialog).getByText("Estimated Protocol Fee"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("N/A")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "No protocol fee is configured for this action.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the borrow fee, repayment, collateral, and enabled button states", async () => {
    const user = userEvent.setup();
    const borrowData: LendingData = {
      asset: "USDC",
      amount: 500,
      interestRate: 12,
      duration: 30,
      collateral: "XLM",
      collateralAmount: 750,
    };

    render(
      <ConfirmModalHarness
        data={borrowData}
        calculation={{
          dailyEarnings: 0,
          totalEarnings: 0,
          monthlyPayment: 45.5,
          totalRepayment: 545.5,
        }}
        type="borrow"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /open confirmation/i }),
    );

    const dialog = screen.getByRole("dialog", {
      name: /confirm borrowing transaction/i,
    });
    expect(within(dialog).getByText("Amount to Borrow")).toBeInTheDocument();
    expect(within(dialog).getByText("30 days")).toBeInTheDocument();
    expect(within(dialog).getByText("45.50 USDC")).toBeInTheDocument();
    expect(within(dialog).getByText("545.50 USDC")).toBeInTheDocument();
    expect(within(dialog).getByText("Collateral Required")).toBeInTheDocument();
    expect(within(dialog).getByText("750.00 XLM")).toBeInTheDocument();
    expect(within(dialog).getByText("1.250000 USDC")).toBeInTheDocument();
    expect(within(dialog).getByText("498.750000 USDC")).toBeInTheDocument();

    const confirmButton = within(dialog).getByRole("button", {
      name: /confirm borrowing/i,
    });

    await user.click(within(dialog).getByRole("checkbox"));
    expect(confirmButton).toHaveClass("bg-blue-500");
  });
});

describe("ConfirmModal withdraw variant", () => {
  const withdrawData: LendingData = {
    asset: "XLM",
    amount: 1000,
    interestRate: 0,
    positionId: "xlm-supply-001",
    outstandingDebt: 1500,
    remainingDebt: 4000,
    healthFactorBefore: 1.85,
    healthFactorAfter: 1.48,
  };

  const healthyWithdrawData: LendingData = {
    asset: "USDC",
    amount: 500,
    interestRate: 0,
    positionId: "usdc-supply-002",
    outstandingDebt: 0,
    remainingDebt: 2500,
  };

  function WithdrawModalHarness({
    onConfirm = vi.fn(),
    onClose = vi.fn(),
    data = withdrawData,
  }: {
    onConfirm?: () => void | Promise<void>;
    onClose?: () => void;
    data?: LendingData;
  }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div>
        <button type="button" onClick={() => setIsOpen(true)}>
          Open withdrawal confirmation
        </button>
        <ConfirmModal
          isOpen={isOpen}
          onClose={() => {
            onClose();
            setIsOpen(false);
          }}
          onConfirm={onConfirm}
          data={data}
          calculation={null}
          type="withdraw"
        />
      </div>
    );
  }

  it("renders withdraw-specific labels and details", async () => {
    const user = userEvent.setup();
    render(<WithdrawModalHarness />);

    await user.click(
      screen.getByRole("button", { name: /open withdrawal confirmation/i }),
    );

    const dialog = screen.getByRole("dialog", {
      name: /confirm withdrawal transaction/i,
    });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/Amount to Withdraw/i)).toBeInTheDocument();
    expect(within(dialog).getByText("1,000.00 XLM")).toBeInTheDocument();
    expect(within(dialog).getByText("xlm-supply-001")).toBeInTheDocument();
    expect(within(dialog).getByText(/Remaining Supplied/i)).toBeInTheDocument();
    expect(within(dialog).getByText("4,000.00 XLM")).toBeInTheDocument();
    expect(within(dialog).getByText(/New Health Factor/i)).toBeInTheDocument();
    expect(within(dialog).getAllByText("1.48")).toHaveLength(2);
  });

  it("shows Health Factor Warning when health degrades to at-risk range", async () => {
    const user = userEvent.setup();
    render(<WithdrawModalHarness />);

    await user.click(
      screen.getByRole("button", { name: /open withdrawal confirmation/i }),
    );

    expect(screen.getByText(/Health Factor Warning/i)).toBeInTheDocument();
    expect(screen.getByText(/At Risk/i)).toBeInTheDocument();
  });

  it("shows Critical Health Risk when health factor drops below 1.0", async () => {
    const user = userEvent.setup();
    const criticalData: LendingData = {
      ...withdrawData,
      remainingDebt: 500,
      healthFactorAfter: 0.85,
    };
    render(<WithdrawModalHarness data={criticalData} />);

    await user.click(
      screen.getByRole("button", { name: /open withdrawal confirmation/i }),
    );

    expect(screen.getByText(/Critical Health Risk/i)).toBeInTheDocument();
    expect(screen.getByText(/could be liquidated/i)).toBeInTheDocument();
  });

  it("shows no health warning when withdrawing from a debt-free position", async () => {
    const user = userEvent.setup();
    render(<WithdrawModalHarness data={healthyWithdrawData} />);

    await user.click(
      screen.getByRole("button", { name: /open withdrawal confirmation/i }),
    );

    expect(
      screen.queryByText(/Health Factor Warning/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Critical Health Risk/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/New Health Factor/i)).not.toBeInTheDocument();
  });

  it("fires confirm only after terms checkbox is selected for withdraw", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<WithdrawModalHarness onConfirm={onConfirm} />);

    await user.click(
      screen.getByRole("button", { name: /open withdrawal confirmation/i }),
    );
    const dialog = screen.getByRole("dialog", {
      name: /confirm withdrawal transaction/i,
    });
    const confirmButton = within(dialog).getByRole("button", {
      name: /confirm withdrawal/i,
    });

    expect(confirmButton).toBeDisabled();

    await user.click(within(dialog).getByRole("checkbox"));
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape for withdraw modal and restores focus", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<WithdrawModalHarness onClose={onClose} />);

    const trigger = screen.getByRole("button", {
      name: /open withdrawal confirmation/i,
    });
    await user.click(trigger);
    expect(
      screen.getByRole("dialog", { name: /confirm withdrawal transaction/i }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });

  it("traps focus inside the withdraw modal", async () => {
    const user = userEvent.setup();
    render(<WithdrawModalHarness />);

    await user.click(
      screen.getByRole("button", { name: /open withdrawal confirmation/i }),
    );
    const dialog = screen.getByRole("dialog", {
      name: /confirm withdrawal transaction/i,
    });
    const closeButton = within(dialog).getByRole("button", {
      name: /close modal/i,
    });
    const cancelButton = within(dialog).getByRole("button", {
      name: /^cancel$/i,
    });

    expect(closeButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(cancelButton).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();
  });
});
