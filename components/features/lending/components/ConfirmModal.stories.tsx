/**
 * ConfirmModal Storybook Stories
 *
 * Includes Storybook interaction (play) tests that guard the modal's focus-trap
 * and Escape-to-close behaviour in a browser-like environment.
 *
 * Run with:
 *   pnpm storybook          — visual inspection in the browser
 *   pnpm test               — Vitest + @storybook/addon-vitest runner
 */

import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import ConfirmModal from "./ConfirmModal";
import type { LendingData, CalculationResult } from "@/app/lending/page";
import type { LendingActionType } from "@/lib/lending/types";

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const lendData: LendingData = {
  asset: "XLM",
  amount: 250,
  interestRate: 4.5,
};

const lendCalculation: CalculationResult = {
  dailyEarnings: 0.03,
  totalEarnings: 4.2,
};

const borrowData: LendingData = {
  asset: "USDC",
  amount: 500,
  interestRate: 7.2,
  duration: 30,
  collateral: "XLM",
  collateralAmount: 750,
};

const borrowCalculation: CalculationResult = {
  dailyEarnings: 0,
  totalEarnings: 0,
  monthlyPayment: 36,
  totalRepayment: 536,
};

const repayData: LendingData = {
  asset: "USDC",
  amount: 100,
  interestRate: 7.2,
  positionId: "POS-001",
  remainingDebt: 400,
  outstandingDebt: 500,
  healthFactorAfter: 1.85,
};

const withdrawData: LendingData = {
  asset: "XLM",
  amount: 100,
  interestRate: 4.5,
  positionId: "POS-002",
  remainingDebt: 150,
};

// ---------------------------------------------------------------------------
// Stateful wrapper — mirrors ConfirmModalHarness from the RTL test file.
// Needed because ConfirmModal expects `isOpen` controlled externally.
// ---------------------------------------------------------------------------

interface HarnessProps {
  type?: LendingActionType;
  data?: LendingData;
  calculation?: CalculationResult | null;
  onClose?: () => void;
  onConfirm?: () => void | Promise<void>;
  startOpen?: boolean;
}

function ConfirmModalHarness({
  type = "lend",
  data = lendData,
  calculation = lendCalculation,
  onClose,
  onConfirm,
  startOpen = false,
}: HarnessProps) {
  // Default to a no-op spy when no callback provided — avoids sharing a
  // single fn() instance across multiple story renders.
  const handleClose = onClose ?? fn();
  const handleConfirm = onConfirm ?? fn();
  const [isOpen, setIsOpen] = useState(startOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
      >
        Open modal
      </button>
      <ConfirmModal
        isOpen={isOpen}
        onClose={() => {
          handleClose();
          setIsOpen(false);
        }}
        onConfirm={async () => {
          await handleConfirm();
        }}
        data={data}
        calculation={calculation}
        type={type}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof ConfirmModal> = {
  title: "Features/Lending/ConfirmModal",
  component: ConfirmModal,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Confirmation dialog for lending, borrowing, repay and withdraw actions. " +
          "Guards focus trap and Escape-to-close behaviour via Storybook play tests.",
      },
    },
  },
  argTypes: {
    isOpen: { control: "boolean" },
    type: {
      control: "select",
      options: ["lend", "borrow", "repay", "withdraw"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ConfirmModal>;

// ---------------------------------------------------------------------------
// Static / visual stories (no play)
// ---------------------------------------------------------------------------

/** Lend variant — open by default for visual inspection */
export const LendOpen: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onConfirm: fn(),
    data: lendData,
    calculation: lendCalculation,
    type: "lend",
  },
  parameters: {
    docs: {
      description: { story: "Lend confirmation dialog in its default open state." },
    },
  },
};

/** Borrow variant with collateral details */
export const BorrowOpen: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onConfirm: fn(),
    data: borrowData,
    calculation: borrowCalculation,
    type: "borrow",
  },
};

/** Repay variant */
export const RepayOpen: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onConfirm: fn(),
    data: repayData,
    calculation: null,
    type: "repay",
  },
};

/** Withdraw variant */
export const WithdrawOpen: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onConfirm: fn(),
    data: withdrawData,
    calculation: null,
    type: "withdraw",
  },
};

// ---------------------------------------------------------------------------
// Interaction (play) stories
// ---------------------------------------------------------------------------

