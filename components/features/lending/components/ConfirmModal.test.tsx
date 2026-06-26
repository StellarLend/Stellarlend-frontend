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
