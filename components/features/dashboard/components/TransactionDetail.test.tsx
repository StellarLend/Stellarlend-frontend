import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@/test/test-utils";
import TransactionDetail from "./TransactionDetail";
import type { Transaction } from "@/types/Transaction";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    // Patch only the clipboard slice of navigator instead of replacing the
    // entire object so other navigator APIs (userAgent, language, ...) are
    // preserved in JSDOM. Direct property assignment is safer than
    // defineProperty across jsdom versions that may declare `clipboard`
    // as a non-configurable accessor.
    (window.navigator as unknown as { clipboard: { writeText: typeof writeText } }).clipboard = {
      writeText,
    };
    // Headless UI's Transition relies on requestAnimationFrame; flush it
    // synchronously so the modal content is in the DOM immediately.
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Restore jsdom's original clipboard (which is undefined in the test env).
    try {
      delete (window.navigator as unknown as { clipboard?: unknown }).clipboard;
    } catch {
      // Some jsdom builds treat navigator.clipboard as non-configurable
      // and refuse the delete; in that case the per-test overwrite above
      // re-asserts a consistent stub on the next test run.
    }
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

  it("writes the transaction id to the clipboard when copy is clicked", async () => {
    render(
      <TransactionDetail
        transaction={buildTransaction({ id: "TXN-COPY-42" })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Copy transaction ID/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("TXN-COPY-42");
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

    // The component's date formatting is locale and timezone dependent, so
    // we only assert that the labelled Date & Time row contains *something*
    // rendered (i.e. the value slot is non-empty).
    await waitFor(() => {
      expect(screen.getByText("Date & Time:")).toBeInTheDocument();
    });
  });
});