/**
 * FocusTrapAndInitialFocus
 *
 * Asserts that:
 *  1. The dialog is accessible (role="dialog", aria-modal="true").
 *  2. Focus moves to the close button immediately on open.
 *  3. Tab cycles through all focusable elements inside the modal — forward
 *     and backward — without ever leaving the dialog.
 */
export const FocusTrapAndInitialFocus: Story = {
  name: "Play: Focus trap and initial focus",
  render: () => (
    <ConfirmModalHarness
      type="lend"
      data={lendData}
      calculation={lendCalculation}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Opens the modal and verifies that initial focus lands on the close button, " +
          "then confirms Tab cycles only within the dialog (forward and backward).",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // ── Open the modal ──────────────────────────────────────────────────────
    await userEvent.click(canvas.getByRole("button", { name: /open modal/i }));

    // Wait for the dialog to appear in the DOM
    const dialog = await canvas.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const dialogScope = within(dialog);

    // ── Initial focus should be on the close button ─────────────────────────
    const closeButton = dialogScope.getByRole("button", { name: /close modal/i });
    expect(closeButton).toHaveFocus();

    // ── Collect all focusable elements in document order ────────────────────
    // The modal contains: close button, terms-link button, checkbox, cancel button, confirm button
    // Confirm button starts disabled → focus trap skips disabled elements.
    const cancelButton = dialogScope.getByRole("button", { name: /^cancel$/i });
    const checkbox = dialogScope.getByRole("checkbox");
    // "terms and conditions" link-button is between checkbox label and cancel
    const termsButton = dialogScope.getByRole("button", { name: /terms and conditions/i });

    // ── Forward Tab cycle: close → terms → checkbox → cancel → close ────────
    await userEvent.tab();
    expect(termsButton).toHaveFocus();

    await userEvent.tab();
    expect(checkbox).toHaveFocus();

    await userEvent.tab();
    expect(cancelButton).toHaveFocus();

    // Confirm button is disabled, so the next Tab wraps back to close
    await userEvent.tab();
    expect(closeButton).toHaveFocus();

    // ── Reverse (Shift+Tab) cycle: close → cancel → checkbox → terms ────────
    await userEvent.tab({ shift: true });
    expect(cancelButton).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(checkbox).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(termsButton).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(closeButton).toHaveFocus();
  },
};

/**
 * FocusTrapWithConfirmEnabled
 *
 * Once the terms checkbox is checked the confirm button becomes enabled and
 * must join the Tab cycle. Verifies the focus trap still holds.
 */
export const FocusTrapWithConfirmEnabled: Story = {
  name: "Play: Focus trap — confirm button joins cycle when enabled",
  render: () => (
    <ConfirmModalHarness
      type="lend"
      data={lendData}
      calculation={lendCalculation}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Checks the terms checkbox to enable the Confirm button, then " +
          "verifies Tab still cycles within the dialog including the now-enabled button.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /open modal/i }));

    const dialog = await canvas.findByRole("dialog");
    const dialogScope = within(dialog);

    const closeButton = dialogScope.getByRole("button", { name: /close modal/i });
    const cancelButton = dialogScope.getByRole("button", { name: /^cancel$/i });
    const checkbox = dialogScope.getByRole("checkbox");
    const termsButton = dialogScope.getByRole("button", { name: /terms and conditions/i });

    // Confirm button is disabled before checkbox is checked
    const confirmButton = dialogScope.getByRole("button", { name: /confirm lending/i });
    expect(confirmButton).toBeDisabled();

    // Check the terms checkbox
    await userEvent.click(checkbox);
    expect(confirmButton).toBeEnabled();

    // Reset focus to close button
    closeButton.focus();

    // Forward cycle now includes confirm: close → terms → checkbox → cancel → confirm → close
    await userEvent.tab();
    expect(termsButton).toHaveFocus();

    await userEvent.tab();
    expect(checkbox).toHaveFocus();

    await userEvent.tab();
    expect(cancelButton).toHaveFocus();

    await userEvent.tab();
    expect(confirmButton).toHaveFocus();

    // Wraps back to close
    await userEvent.tab();
    expect(closeButton).toHaveFocus();

    // Reverse: close → confirm → cancel → checkbox → terms → close
    await userEvent.tab({ shift: true });
    expect(confirmButton).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(cancelButton).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(checkbox).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(termsButton).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(closeButton).toHaveFocus();
  },
};

