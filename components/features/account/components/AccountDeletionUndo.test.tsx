import React, { useState } from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import AccountDeletionUndo from "./AccountDeletionUndo";
import AccountDeletionDialog from "@/components/shared/common/AccountDeletionDialog";

// ─── AccountDeletionUndo unit tests ──────────────────────────────────────────

describe("AccountDeletionUndo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the initial countdown value", () => {
    render(<AccountDeletionUndo durationSeconds={10} onUndo={vi.fn()} onElapsed={vi.fn()} />);
    expect(screen.getByTestId("undo-countdown")).toHaveTextContent("10");
  });

  it("decrements the countdown once per second", () => {
    render(<AccountDeletionUndo durationSeconds={5} onUndo={vi.fn()} onElapsed={vi.fn()} />);

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByTestId("undo-countdown")).toHaveTextContent("4");

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByTestId("undo-countdown")).toHaveTextContent("3");
  });

  it("shows the Undo button", () => {
    render(<AccountDeletionUndo durationSeconds={10} onUndo={vi.fn()} onElapsed={vi.fn()} />);
    expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument();
  });

  it("undo before elapse: clicking Undo calls onUndo without calling onElapsed", () => {
    const onUndo = vi.fn();
    const onElapsed = vi.fn();
    render(<AccountDeletionUndo durationSeconds={5} onUndo={onUndo} onElapsed={onElapsed} />);

    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(screen.getByRole("button", { name: /undo/i }));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onElapsed).not.toHaveBeenCalled();
  });

  it("window elapse finalising: calls onElapsed when countdown reaches zero", () => {
    const onElapsed = vi.fn();
    render(<AccountDeletionUndo durationSeconds={3} onUndo={vi.fn()} onElapsed={onElapsed} />);

    for (let i = 0; i < 3; i++) {
      act(() => vi.advanceTimersByTime(1000));
    }
    expect(onElapsed).toHaveBeenCalledTimes(1);
  });

  it("calls onElapsed exactly once even if time continues past zero", () => {
    const onElapsed = vi.fn();
    render(<AccountDeletionUndo durationSeconds={2} onUndo={vi.fn()} onElapsed={onElapsed} />);

    for (let i = 0; i < 5; i++) {
      act(() => vi.advanceTimersByTime(1000));
    }
    expect(onElapsed).toHaveBeenCalledTimes(1);
  });

  it("navigate-away cleanup: unmounting clears the timer so onElapsed is never called", () => {
    const onElapsed = vi.fn();
    const { unmount } = render(
      <AccountDeletionUndo durationSeconds={5} onUndo={vi.fn()} onElapsed={onElapsed} />
    );

    act(() => vi.advanceTimersByTime(2000));
    unmount();
    act(() => vi.advanceTimersByTime(10000));

    expect(onElapsed).not.toHaveBeenCalled();
  });

  it("has an aria-live='polite' region for screen-reader announcements", () => {
    render(<AccountDeletionUndo durationSeconds={10} onUndo={vi.fn()} onElapsed={vi.fn()} />);
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute("aria-atomic", "true");
  });

  it("live region announces remaining seconds", () => {
    render(<AccountDeletionUndo durationSeconds={5} onUndo={vi.fn()} onElapsed={vi.fn()} />);
    const liveRegion = document.querySelector('[aria-live="polite"]')!;
    expect(liveRegion).toHaveTextContent(/5 seconds/i);

    // advance one second at a time so each chained setTimeout fires in order
    for (let i = 0; i < 4; i++) {
      act(() => vi.advanceTimersByTime(1000));
    }
    expect(liveRegion).toHaveTextContent(/1 second/i);
  });

  it("uses singular 'second' in visible text at 1 second remaining", () => {
    render(<AccountDeletionUndo durationSeconds={1} onUndo={vi.fn()} onElapsed={vi.fn()} />);
    expect(screen.getByTestId("undo-window")).toHaveTextContent(/1 second\./i);
  });

  it("focuses the Undo button on mount", () => {
    render(<AccountDeletionUndo durationSeconds={10} onUndo={vi.fn()} onElapsed={vi.fn()} />);
    expect(screen.getByRole("button", { name: /undo/i })).toHaveFocus();
  });
});

// ─── Full deletion flow via AccountDeletionDialog ────────────────────────────

function DeletionDialogHarness({
  onCancel = vi.fn(),
  onConfirmDelete = vi.fn() as () => void | Promise<void>,
}: {
  onCancel?: () => void;
  onConfirmDelete?: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <AccountDeletionDialog
        isOpen={open}
        onCancel={() => {
          onCancel();
          setOpen(false);
        }}
        onConfirmDelete={async () => {
          await onConfirmDelete();
          setOpen(false);
        }}
      />
    </div>
  );
}

function openAndConfirm() {
  fireEvent.click(screen.getByRole("button", { name: /open dialog/i }));
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));
}

describe("AccountDeletionDialog – undo window integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the undo window after clicking Delete My Account", () => {
    render(<DeletionDialogHarness />);
    openAndConfirm();

    expect(screen.getByTestId("undo-window")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument();
  });

  it("undo before elapse: clicking Undo returns to the confirmation form", () => {
    const onConfirmDelete = vi.fn();
    render(<DeletionDialogHarness onConfirmDelete={onConfirmDelete} />);
    openAndConfirm();

    act(() => vi.advanceTimersByTime(3000));
    fireEvent.click(screen.getByRole("button", { name: /undo/i }));

    expect(screen.queryByTestId("undo-window")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(onConfirmDelete).not.toHaveBeenCalled();
  });

  it("window elapse finalising: onConfirmDelete is called after the countdown", async () => {
    const onConfirmDelete = vi.fn();
    render(<DeletionDialogHarness onConfirmDelete={onConfirmDelete} />);
    openAndConfirm();

    for (let i = 0; i < 10; i++) {
      act(() => vi.advanceTimersByTime(1000));
    }
    // flush microtasks from the async handleElapsed chain
    await act(async () => {});
    expect(onConfirmDelete).toHaveBeenCalledTimes(1);
  });

  it("navigate-away cleanup: unmounting during countdown does not call onConfirmDelete", () => {
    const onConfirmDelete = vi.fn();
    const { unmount } = render(<DeletionDialogHarness onConfirmDelete={onConfirmDelete} />);
    openAndConfirm();

    act(() => vi.advanceTimersByTime(3000));
    unmount();
    act(() => vi.advanceTimersByTime(15000));

    expect(onConfirmDelete).not.toHaveBeenCalled();
  });

  it("deletion request failure: shows error alert when onConfirmDelete rejects", async () => {
    const onConfirmDelete = vi.fn().mockRejectedValue(new Error("Server error"));
    render(<DeletionDialogHarness onConfirmDelete={onConfirmDelete} />);
    openAndConfirm();

    for (let i = 0; i < 10; i++) {
      act(() => vi.advanceTimersByTime(1000));
    }
    // flush microtasks: the rejected promise propagates through two async layers
    await act(async () => {});
    await act(async () => {});
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/server error/i);
  });

  it("Escape during countdown returns to the form without closing the dialog", () => {
    const onCancel = vi.fn();
    render(<DeletionDialogHarness onCancel={onCancel} />);
    openAndConfirm();

    expect(screen.getByTestId("undo-window")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByTestId("undo-window")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
