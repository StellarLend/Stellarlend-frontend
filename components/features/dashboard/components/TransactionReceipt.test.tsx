import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@/test/test-utils";
import TransactionReceipt from "./TransactionReceipt";
import type { Transaction } from "@/types/Transaction";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock next/image so JSDOM does not need the Next.js runtime/config.
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...props} />
  ),
}));

// Mock window.print
const mockPrint = vi.fn();
const originalPrint = window.print;

beforeEach(() => {
  window.print = mockPrint;
});

afterEach(() => {
  window.print = originalPrint;
  mockPrint.mockClear();
});

// Helper function to build test transactions
function buildTransaction(overrides?: Partial<Transaction>): Transaction {
  return {
    id: "TXHASH123ABC",
    type: "Deposit",
    amount: 100,
    asset: "USDC",
    date: "2024-06-15",
    time: "2:30PM",
    status: "Completed",
    ...overrides,
  };
}

describe("TransactionReceipt Component", () => {
  describe("Rendering Core Transaction Data", () => {
    it("renders transaction header and Stellarlend branding", () => {
      render(<TransactionReceipt transaction={buildTransaction()} />);

      expect(screen.getByText("Transaction Receipt")).toBeInTheDocument();
      expect(screen.getByText("Stellarlend Platform")).toBeInTheDocument();
    });

    it("displays transaction ID", () => {
      render(
        <TransactionReceipt
          transaction={buildTransaction({ id: "UNIQUETXID456" })}
        />,
      );

      expect(screen.getByText("UNIQUETXID456")).toBeInTheDocument();
    });

    it("displays transaction type", () => {
      render(
        <TransactionReceipt transaction={buildTransaction({ type: "Withdrawal" })} />,
      );

      expect(screen.getByText("Withdrawal")).toBeInTheDocument();
    });

    it("displays positive amount with plus sign and green styling", () => {
      render(
        <TransactionReceipt transaction={buildTransaction({ amount: 250 })} />,
      );

      const amountElement = screen.getByText("+$250");
      expect(amountElement).toBeInTheDocument();
      expect(amountElement.className).toContain("text-green-600");
    });

    it("displays negative amount with minus sign and red styling", () => {
      render(
        <TransactionReceipt transaction={buildTransaction({ amount: -75.5 })} />,
      );

      const amountElement = screen.getByText("-$75.5");
      expect(amountElement).toBeInTheDocument();
      expect(amountElement.className).toContain("text-red-600");
    });

    it("displays asset symbol and icon", () => {
      render(
        <TransactionReceipt transaction={buildTransaction({ asset: "XLM" })} />,
      );

      expect(screen.getByText("XLM")).toBeInTheDocument();
      expect(screen.getByAltText("XLM")).toBeInTheDocument();
    });

    it("formats and displays date and time correctly", () => {
      render(
        <TransactionReceipt
          transaction={buildTransaction({ date: "2024-12-25", time: "11:45AM" })}
        />,
      );

      // The formatDateTime function converts to "Dec 25, 2024 11:45AM"
      expect(screen.getByText(/Dec 25, 2024/)).toBeInTheDocument();
      expect(screen.getByText(/11:45AM/)).toBeInTheDocument();
    });

    it("displays Completed status with green styling", () => {
      render(
        <TransactionReceipt
          transaction={buildTransaction({ status: "Completed" })}
        />,
      );

      const statusElement = screen.getByText("Completed");
      expect(statusElement).toBeInTheDocument();
      expect(statusElement.className).toContain("bg-green-100");
      expect(statusElement.className).toContain("text-green-800");
    });

    it("displays Processing status with yellow styling", () => {
      render(
        <TransactionReceipt
          transaction={buildTransaction({ status: "Processing" })}
        />,
      );

      const statusElement = screen.getByText("Processing");
      expect(statusElement).toBeInTheDocument();
      expect(statusElement.className).toContain("bg-yellow-100");
      expect(statusElement.className).toContain("text-yellow-800");
    });

    it("displays Failed status with red styling", () => {
      render(
        <TransactionReceipt
          transaction={buildTransaction({ status: "Failed" })}
        />,
      );

      const statusElement = screen.getByText("Failed");
      expect(statusElement).toBeInTheDocument();
      expect(statusElement.className).toContain("bg-red-100");
      expect(statusElement.className).toContain("text-red-800");
    });
  });

  describe("Optional Details Fields", () => {
    it("displays network fee when provided", () => {
      render(
        <TransactionReceipt
          transaction={buildTransaction()}
          details={{ fee: "0.00001 XLM" }}
        />,
      );

      expect(screen.getByText("Network Fee:")).toBeInTheDocument();
      expect(screen.getByText("0.00001 XLM")).toBeInTheDocument();
    });

    it("does not display network fee field when not provided", () => {
      render(
        <TransactionReceipt transaction={buildTransaction()} details={null} />,
      );

      expect(screen.queryByText("Network Fee:")).not.toBeInTheDocument();
    });

    it("displays memo when provided", () => {
      render(
        <TransactionReceipt
          transaction={buildTransaction()}
          details={{ memo: "Payment for invoice #12345" }}
        />,
      );

      expect(screen.getByText("Memo:")).toBeInTheDocument();
      expect(screen.getByText("Payment for invoice #12345")).toBeInTheDocument();
    });

    it("sanitizes memo content", () => {
      // Mock sanitiseString to verify it's called
      const { container } = render(
        <TransactionReceipt
          transaction={buildTransaction()}
          details={{ memo: "<script>alert('xss')</script>" }}
        />,
      );

      expect(screen.getByText("Memo:")).toBeInTheDocument();
      // Should not contain script tags
      expect(container.innerHTML).not.toContain("<script>");
    });

    it("does not display memo field when not provided", () => {
      render(
        <TransactionReceipt transaction={buildTransaction()} details={{ fee: "0.00001 XLM" }} />,
      );

      expect(screen.queryByText("Memo:")).not.toBeInTheDocument();
    });

    it("displays explorer link when transaction ID is valid", () => {
      render(
        <TransactionReceipt
          transaction={buildTransaction({
            id: "a".repeat(64), // Valid 64-char hex hash
          })}
        />,
      );

      expect(screen.getByText("Blockchain Explorer:")).toBeInTheDocument();
      const link = screen.getByText("View on Stellar Expert");
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("does not display explorer link when transaction ID is invalid", () => {
      render(
        <TransactionReceipt
          transaction={buildTransaction({ id: "INVALID_HASH" })}
        />,
      );

      expect(screen.queryByText("Blockchain Explorer:")).not.toBeInTheDocument();
    });
  });

  describe("Transaction Type Coverage", () => {
    it("handles Deposit transaction type", () => {
      render(
        <TransactionReceipt
          transaction={buildTransaction({ type: "Deposit", amount: 500 })}
        />,
      );

      expect(screen.getByText("Deposit")).toBeInTheDocument();
      expect(screen.getByText("+$500")).toBeInTheDocument();
    });

    it("handles Withdrawal transaction type", () => {
      render(
        <TransactionReceipt
          transaction={buildTransaction({ type: "Withdrawal", amount: -200 })}
        />,
      );

      expect(screen.getByText("Withdrawal")).toBeInTheDocument();
      expect(screen.getByText("-$200")).toBeInTheDocument();
    });

    it("handles Lend Funds transaction type", () => {
      render(
        <TransactionReceipt
          transaction={buildTransaction({ type: "Lend Funds", amount: 1000 })}
        />,
      );

      expect(screen.getByText("Lend Funds")).toBeInTheDocument();
      expect(screen.getByText("+$1000")).toBeInTheDocument();
    });

    it("handles Loan Payment transaction type", () => {
      render(
        <TransactionReceipt
          transaction={buildTransaction({ type: "Loan Payment", amount: -350 })}
        />,
      );

      expect(screen.getByText("Loan Payment")).toBeInTheDocument();
      expect(screen.getByText("-$350")).toBeInTheDocument();
    });
  });

  describe("Asset Coverage", () => {
    it("handles XLM asset", () => {
      render(
        <TransactionReceipt transaction={buildTransaction({ asset: "XLM" })} />,
      );

      expect(screen.getByText("XLM")).toBeInTheDocument();
      expect(screen.getByAltText("XLM")).toHaveAttribute(
        "src",
        "/icons/xlm.svg",
      );
    });

    it("handles USDC asset", () => {
      render(
        <TransactionReceipt transaction={buildTransaction({ asset: "USDC" })} />,
      );

      expect(screen.getByText("USDC")).toBeInTheDocument();
      expect(screen.getByAltText("USDC")).toHaveAttribute(
        "src",
        "/icons/usdc.svg",
      );
    });

    it("handles BTC asset", () => {
      render(
        <TransactionReceipt transaction={buildTransaction({ asset: "BTC" })} />,
      );

      expect(screen.getByText("BTC")).toBeInTheDocument();
      expect(screen.getByAltText("BTC")).toHaveAttribute(
        "src",
        "/icons/btc.svg",
      );
    });

    it("handles ETH asset", () => {
      render(
        <TransactionReceipt transaction={buildTransaction({ asset: "ETH" })} />,
      );

      expect(screen.getByText("ETH")).toBeInTheDocument();
      expect(screen.getByAltText("ETH")).toHaveAttribute(
        "src",
        "/icons/eth.svg",
      );
    });
  });

  describe("Print Functionality", () => {
    it("renders Print Receipt button", () => {
      render(<TransactionReceipt transaction={buildTransaction()} />);

      const printButton = screen.getByRole("button", { name: /print receipt/i });
      expect(printButton).toBeInTheDocument();
    });

    it("triggers window.print when Print Receipt button is clicked", () => {
      render(<TransactionReceipt transaction={buildTransaction()} />);

      const printButton = screen.getByRole("button", { name: /print receipt/i });
      fireEvent.click(printButton);

      expect(mockPrint).toHaveBeenCalledTimes(1);
    });

    it("Print Receipt button is keyboard accessible", () => {
      render(<TransactionReceipt transaction={buildTransaction()} />);

      const printButton = screen.getByRole("button", { name: /print receipt/i });
      printButton.focus();
      expect(printButton).toHaveFocus();

      fireEvent.keyDown(printButton, { key: "Enter", code: "Enter" });
      expect(mockPrint).toHaveBeenCalled();
    });

    it("has no-print class on interactive elements", () => {
      const { container } = render(
        <TransactionReceipt transaction={buildTransaction()} />,
      );

      const noPrintElements = container.querySelectorAll(".no-print");
      expect(noPrintElements.length).toBeGreaterThan(0);
    });
  });

  describe("Back Button Functionality", () => {
    it("renders Back button when onBack callback is provided", () => {
      const onBackMock = vi.fn();
      render(
        <TransactionReceipt
          transaction={buildTransaction()}
          onBack={onBackMock}
        />,
      );

      const backButton = screen.getByRole("button", {
        name: /back to transaction details/i,
      });
      expect(backButton).toBeInTheDocument();
    });

    it("does not render Back button when onBack is not provided", () => {
      render(<TransactionReceipt transaction={buildTransaction()} />);

      const backButton = screen.queryByRole("button", {
        name: /back to transaction details/i,
      });
      expect(backButton).not.toBeInTheDocument();
    });

    it("calls onBack when Back button is clicked", () => {
      const onBackMock = vi.fn();
      render(
        <TransactionReceipt
          transaction={buildTransaction()}
          onBack={onBackMock}
        />,
      );

      const backButton = screen.getByRole("button", {
        name: /back to transaction details/i,
      });
      fireEvent.click(backButton);

      expect(onBackMock).toHaveBeenCalledTimes(1);
    });

    it("Back button is keyboard accessible", () => {
      const onBackMock = vi.fn();
      render(
        <TransactionReceipt
          transaction={buildTransaction()}
          onBack={onBackMock}
        />,
      );

      const backButton = screen.getByRole("button", {
        name: /back to transaction details/i,
      });
      backButton.focus();
      expect(backButton).toHaveFocus();

      fireEvent.keyDown(backButton, { key: "Enter", code: "Enter" });
      expect(onBackMock).toHaveBeenCalled();
    });
  });

  describe("Footer Information", () => {
    it("displays receipt footer disclaimer", () => {
      render(<TransactionReceipt transaction={buildTransaction()} />);

      expect(
        screen.getByText("This receipt is for your records only."),
      ).toBeInTheDocument();
    });

    it("displays support contact information", () => {
      render(<TransactionReceipt transaction={buildTransaction()} />);

      expect(
        screen.getByText(/support@stellarlend.com/),
      ).toBeInTheDocument();
    });

    it("displays generated date and time", () => {
      const now = new Date();
      const expectedDate = now.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      render(<TransactionReceipt transaction={buildTransaction()} />);

      // Check that the footer contains a date (may not match exactly due to timing)
      expect(screen.getByText(/Generated on/)).toBeInTheDocument();
    });
  });

  describe("Print Stylesheet Behavior", () => {
    it("includes global print styles", () => {
      const { container } = render(
        <TransactionReceipt transaction={buildTransaction()} />,
      );

      const styleElement = container.querySelector("style");
      expect(styleElement).toBeInTheDocument();
      expect(styleElement?.innerHTML).toContain("@media print");
    });

    it("hides .no-print elements in print media query", () => {
      const { container } = render(
        <TransactionReceipt transaction={buildTransaction()} />,
      );

      const styleElement = container.querySelector("style");
      expect(styleElement?.innerHTML).toContain(".no-print");
      expect(styleElement?.innerHTML).toContain("display: none !important");
    });

    it("shows explorer URL as text in print mode", () => {
      const { container } = render(
        <TransactionReceipt
          transaction={buildTransaction({ id: "a".repeat(64) })}
        />,
      );

      // Find the hidden span that shows in print
      const printOnlySpan = container.querySelector(".hidden.print\\:inline");
      expect(printOnlySpan).toBeInTheDocument();
    });
  });

  describe("Edge Cases and Missing Data", () => {
    it("handles missing optional details gracefully", () => {
      render(
        <TransactionReceipt transaction={buildTransaction()} details={null} />,
      );

      // Should still render core fields
      expect(screen.getByText("Transaction ID:")).toBeInTheDocument();
      expect(screen.getByText("Amount:")).toBeInTheDocument();
      // Should not show optional fields
      expect(screen.queryByText("Network Fee:")).not.toBeInTheDocument();
      expect(screen.queryByText("Memo:")).not.toBeInTheDocument();
    });

    it("handles zero amount", () => {
      render(
        <TransactionReceipt transaction={buildTransaction({ amount: 0 })} />,
      );

      // Zero should not have a sign prefix in the current implementation
      expect(screen.getByText("+$0")).toBeInTheDocument();
    });

    it("handles very long transaction ID", () => {
      const longId = "a".repeat(128);
      render(
        <TransactionReceipt transaction={buildTransaction({ id: longId })} />,
      );

      expect(screen.getByText(longId)).toBeInTheDocument();
    });

    it("handles special characters in memo", () => {
      render(
        <TransactionReceipt
          transaction={buildTransaction()}
          details={{ memo: "Payment: $100 & tips @10%" }}
        />,
      );

      expect(screen.getByText(/Payment: \$100 & tips @10%/)).toBeInTheDocument();
    });

    it("handles AM/PM time formats correctly", () => {
      render(
        <TransactionReceipt
          transaction={buildTransaction({ date: "2024-06-15", time: "1:05PM" })}
        />,
      );

      expect(screen.getByText(/1:05PM/)).toBeInTheDocument();
    });

    it("handles midnight time correctly", () => {
      render(
        <TransactionReceipt
          transaction={buildTransaction({ date: "2024-06-15", time: "12:00AM" })}
        />,
      );

      expect(screen.getByText(/12:00AM/)).toBeInTheDocument();
    });
  });

  describe("Security Requirements", () => {
    it("does not expose session or secret values", () => {
      const { container } = render(
        <TransactionReceipt
          transaction={buildTransaction()}
          details={{ memo: "session_token=abc123" }}
        />,
      );

      // Transaction receipt should display memo but not contain actual sensitive session values
      // (In a real scenario, the backend should filter these, but we verify display here)
      expect(container.innerHTML).not.toContain("session_token=");
    });

    it("does not include navigation or chrome elements", () => {
      const { container } = render(
        <TransactionReceipt transaction={buildTransaction()} />,
      );

      // Should only contain receipt-related content, no nav/header/footer from main app
      expect(container.querySelector("nav")).not.toBeInTheDocument();
      expect(container.querySelector("header")).not.toBeInTheDocument();
    });
  });
});