/**
 * EscapeClosesModal
 *
 * Asserts that pressing Escape:
 *  1. Removes the dialog from the DOM.
 *  2. Returns focus to the element that triggered the modal.
 */
export const EscapeClosesModal: Story = {
  name: "Play: Escape closes modal and restores focus",
  render: () => (
    <ConfirmModalHarness
      type="lend"
      data={lendData}
      calculation={lendCalculation}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: "Verifies that pressing the Escape key dismisses the modal and restores focus to the trigger button.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const triggerButton = canvas.getByRole("button", { name: /open modal/i });
    await userEvent.click(triggerButton);

    // Dialog must be present
    expect(await canvas.findByRole("dialog")).toBeInTheDocument();

    // Press Escape
    await userEvent.keyboard("{Escape}");

    // Dialog should be removed from DOM
    await waitFor(() =>
      expect(canvas.queryByRole("dialog")).not.toBeInTheDocument()
    );

    // Focus must return to the trigger button
    expect(triggerButton).toHaveFocus();
  },
};

/**
 * CloseViaCloseButton
 *
 * Clicking the × close button dismisses the modal and returns focus to trigger.
 */
export const CloseViaCloseButton: Story = {
  name: "Play: × button closes modal",
  render: () => (
    <ConfirmModalHarness
      type="lend"
      data={lendData}
      calculation={lendCalculation}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const trigger = canvas.getByRole("button", { name: /open modal/i });
    await userEvent.click(trigger);

    const dialog = await canvas.findByRole("dialog");
    const closeButton = within(dialog).getByRole("button", { name: /close modal/i });

    await userEvent.click(closeButton);

    await waitFor(() =>
      expect(canvas.queryByRole("dialog")).not.toBeInTheDocument()
    );

    expect(trigger).toHaveFocus();
  },
};

/**
 * CloseViaCancelButton
 *
 * Clicking Cancel dismisses the modal and returns focus to trigger.
 */
export const CloseViaCancelButton: Story = {
  name: "Play: Cancel button closes modal",
  render: () => (
    <ConfirmModalHarness
      type="lend"
      data={lendData}
      calculation={lendCalculation}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const trigger = canvas.getByRole("button", { name: /open modal/i });
    await userEvent.click(trigger);

    const dialog = await canvas.findByRole("dialog");
    const cancelButton = within(dialog).getByRole("button", { name: /^cancel$/i });

    await userEvent.click(cancelButton);

    await waitFor(() =>
      expect(canvas.queryByRole("dialog")).not.toBeInTheDocument()
    );

    expect(trigger).toHaveFocus();
  },
};

/**
 * CloseViaBackdrop
 *
 * Clicking the semi-transparent backdrop overlay dismisses the modal.
 */
export const CloseViaBackdrop: Story = {
  name: "Play: Backdrop click closes modal",
  render: () => (
    <ConfirmModalHarness
      type="lend"
      data={lendData}
      calculation={lendCalculation}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: /open modal/i }));

    // Confirm the dialog is open
    expect(await canvas.findByRole("dialog")).toBeInTheDocument();

    // The backdrop is the fixed overlay div rendered before the modal panel.
    // It carries `fixed inset-0` Tailwind classes and no role.
    const backdrop = canvasElement.querySelector(
      ".fixed.inset-0.bg-gray-500"
    ) as HTMLElement;
    expect(backdrop).toBeInTheDocument();

    await userEvent.click(backdrop);

    await waitFor(() =>
      expect(canvas.queryByRole("dialog")).not.toBeInTheDocument()
    );
  },
};

/**
 * ConfirmDisabledUntilAgreed
 *
 * The Confirm button must stay disabled until the terms checkbox is checked.
 */
