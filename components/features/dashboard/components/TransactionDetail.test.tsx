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
import { copyToClipboard } from "@/lib/utils/clipboard";

vi.mock("@/lib/utils/clipboard", () => ({
  copyToClipboard: vi.fn(),
}));

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
  const mockFetch = vi.fn();

  beforeEach(() => {
    // Headless UI's Transition relies on requestAnimationFrame; flush it
    // synchronously so the modal content is in the DOM immediately.
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ transaction: null }),
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.clearAllMocks();
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

  it("calls the clipboard helper with the transaction id when copy is clicked", async () => {
    vi.mocked(copyToClipboard).mockResolvedValue({ success: true });
    
    render(
      <TransactionDetail
        transaction={buildTransaction({ id: "TXN-COPY-42" })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Copy transaction ID/i }));

    await waitFor(() => {
      expect(copyToClipboard).toHaveBeenCalledWith("TXN-COPY-42");
    });
  });

  it("shows a success toast when copy succeeds", async () => {
    vi.mocked(copyToClipboard).mockResolvedValue({ success: true });
    
    render(
      <TransactionDetail
        transaction={buildTransaction({ id: "TXN-COPY-42" })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Copy transaction ID/i }));

    await waitFor(() => {
      expect(screen.getByText("Copied")).toBeInTheDocument();
      expect(screen.getByText("Transaction ID copied to clipboard")).toBeInTheDocument();
    });
  });

  it("shows an error toast when copy fails", async () => {
    vi.mocked(copyToClipboard).mockResolvedValue({ success: false, reason: "clipboard_error" });
    
    render(
      <TransactionDetail
        transaction={buildTransaction({ id: "TXN-COPY-42" })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Copy transaction ID/i }));

    await waitFor(() => {
      expect(screen.getByText("Copy failed")).toBeInTheDocument();
      expect(screen.getByText("Failed to copy transaction ID")).toBeInTheDocument();
    });
  });

  it("removes the toast after 3 seconds on success", async () => {
    vi.mocked(copyToClipboard).mockResolvedValue({ success: true });
    
    render(
      <TransactionDetail
        transaction={buildTransaction({ id: "TXN-COPY-42" })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Copy transaction ID/i }));

    await waitFor(() => {
      expect(screen.getByText("Copied")).toBeInTheDocument();
    });

    // Fast-forward time by 3 seconds
    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(screen.queryByText("Copied")).not.toBeInTheDocument();
    });
  });

  it("removes the toast after 3 seconds on failure", async () => {
    vi.mocked(copyToClipboard).mockResolvedValue({ success: false, reason: "clipboard_error" });
    
    render(
      <TransactionDetail
        transaction={buildTransaction({ id: "TXN-COPY-42" })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Copy transaction ID/i }));

    await waitFor(() => {
      expect(screen.getByText("Copy failed")).toBeInTheDocument();
    });

    // Fast-forward time by 3 seconds
    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(screen.queryByText("Copy failed")).not.toBeInTheDocument();
    });
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

  describe('Toast integration with Toast.tsx ToastProps contract', () => {
    /**
     * Verify that the toast rendered by TransactionDetail uses exactly the subset of
     * ToastProps that Toast.tsx expects. Since TransactionDetail declares its own
     * local toast state shape, this test guards against a mismatch where the local
     * shape drifts from Toast.tsx's actual props contract.
     */
    it('renders success toast with the exact DOM structure Toast.tsx produces', async () => {
      vi.mocked(copyToClipboard).mockResolvedValue({ success: true });

      render(
        <TransactionDetail
          transaction={buildTransaction({ id: 'TXN-TOAST-SHAPE' })}
          isOpen
          onClose={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Copy transaction ID/i }));

      // Wait for the toast container to appear
      await waitFor(() => {
        const toast = screen.getByRole('status');
        expect(toast).toBeInTheDocument();
      });

      const toast = screen.getByRole('status');

      // ── ToastProps shape assertions ──
      // title is rendered inside a font-medium container
      expect(toast.querySelector('.font-medium')).toHaveTextContent('Copied');
      // description is rendered inside a text-sm container
      expect(toast.querySelector('.text-sm')).toHaveTextContent('Transaction ID copied to clipboard');

      // variant="success" → green classes (matching Toast.tsx variantClasses)
      expect(toast).toHaveClass('bg-green-50');
      expect(toast).toHaveClass('text-green-800');
      expect(toast).toHaveClass('border-green-200');

      // accessibility attributes from Toast.tsx
      expect(toast).toHaveAttribute('role', 'status');
      expect(toast).toHaveAttribute('aria-live', 'polite');
    });

    it('renders error toast with the exact DOM structure Toast.tsx produces', async () => {
      vi.mocked(copyToClipboard).mockResolvedValue({ success: false, reason: 'clipboard_error' });

      render(
        <TransactionDetail
          transaction={buildTransaction({ id: 'TXN-TOAST-ERR' })}
          isOpen
          onClose={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Copy transaction ID/i }));

      await waitFor(() => {
        const toast = screen.getByRole('status');
        expect(toast).toBeInTheDocument();
      });

      const toast = screen.getByRole('status');

      // title is rendered
      expect(toast.querySelector('.font-medium')).toHaveTextContent('Copy failed');
      // description is rendered
      expect(toast.querySelector('.text-sm')).toHaveTextContent('Failed to copy transaction ID');

      // variant="error" → red classes (matching Toast.tsx variantClasses)
      expect(toast).toHaveClass('bg-red-50');
      expect(toast).toHaveClass('text-red-800');
      expect(toast).toHaveClass('border-red-200');

      // accessibility attributes
      expect(toast).toHaveAttribute('role', 'status');
      expect(toast).toHaveAttribute('aria-live', 'polite');
    });

    it('uses the default position="fixed" classes from Toast.tsx', async () => {
      vi.mocked(copyToClipboard).mockResolvedValue({ success: true });

      render(
        <TransactionDetail
          transaction={buildTransaction({ id: 'TXN-NO-CLASS' })}
          isOpen
          onClose={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Copy transaction ID/i }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });

      // TransactionDetail passes no className, position, or shouldReduceMotion.
      // position defaults to "fixed" in Toast.tsx, so we should see the fixed positioning class.
      const toast = screen.getByRole('status');
      expect(toast).toHaveClass('fixed');
    });

    it('passes only title, description, and variant to Toast — matching ToastProps optional signature', async () => {
      vi.mocked(copyToClipboard).mockResolvedValue({ success: true });

      render(
        <TransactionDetail
          transaction={buildTransaction({ id: 'TXN-SIGNATURE' })}
          isOpen
          onClose={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Copy transaction ID/i }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });

      // Verify no extraneous props leak: the toast element should not have
      // an id attribute (no id prop passed), and no inline style.
      const toast = screen.getByRole('status');
      expect(toast).not.toHaveAttribute('id');

      // The toast has no manual position="inline" override, and since
      // TransactionDetail doesn't pass position, it should use Toast.tsx default "fixed"
      // which adds right-4 top-6 z-50 positioning classes.
      expect(toast).toHaveClass('right-4');
      expect(toast).toHaveClass('top-6');
      expect(toast).toHaveClass('z-50');
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
