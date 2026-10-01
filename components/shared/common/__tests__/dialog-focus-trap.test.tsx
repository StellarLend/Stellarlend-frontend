import React, { useState } from "react";
import { render, screen, within } from "@testing-library/react";
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
        onStayLoggedIn={() => {
          onStayLoggedIn();
          setOpen(false);
        }}
        onLogOut={() => {
          onLogOut();
          setOpen(false);
        }}
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
        onCancel={() => {
          onCancel();
          setOpen(false);
        }}
        onConfirmDelete={() => {
          onConfirmDelete();
          setOpen(false);
        }}
      />
    </div>
  );
}

// ─── SessionExpiryDialog tests ───────────────────────────────────────────────

describe("SessionExpiryDialog – focus-trap & aria-modal", () => {
  it("has role=dialog, aria-modal=true, and aria-labelledby pointing to the title", async () => {
    const user = userEvent.setup();
    render(<SessionExpiryHarness />);
    await user.click(
      screen.getByRole("button", { name: /open session dialog/i }),
    );

    const dialog = screen.getByRole("dialog", {
      name: /session expiring soon/i,
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "session-expiry-title");
    expect(
      within(dialog).getByText(/session expiring soon/i),
    ).toBeInTheDocument();
  });

  it("moves focus into the dialog on open", async () => {
    const user = userEvent.setup();
    render(<SessionExpiryHarness />);
    await user.click(
      screen.getByRole("button", { name: /open session dialog/i }),
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});

// ─── AccountDeletionDialog tests ─────────────────────────────────────────────

describe("AccountDeletionDialog – focus-trap & aria-modal", () => {
  it("has role=dialog, aria-modal=true, and aria-labelledby pointing to the title", async () => {
    const user = userEvent.setup();
    render(<AccountDeletionHarness />);
    await user.click(
      screen.getByRole("button", { name: /open deletion dialog/i }),
    );

    const dialog = screen.getByRole("dialog", { name: /delete account/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "account-deletion-title");
    expect(within(dialog).getByText(/delete account/i)).toBeInTheDocument();
  });

  it("moves focus into the dialog on open", async () => {
    const user = userEvent.setup();
    render(<AccountDeletionHarness />);
    await user.click(
      screen.getByRole("button", { name: /open deletion dialog/i }),
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("delete button is disabled until checkbox is checked", async () => {
    const user = userEvent.setup();
    const onConfirmDelete = vi.fn();
    render(<AccountDeletionHarness onConfirmDelete={onConfirmDelete} />);

    await user.click(
      screen.getByRole("button", { name: /open deletion dialog/i }),
    );
    const dialog = screen.getByRole("dialog");
    const deleteBtn = within(dialog).getByRole("button", {
      name: /delete my account/i,
    });

    expect(deleteBtn).toBeDisabled();

    await user.click(within(dialog).getByRole("checkbox"));
    expect(deleteBtn).toBeEnabled();

    await user.click(deleteBtn);
    expect(onConfirmDelete).toHaveBeenCalledTimes(1);
  });
});
