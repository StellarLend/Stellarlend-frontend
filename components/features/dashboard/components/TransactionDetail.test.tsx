import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@/test/test-utils";
import TransactionDetail from "./TransactionDetail";
import type { Transaction } from "@/types/Transaction";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/utils/clipboard", () => ({
  copyToClipboard: vi.fn(),
}));

import { copyToClipboard } from "@/lib/utils/clipboard";

// Mock next/image so JSDOM does not need the Next.js runtime/config.
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...props} />
  ),
}));

const buildTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "TXN-001",
  type: "Lend",
  amount: 100,
  asset: "XLM",
  date: "2024-04-03",
  time: "10:30AM",
  status: "Completed",
  ...overrides,
});

describe("TransactionDetail Modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Headless UI's Transition relies on requestAnimationFrame; flush it
    // synchronously so the modal content is in the DOM immediately.
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("renders nothing when transaction is null", () => {
    render(
      <TransactionDetail transaction={null} isOpen onClose={vi.fn()} />,
    );
    expect(screen.queryByText("Transaction Details")).not.toBeInTheDocument();
  });

  it("renders the modal title and id when open with a transaction", async () => {
    render(
      <TransactionDetail transaction={buildTransaction()} isOpen onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Transaction Details")).toBeInTheDocument();
    });
    expect(screen.getByText("TXN-001")).toBeInTheDocument();
    expect(screen.getByText("Lend")).toBeInTheDocument();
    expect(screen.getByText("XLM")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("formats positive amounts with a leading plus sign and raw value", async () => {
    render(
      <TransactionDetail
        transaction={buildTransaction({ amount: 50 })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("+$50")).toBeInTheDocument();
    });
  });

  it("formats negative amounts with a minus sign and absolute value", async () => {
    render(
      <TransactionDetail
        transaction={buildTransaction({ amount: -75 })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("-$75")).toBeInTheDocument();
    });
  });

  it("calls copyToClipboard with the transaction id when copy is clicked", async () => {
    const mockCopy = vi.mocked(copyToClipboard).mockResolvedValue({
      success: true,
    });

    render(
      <TransactionDetail
        transaction={buildTransaction({ id: "TXN-COPY-42" })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Copy transaction ID/i }));

    await waitFor(() => {
      expect(mockCopy).toHaveBeenCalledWith("TXN-COPY-42");
    });
  });

  it("shows success toast when copy succeeds", async () => {
    vi.mocked(copyToClipboard).mockResolvedValue({ success: true });

    render(
      <TransactionDetail transaction={buildTransaction()} isOpen onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Copy transaction ID/i }));

    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Transaction ID copied to clipboard."),
    ).toBeInTheDocument();
  });

  it("shows error toast when clipboard fails", async () => {
    vi.mocked(copyToClipboard).mockResolvedValue({
      success: false,
      reason: "clipboard_error",
    });

    render(
      <TransactionDetail transaction={buildTransaction()} isOpen onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Copy transaction ID/i }));

    await waitFor(() => {
      expect(screen.getByText("Copy Failed")).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        "Clipboard access is unavailable. Try copying the ID manually.",
      ),
    ).toBeInTheDocument();
  });

  it("auto-dismisses the toast after 4 seconds", async () => {
    vi.useFakeTimers();
    vi.mocked(copyToClipboard).mockResolvedValue({ success: true });

    render(
      <TransactionDetail transaction={buildTransaction()} isOpen onClose={vi.fn()} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Copy transaction ID/i }));
    });

    expect(screen.getByText("Copied!")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(4000));

    expect(screen.queryByText("Copied!")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <TransactionDetail
        transaction={buildTransaction()}
        isOpen
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the date and time label rows when provided", async () => {
    render(
      <TransactionDetail
        transaction={buildTransaction({ date: "2024-04-03", time: "10:30AM" })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Date & Time:")).toBeInTheDocument();
    });
  });

  it("renders Print Receipt button in transaction details", async () => {
    render(
      <TransactionDetail
        transaction={buildTransaction()}
        isOpen
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /print receipt/i })).toBeInTheDocument();
    });
  });

  it("shows TransactionReceipt when Print Receipt button is clicked", async () => {
    render(
      <TransactionDetail
        transaction={buildTransaction()}
        isOpen
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Transaction Details")).toBeInTheDocument();
    });

    const printButton = screen.getByRole("button", { name: /print receipt/i });
    fireEvent.click(printButton);

    await waitFor(() => {
      expect(screen.getByText("Transaction Receipt")).toBeInTheDocument();
      expect(screen.getByText("Stellarlend Platform")).toBeInTheDocument();
    });

    // Modal should be hidden when receipt is shown
    expect(screen.queryByText("Transaction Details")).not.toBeInTheDocument();
  });

  it("can navigate back from receipt to transaction details", async () => {
    render(
      <TransactionDetail
        transaction={buildTransaction()}
        isOpen
        onClose={vi.fn()}
      />,
    );

    // Click Print Receipt
    const printButton = screen.getByRole("button", { name: /print receipt/i });
    fireEvent.click(printButton);

    await waitFor(() => {
      expect(screen.getByText("Transaction Receipt")).toBeInTheDocument();
    });

    // Click Back button
    const backButton = screen.getByRole("button", { name: /back to transaction details/i });
    fireEvent.click(backButton);

    await waitFor(() => {
      expect(screen.getByText("Transaction Details")).toBeInTheDocument();
      expect(screen.queryByText("Transaction Receipt")).not.toBeInTheDocument();
    });
  });

  it("resets receipt view when modal is closed and reopened", async () => {
    const { rerender } = render(
      <TransactionDetail
        transaction={buildTransaction()}
        isOpen
        onClose={vi.fn()}
      />,
    );

    // Open receipt
    const printButton = screen.getByRole("button", { name: /print receipt/i });
    fireEvent.click(printButton);

    await waitFor(() => {
      expect(screen.getByText("Transaction Receipt")).toBeInTheDocument();
    });

    // Close modal
    rerender(
      <TransactionDetail
        transaction={buildTransaction()}
        isOpen={false}
        onClose={vi.fn()}
      />,
    );

    // Reopen modal
    rerender(
      <TransactionDetail
        transaction={buildTransaction()}
        isOpen
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      // Should show transaction details, not receipt
      expect(screen.getByText("Transaction Details")).toBeInTheDocument();
      expect(screen.queryByText("Transaction Receipt")).not.toBeInTheDocument();
    });
  });
});
