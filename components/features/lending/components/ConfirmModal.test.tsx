import React, { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import ConfirmModal from "./ConfirmModal";
import type { LendingData } from "@/app/lending/page";

const lendingData: LendingData = {
  asset: "XLM",
  amount: 250,
  interestRate: 4.5,
};

function ConfirmModalHarness({
  onConfirm = vi.fn(),
  onClose = vi.fn(),
}: {
  onConfirm?: () => void | Promise<void>;
  onClose?: () => void;
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
        data={lendingData}
        calculation={{ dailyEarnings: 0.03, totalEarnings: 4.2 }}
        type="lend"
      />
    </div>
  );
}

describe("ConfirmModal accessibility", () => {
  it("renders as a labelled modal dialog with close, cancel, and confirm controls", async () => {
    const user = userEvent.setup();
    render(<ConfirmModalHarness />);

    await user.click(screen.getByRole("button", { name: /open confirmation/i }));

    const dialog = screen.getByRole("dialog", { name: /confirm lending transaction/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("button", { name: /close modal/i })).toHaveFocus();
    expect(within(dialog).getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /confirm lending/i })).toBeDisabled();
  });

  it("traps keyboard focus inside the dialog", async () => {
    const user = userEvent.setup();
    render(<ConfirmModalHarness />);

    await user.click(screen.getByRole("button", { name: /open confirmation/i }));
    const dialog = screen.getByRole("dialog", { name: /confirm lending transaction/i });
    const closeButton = within(dialog).getByRole("button", { name: /close modal/i });
    const cancelButton = within(dialog).getByRole("button", { name: /^cancel$/i });

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
    expect(screen.getByRole("dialog", { name: /confirm lending transaction/i })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });

  it("fires confirm only after the terms checkbox is selected", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmModalHarness onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: /open confirmation/i }));
    const dialog = screen.getByRole("dialog", { name: /confirm lending transaction/i });
    const confirmButton = within(dialog).getByRole("button", { name: /confirm lending/i });

    expect(confirmButton).toBeDisabled();

    await user.click(within(dialog).getByRole("checkbox"));
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("has a properly-typed terms and conditions button that opens terms content", async () => {
    const user = userEvent.setup();
    render(<ConfirmModalHarness />);

    await user.click(screen.getByRole("button", { name: /open confirmation/i }));
    const dialog = screen.getByRole("dialog", { name: /confirm lending transaction/i });
    const termsButton = within(dialog).getByRole("button", { name: /terms and conditions/i });

    expect(termsButton).toHaveAttribute("type", "button");
    expect(screen.queryByRole("dialog", { name: /terms and conditions/i })).not.toBeInTheDocument();

    await user.click(termsButton);

    const termsDialog = screen.getByRole("dialog", { name: /terms and conditions/i });
    expect(termsDialog).toBeInTheDocument();
    expect(within(termsDialog).getByRole("button", { name: /close terms and conditions/i })).toHaveFocus();
  });

  it("opens the terms and conditions content via the keyboard", async () => {
    const user = userEvent.setup();
    render(<ConfirmModalHarness />);

    await user.click(screen.getByRole("button", { name: /open confirmation/i }));
    const dialog = screen.getByRole("dialog", { name: /confirm lending transaction/i });
    const termsButton = within(dialog).getByRole("button", { name: /terms and conditions/i });

    termsButton.focus();
    expect(termsButton).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(screen.getByRole("dialog", { name: /terms and conditions/i })).toBeInTheDocument();
  });

  it("closes the terms modal on Escape without closing the underlying confirmation modal", async () => {
    const user = userEvent.setup();
    render(<ConfirmModalHarness />);

    await user.click(screen.getByRole("button", { name: /open confirmation/i }));
    const dialog = screen.getByRole("dialog", { name: /confirm lending transaction/i });
    const termsButton = within(dialog).getByRole("button", { name: /terms and conditions/i });

    await user.click(termsButton);
    expect(screen.getByRole("dialog", { name: /terms and conditions/i })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /terms and conditions/i })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("dialog", { name: /confirm lending transaction/i })).toBeInTheDocument();
    expect(termsButton).toHaveFocus();
  });

  it("closes from the close button, cancel button, and backdrop", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ConfirmModalHarness onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /open confirmation/i }));
    await user.click(screen.getByRole("button", { name: /close modal/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /open confirmation/i }));
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /open confirmation/i }));
    await user.click(document.querySelector(".fixed.inset-0.transition-opacity") as HTMLElement);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(onClose).toHaveBeenCalledTimes(3);
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

    await user.click(screen.getByRole("button", { name: /open withdrawal confirmation/i }));

    const dialog = screen.getByRole("dialog", { name: /confirm withdrawal transaction/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/Amount to Withdraw/i)).toBeInTheDocument();
    expect(within(dialog).getByText("1,000.00 XLM")).toBeInTheDocument();
    expect(within(dialog).getByText("xlm-supply-001")).toBeInTheDocument();
    expect(within(dialog).getByText(/Remaining Supplied/i)).toBeInTheDocument();
    expect(within(dialog).getByText("4,000.00 XLM")).toBeInTheDocument();
    expect(within(dialog).getByText(/New Health Factor/i)).toBeInTheDocument();
    expect(within(dialog).getAllByText("1.48").length).toBeGreaterThan(0);
  });

  it("shows Health Factor Warning when health degrades to at-risk range", async () => {
    const user = userEvent.setup();
    render(<WithdrawModalHarness />);

    await user.click(screen.getByRole("button", { name: /open withdrawal confirmation/i }));

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

    await user.click(screen.getByRole("button", { name: /open withdrawal confirmation/i }));

    expect(screen.getByText(/Critical Health Risk/i)).toBeInTheDocument();
    expect(screen.getByText(/could be liquidated/i)).toBeInTheDocument();
  });

  it("shows no health warning when withdrawing from a debt-free position", async () => {
    const user = userEvent.setup();
    render(<WithdrawModalHarness data={healthyWithdrawData} />);

    await user.click(screen.getByRole("button", { name: /open withdrawal confirmation/i }));

    expect(screen.queryByText(/Health Factor Warning/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Critical Health Risk/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/New Health Factor/i)).not.toBeInTheDocument();
  });

  it("fires confirm only after terms checkbox is selected for withdraw", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<WithdrawModalHarness onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: /open withdrawal confirmation/i }));
    const dialog = screen.getByRole("dialog", { name: /confirm withdrawal transaction/i });
    const confirmButton = within(dialog).getByRole("button", { name: /confirm withdrawal/i });

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

    const trigger = screen.getByRole("button", { name: /open withdrawal confirmation/i });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: /confirm withdrawal transaction/i })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });

  it("traps focus inside the withdraw modal", async () => {
    const user = userEvent.setup();
    render(<WithdrawModalHarness />);

    await user.click(screen.getByRole("button", { name: /open withdrawal confirmation/i }));
    const dialog = screen.getByRole("dialog", { name: /confirm withdrawal transaction/i });
    const closeButton = within(dialog).getByRole("button", { name: /close modal/i });
    const cancelButton = within(dialog).getByRole("button", { name: /^cancel$/i });

    expect(closeButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(cancelButton).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();
  });
});

