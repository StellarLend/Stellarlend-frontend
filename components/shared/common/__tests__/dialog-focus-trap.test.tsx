import React, { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import SessionExpiryDialog from "../SessionExpiryDialog";
import AccountDeletionDialog from "../AccountDeletionDialog";

// ─── SessionExpiryDialog harness ────────────────────────────────────────────

function SessionExpiryHarness({
  onStayLoggedIn = vi.fn(),
  onLogOut = vi.fn(),
}: {
  onStayLoggedIn?: () => void;
  onLogOut?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open session dialog</button>
      <SessionExpiryDialog
        isOpen={open}
        onStayLoggedIn={() => { onStayLoggedIn(); setOpen(false); }}
        onLogOut={() => { onLogOut(); setOpen(false); }}
      />
    </div>
  );
}

// ─── AccountDeletionDialog harness ──────────────────────────────────────────

function AccountDeletionHarness({
  onCancel = vi.fn(),
  onConfirmDelete = vi.fn(),
}: {
  onCancel?: () => void;
  onConfirmDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open deletion dialog</button>
      <AccountDeletionDialog
        isOpen={open}
        onCancel={() => { onCancel(); setOpen(false); }}
        onConfirmDelete={() => { onConfirmDelete(); setOpen(false); }}
      />
    </div>
  );
}

// ─── SessionExpiryDialog tests ───────────────────────────────────────────────

describe("SessionExpiryDialog – focus-trap & aria-modal", () => {
  it("has role=dialog, aria-modal=true, and aria-labelledby pointing to the title", async () => {
    const user = userEvent.setup();
    render(<SessionExpiryHarness />);
    await user.click(screen.getByRole("button", { name: /open session dialog/i }));

    const dialog = screen.getByRole("dialog", { name: /session expiring soon/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "session-expiry-title");
    expect(within(dialog).getByText(/session expiring soon/i)).toBeInTheDocument();
  });

  it("moves focus into the dialog on open", async () => {
    const user = userEvent.setup();
    render(<SessionExpiryHarness />);
    await user.click(screen.getByRole("button", { name: /open session dialog/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("traps Tab cycling between focusable elements", async () => {
    const user = userEvent.setup();
    render(<SessionExpiryHarness />);
    await user.click(screen.getByRole("button", { name: /open session dialog/i }));

    const dialog = screen.getByRole("dialog");
    const [logOutBtn, stayBtn] = within(dialog).getAllByRole("button");

    // "Stay Logged In" should receive initial focus (stayButtonRef)
    expect(stayBtn).toHaveFocus();

    // Tab from last → wraps to first
    await user.tab();
    expect(logOutBtn).toHaveFocus();

    // Tab from first → wraps to last
    await user.tab();
    expect(stayBtn).toHaveFocus();

    // Shift+Tab from last → wraps to first
    await user.tab({ shift: true });
    expect(logOutBtn).toHaveFocus();
  });

  it("Shift+Tab at the first element wraps to the last", async () => {
    const user = userEvent.setup();
    render(<SessionExpiryHarness />);
    await user.click(screen.getByRole("button", { name: /open session dialog/i }));

    const dialog = screen.getByRole("dialog");
    const [logOutBtn, stayBtn] = within(dialog).getAllByRole("button");

    stayBtn.focus();
    await user.tab();
    // now on logOutBtn (first)
    expect(logOutBtn).toHaveFocus();
    await user.tab({ shift: true });
    // should wrap to stayBtn (last)
    expect(stayBtn).toHaveFocus();
  });

  it("Escape closes the dialog and returns focus to the opener", async () => {
    const user = userEvent.setup();
    const onLogOut = vi.fn();
    render(<SessionExpiryHarness onLogOut={onLogOut} />);

    const trigger = screen.getByRole("button", { name: /open session dialog/i });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onLogOut).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });

  it("explicit close via button returns focus to the opener", async () => {
    const user = userEvent.setup();
    const onLogOut = vi.fn();
    render(<SessionExpiryHarness onLogOut={onLogOut} />);

    const trigger = screen.getByRole("button", { name: /open session dialog/i });
    await user.click(trigger);

    await user.click(screen.getByRole("button", { name: /log out/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});

// ─── AccountDeletionDialog tests ─────────────────────────────────────────────

describe("AccountDeletionDialog – focus-trap & aria-modal", () => {
  it("has role=dialog, aria-modal=true, and aria-labelledby pointing to the title", async () => {
    const user = userEvent.setup();
    render(<AccountDeletionHarness />);
    await user.click(screen.getByRole("button", { name: /open deletion dialog/i }));

    const dialog = screen.getByRole("dialog", { name: /delete account/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "account-deletion-title");
    expect(within(dialog).getByText(/delete account/i)).toBeInTheDocument();
  });

  it("moves focus into the dialog on open", async () => {
    const user = userEvent.setup();
    render(<AccountDeletionHarness />);
    await user.click(screen.getByRole("button", { name: /open deletion dialog/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("traps Tab cycling through all focusable elements", async () => {
    const user = userEvent.setup();
    render(<AccountDeletionHarness />);
    await user.click(screen.getByRole("button", { name: /open deletion dialog/i }));

    const dialog = screen.getByRole("dialog");
    const cancelBtn = within(dialog).getByRole("button", { name: /cancel/i });
    const checkbox = within(dialog).getByRole("checkbox");
    // delete button is initially disabled so not in focus trap
    const deleteBtn = within(dialog).getByRole("button", { name: /delete my account/i });

    // Cancel button should receive initial focus (cancelButtonRef)
    expect(cancelBtn).toHaveFocus();

    // Tab forward: cancel → checkbox
    await user.tab();
    expect(checkbox).toHaveFocus();

    // Tab forward from last focusable wraps back to first
    await user.tab();
    expect(cancelBtn).toHaveFocus();

    // Shift+Tab from first wraps to last
    await user.tab({ shift: true });
    expect(checkbox).toHaveFocus();

    // Enable delete button by checking checkbox
    await user.click(checkbox);
    expect(deleteBtn).not.toBeDisabled();
  });

  it("Escape closes the dialog and returns focus to the opener", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<AccountDeletionHarness onCancel={onCancel} />);

    const trigger = screen.getByRole("button", { name: /open deletion dialog/i });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });

  it("delete button is disabled until checkbox is checked", async () => {
    const user = userEvent.setup();
    const onConfirmDelete = vi.fn();
    render(<AccountDeletionHarness onConfirmDelete={onConfirmDelete} />);

    await user.click(screen.getByRole("button", { name: /open deletion dialog/i }));
    const dialog = screen.getByRole("dialog");
    const deleteBtn = within(dialog).getByRole("button", { name: /delete my account/i });

    expect(deleteBtn).toBeDisabled();

    await user.click(within(dialog).getByRole("checkbox"));
    expect(deleteBtn).toBeEnabled();

    await user.click(deleteBtn);
    expect(onConfirmDelete).toHaveBeenCalledTimes(1);
  });

  it("explicit cancel returns focus to the opener", async () => {
    const user = userEvent.setup();
    render(<AccountDeletionHarness />);

    const trigger = screen.getByRole("button", { name: /open deletion dialog/i });
    await user.click(trigger);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