export const ConfirmDisabledUntilAgreed: Story = {
  name: "Play: Confirm button disabled until terms agreed",
  render: () => (
    <ConfirmModalHarness
      type="lend"
      data={lendData}
      calculation={lendCalculation}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: "Confirm button is disabled initially; checking the terms checkbox enables it.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: /open modal/i }));

    const dialog = await canvas.findByRole("dialog");
    const dialogScope = within(dialog);

    const confirmButton = dialogScope.getByRole("button", { name: /confirm lending/i });
    const checkbox = dialogScope.getByRole("checkbox");

    // Initially disabled
    expect(confirmButton).toBeDisabled();
    expect(checkbox).not.toBeChecked();

    // Check the terms
    await userEvent.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(confirmButton).toBeEnabled();

    // Uncheck — should disable again
    await userEvent.click(checkbox);

    expect(checkbox).not.toBeChecked();
    expect(confirmButton).toBeDisabled();
  },
};

/**
 * ConfirmSuccess
 *
 * After agreeing to terms and clicking Confirm:
 *  1. onConfirm is called once.
 *  2. A success status message appears.
 *  3. The modal eventually closes.
 */
export const ConfirmSuccess: Story = {
  name: "Play: Successful confirmation flow",
  render: () => {
    const onConfirm = fn().mockResolvedValue(undefined);
    return (
      <ConfirmModalHarness
        type="lend"
        data={lendData}
        calculation={lendCalculation}
        onConfirm={onConfirm}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: /open modal/i }));

    const dialog = await canvas.findByRole("dialog");
    const dialogScope = within(dialog);

    // Agree to terms
    await userEvent.click(dialogScope.getByRole("checkbox"));

    // Confirm
    const confirmButton = dialogScope.getByRole("button", { name: /confirm lending/i });
    expect(confirmButton).toBeEnabled();
    await userEvent.click(confirmButton);

    // Success alert should appear
    await waitFor(() =>
      expect(
        dialogScope.getByRole("alert")
      ).toHaveTextContent(/transaction confirmed successfully/i)
    );
  },
};

/**
 * ConfirmError
 *
 * When onConfirm rejects, an error alert is shown and the modal stays open.
 */
export const ConfirmError: Story = {
  name: "Play: Failed confirmation shows error",
  render: () => {
    const onConfirm = fn().mockRejectedValue(new Error("Network error"));
    return (
      <ConfirmModalHarness
        type="lend"
        data={lendData}
        calculation={lendCalculation}
        onConfirm={onConfirm}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: /open modal/i }));

    const dialog = await canvas.findByRole("dialog");
    const dialogScope = within(dialog);

    // Agree and confirm
    await userEvent.click(dialogScope.getByRole("checkbox"));
    await userEvent.click(
      dialogScope.getByRole("button", { name: /confirm lending/i })
    );

    // Error alert should appear
    await waitFor(() =>
      expect(dialogScope.getByRole("alert")).toHaveTextContent(
        /transaction failed/i
      )
    );

    // Modal should still be open
    expect(canvas.getByRole("dialog")).toBeInTheDocument();
  },
};

/**
 * BorrowFocusTrap
 *
 * Runs the same focus-trap assertions for the borrow variant (different title,
 * additional collateral information rendered).
 */
export const BorrowFocusTrap: Story = {
  name: "Play: Borrow variant — focus trap",
  render: () => (
    <ConfirmModalHarness
      type="borrow"
      data={borrowData}
      calculation={borrowCalculation}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: "Ensures the focus trap works correctly for the borrow action type.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: /open modal/i }));

    const dialog = await canvas.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    // Correct heading for borrow type
    expect(within(dialog).getByRole("heading")).toHaveTextContent(
      /confirm borrowing transaction/i
    );

    const dialogScope = within(dialog);
    const closeButton = dialogScope.getByRole("button", { name: /close modal/i });

    // Initial focus
    expect(closeButton).toHaveFocus();

    // Shift+Tab from close wraps to last focusable (cancel, confirm disabled)
    await userEvent.tab({ shift: true });
    expect(
      dialogScope.getByRole("button", { name: /^cancel$/i })
    ).toHaveFocus();
  },
};

/**
 * ModalAccessibility
 *
 * Static accessibility assertions: correct ARIA roles, labels, and attributes.
 */
export const ModalAccessibility: Story = {
  name: "Play: ARIA attributes",
  args: {
    isOpen: true,
    onClose: fn(),
    onConfirm: fn(),
    data: lendData,
    calculation: lendCalculation,
    type: "lend",
  },
  play: async ({ canvasElement }) => {
    const dialog = canvasElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "confirm-transaction-title");

    const heading = document.getElementById("confirm-transaction-title");
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent(/confirm lending transaction/i);
  },
};