function formatModalAmount(amount: number, asset: string): string {
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} ${asset}`;
}

describe("ConfirmModal protocol fee breakdown", () => {
  it("shows gross, fee, and net matching calculateProtocolFee for lend/borrow/repay", async () => {
    const { calculateProtocolFee } = await import("@/lib/fee-calculator");
    const testCases: Array<{
      asset: string;
      type: "lend" | "borrow" | "repay";
      amount: number;
    }> = [
      { asset: "XLM", type: "lend", amount: 1000 },
      { asset: "USDC", type: "borrow", amount: 500 },
      { asset: "XLM", type: "repay", amount: 200 },
    ];

    for (const testCase of testCases) {
      const expectedFeeResult = calculateProtocolFee(
        testCase.asset,
        testCase.type,
        testCase.amount,
      );
      const net = Math.max(0, testCase.amount - expectedFeeResult.feeAmount);

      const { unmount } = render(
        <ConfirmModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          data={{
            asset: testCase.asset,
            amount: testCase.amount,
            interestRate: 5.0,
          }}
          calculation={{ dailyEarnings: 0.1, totalEarnings: 10 }}
          type={testCase.type}
        />,
      );

      const dialog = screen.getByRole("dialog");
      const breakdown = within(dialog).getByTestId("fee-breakdown");
      expect(breakdown).toHaveAttribute("aria-label", "Fee breakdown");

      expect(within(breakdown).getByText("Gross Amount")).toBeInTheDocument();
      expect(
        within(breakdown).getByText(
          formatModalAmount(testCase.amount, testCase.asset),
        ),
      ).toBeInTheDocument();

      expect(within(breakdown).getByText(/Protocol Fee/)).toBeInTheDocument();
      expect(
        within(breakdown).getByText(
          formatModalAmount(expectedFeeResult.feeAmount, testCase.asset),
        ),
      ).toBeInTheDocument();

      expect(within(breakdown).getByText("Net Amount")).toBeInTheDocument();
      expect(
        within(breakdown).getByText(formatModalAmount(net, testCase.asset)),
      ).toBeInTheDocument();

      unmount();
    }
  });

  it("recomputes the breakdown when the amount changes", async () => {
    const { calculateProtocolFee } = await import("@/lib/fee-calculator");
    const baseProps = {
      isOpen: true,
      onClose: vi.fn(),
      onConfirm: vi.fn(),
      calculation: { dailyEarnings: 0.1, totalEarnings: 10 },
      type: "lend" as const,
    };

    const { rerender } = render(
      <ConfirmModal
        {...baseProps}
        data={{ asset: "XLM", amount: 1000, interestRate: 5 }}
      />,
    );

    const fee1000 = calculateProtocolFee("XLM", "lend", 1000);
    expect(
      screen.getByText(formatModalAmount(fee1000.feeAmount, "XLM")),
    ).toBeInTheDocument();

    rerender(
      <ConfirmModal
        {...baseProps}
        data={{ asset: "XLM", amount: 250, interestRate: 5 }}
      />,
    );

    const fee250 = calculateProtocolFee("XLM", "lend", 250);
    const breakdown = screen.getByTestId("fee-breakdown");
    expect(
      within(breakdown).getByText(formatModalAmount(fee250.feeAmount, "XLM")),
    ).toBeInTheDocument();
    expect(
      within(breakdown).getByText(formatModalAmount(250, "XLM")),
    ).toBeInTheDocument();
    expect(
      within(breakdown).getByText(
        formatModalAmount(Math.max(0, 250 - fee250.feeAmount), "XLM"),
      ),
    ).toBeInTheDocument();
  });

  it("shows a zero fee and zero net for a zero amount", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        data={{ asset: "XLM", amount: 0, interestRate: 5 }}
        calculation={null}
        type="lend"
      />,
    );

    const breakdown = screen.getByTestId("fee-breakdown");
    // Gross, fee, and net all format as 0.00 XLM — three rows.
    const zeros = within(breakdown).getAllByText(formatModalAmount(0, "XLM"));
    expect(zeros.length).toBeGreaterThanOrEqual(3);
  });

  it("omits the fee breakdown for withdraw (no fee schedule)", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        data={{ asset: "XLM", amount: 100, interestRate: 0 }}
        calculation={null}
        type="withdraw"
      />,
    );

    expect(screen.queryByTestId("fee-breakdown")).not.toBeInTheDocument();
  });

  it("omits the fee breakdown for an unknown market instead of blocking confirm", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        data={{ asset: "UNKNOWN", amount: 100, interestRate: 5 }}
        calculation={null}
        type="lend"
      />,
    );

    expect(screen.queryByTestId("fee-breakdown")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /confirm/i }),
    ).toBeInTheDocument();
  });
});

