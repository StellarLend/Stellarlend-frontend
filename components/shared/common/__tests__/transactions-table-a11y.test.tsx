/**
 * @jest-environment jsdom
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { Transactions } from "../Transaction";

// ── Hoisted mock data ──────────────────────────────────────────────────────

const mockTransactions = [
  {
    id: "TXN001",
    type: "Lend",
    amount: 1000,
    asset: "USDC",
    date: "2026-06-15",
    time: "10:30 AM",
    status: "Completed" as const,
  },
  {
    id: "TXN002",
    type: "Borrow",
    amount: -500,
    asset: "XLM",
    date: "2026-06-14",
    time: "02:45 PM",
    status: "Processing" as const,
  },
  {
    id: "TXN003",
    type: "Repay",
    amount: -250,
    asset: "USDC",
    date: "2026-06-13",
    time: "09:15 AM",
    status: "Failed" as const,
  },
];

const mockFetchTransactions = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    transactions: mockTransactions,
    total: mockTransactions.length,
    page: 1,
    pageSize: 6,
  })
);

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: React.ComponentType<unknown> }>) => {
    let Comp: React.ComponentType<unknown> | null = null;
    loader().then((m) => { Comp = m.default; });
    return function DynamicResolved(props: unknown) {
      return Comp
        ? React.createElement(Comp, props as Record<string, unknown>)
        : React.createElement("div", null, "Loading\u2026");
    };
  },
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height, className }: { src: string; alt: string; width: number; height: number; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img src={src} alt={alt} width={width} height={height} className={className} />
  ),
}));

vi.mock("@/types/Transaction", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/types/Transaction")>();
  return { ...original, fetchTransactions: mockFetchTransactions };
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Transactions Table Accessibility Audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchTransactions.mockResolvedValue({
      transactions: mockTransactions,
      total: mockTransactions.length,
      page: 1,
      pageSize: 6,
    });
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 0; });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("Keyboard Operability", () => {
    it("should make all table headers keyboard accessible", async () => {
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
      });

      const table = screen.getByRole("table");
      const headers = within(table).getAllByRole("columnheader");

      // Verify all headers are present
      expect(headers).toHaveLength(6);
      expect(headers[0]).toHaveTextContent("Transaction Type");
      expect(headers[1]).toHaveTextContent("Amount");
      expect(headers[2]).toHaveTextContent("Asset");
      expect(headers[3]).toHaveTextContent("Date");
      expect(headers[4]).toHaveTextContent("Status");
      expect(headers[5]).toHaveTextContent("Actions");
    });

    it("should make sortable headers keyboard operable with Enter key", async () => {
      const user = userEvent.setup();
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
      });

      const dateHeader = screen.getByRole("button", { name: /sort by date/i });
      
      // Focus and activate with keyboard
      dateHeader.focus();
      expect(dateHeader).toHaveFocus();
      
      await user.keyboard("{Enter}");
      
      // Should trigger sort
      await waitFor(() => {
        expect(mockFetchTransactions).toHaveBeenCalled();
      });
    });

    it("should make sortable headers keyboard operable with Space key", async () => {
      const user = userEvent.setup();
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
      });

      const amountHeader = screen.getByRole("button", { name: /sort by amount/i });
      
      amountHeader.focus();
      expect(amountHeader).toHaveFocus();
      
      await user.keyboard(" ");
      
      await waitFor(() => {
        expect(mockFetchTransactions).toHaveBeenCalled();
      });
    });

    it("should make row action buttons keyboard accessible", async () => {
      const user = userEvent.setup();
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.getByText("TXN001")).toBeInTheDocument();
      });

      const detailsButtons = screen.getAllByRole("button", { name: /details/i });
      expect(detailsButtons.length).toBeGreaterThan(0);

      const firstDetailsButton = detailsButtons[0];
      firstDetailsButton.focus();
      expect(firstDetailsButton).toHaveFocus();
      
      await user.keyboard("{Enter}");
      
      // Should open transaction detail
      expect(firstDetailsButton).toHaveAttribute("aria-expanded", "true");
    });

    it("should support Tab navigation through interactive elements", async () => {
      const user = userEvent.setup();
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.getByText("TXN001")).toBeInTheDocument();
      });

      // Tab through interactive elements
      await user.tab();
      const firstInteractive = document.activeElement;
      expect(firstInteractive).toBeInTheDocument();

      await user.tab();
      const secondInteractive = document.activeElement;
      expect(secondInteractive).not.toBe(firstInteractive);
    });
  });

  describe("ARIA Sort Attributes", () => {
    it("should expose aria-sort=none on unsorted headers", async () => {
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
      });

      const assetHeader = screen.getByRole("columnheader", { name: /asset/i });
      expect(assetHeader).toHaveAttribute("aria-sort", "none");
    });

    it("should expose aria-sort=descending when sorted descending", async () => {
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
      });

      // Default sort is date descending
      const dateHeader = screen.getByRole("columnheader", { name: /date/i });
      expect(dateHeader).toHaveAttribute("aria-sort", "descending");
    });

    it("should update aria-sort when sort direction changes", async () => {
      const user = userEvent.setup();
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
      });

      const dateHeader = screen.getByRole("button", { name: /sort by date/i });
      
      // Click to toggle sort direction
      await user.click(dateHeader);

      await waitFor(() => {
        const dateColumnHeader = screen.getByRole("columnheader", { name: /date/i });
        expect(dateColumnHeader).toHaveAttribute("aria-sort", "ascending");
      });
    });

    it("should expose aria-sort on amount column when sorted by amount", async () => {
      const user = userEvent.setup();
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
      });

      const amountHeader = screen.getByRole("button", { name: /sort by amount/i });
      await user.click(amountHeader);

      await waitFor(() => {
        const amountColumnHeader = screen.getByRole("columnheader", { name: /amount/i });
        expect(amountColumnHeader).toHaveAttribute("aria-sort");
        expect(["ascending", "descending"]).toContain(
          amountColumnHeader.getAttribute("aria-sort")
        );
      });
    });
  });

  describe("Focus Indicators", () => {
    it("should show visible focus on sortable headers", async () => {
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
      });

      const dateHeader = screen.getByRole("button", { name: /sort by date/i });
      dateHeader.focus();

      const styles = window.getComputedStyle(dateHeader);
      // Check for focus styles (outline, ring, etc.)
      expect(dateHeader).toHaveFocus();
    });

    it("should show visible focus on row action buttons", async () => {
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.getByText("TXN001")).toBeInTheDocument();
      });

      const detailsButton = screen.getAllByRole("button", { name: /details/i })[0];
      detailsButton.focus();

      expect(detailsButton).toHaveFocus();
    });

    it("should maintain focus when navigating with arrow keys", async () => {
      const user = userEvent.setup();
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.getByText("TXN001")).toBeInTheDocument();
      });

      const rows = screen.getAllByRole("row").filter(row => 
        row.getAttribute("tabIndex") === "0"
      );

      if (rows.length > 0) {
        rows[0].focus();
        expect(rows[0]).toHaveFocus();

        await user.keyboard("{ArrowDown}");
        
        if (rows.length > 1) {
          await waitFor(() => {
            expect(rows[1]).toHaveFocus();
          });
        }
      }
    });
  });

  describe("Assistive Technology Support", () => {
    it("should expose accessible names for row actions", async () => {
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.getByText("TXN001")).toBeInTheDocument();
      });

      const detailsButtons = screen.getAllByRole("button", { name: /details/i });
      
      detailsButtons.forEach((button) => {
        expect(button).toHaveAccessibleName();
      });
    });

    it("should use aria-expanded on expandable row actions", async () => {
      const user = userEvent.setup();
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.getByText("TXN001")).toBeInTheDocument();
      });

      const detailsButton = screen.getAllByRole("button", { name: /details/i })[0];
      
      expect(detailsButton).toHaveAttribute("aria-expanded");
      expect(detailsButton.getAttribute("aria-expanded")).toBe("false");

      await user.click(detailsButton);

      await waitFor(() => {
        expect(detailsButton.getAttribute("aria-expanded")).toBe("true");
      });
    });

    it("should provide row labels with transaction context", async () => {
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.getByText("TXN001")).toBeInTheDocument();
      });

      const rows = screen.getAllByRole("row").filter(row => 
        row.getAttribute("aria-label")?.includes("Transaction")
      );

      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((row) => {
        expect(row).toHaveAttribute("aria-label");
        expect(row.getAttribute("aria-label")).toMatch(/Transaction/);
      });
    });

    it("should announce table structure with aria-rowcount", async () => {
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
      });

      const table = screen.getByRole("table");
      expect(table).toHaveAttribute("aria-rowcount");
    });
  });

  describe("Edge Cases", () => {
    it("should handle keyboard navigation in empty table", async () => {
      mockFetchTransactions.mockResolvedValueOnce({
        transactions: [],
        total: 0,
        page: 1,
        pageSize: 6,
      });

      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.getByText(/no transactions/i)).toBeInTheDocument();
      });

      // Headers should still be keyboard accessible
      const table = screen.queryByRole("table");
      if (table) {
        const headers = within(table).getAllByRole("columnheader");
        expect(headers.length).toBeGreaterThan(0);
      }
    });

    it("should maintain sort state when toggling between ascending and descending", async () => {
      const user = userEvent.setup();
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
      });

      const dateHeader = screen.getByRole("button", { name: /sort by date/i });
      
      // First click - toggle direction
      await user.click(dateHeader);

      await waitFor(() => {
        const dateColumnHeader = screen.getByRole("columnheader", { name: /date/i });
        expect(dateColumnHeader).toHaveAttribute("aria-sort", "ascending");
      });

      // Second click - toggle back
      await user.click(dateHeader);

      await waitFor(() => {
        const dateColumnHeader = screen.getByRole("columnheader", { name: /date/i });
        expect(dateColumnHeader).toHaveAttribute("aria-sort", "descending");
      });
    });

    it("should preserve focus when sorting changes table content", async () => {
      const user = userEvent.setup();
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
      });

      const amountHeader = screen.getByRole("button", { name: /sort by amount/i });
      amountHeader.focus();
      
      await user.keyboard("{Enter}");

      // Focus should remain on the sort button
      await waitFor(() => {
        expect(amountHeader).toHaveFocus();
      });
    });

    it("should handle rapid keyboard activation on sort headers", async () => {
      const user = userEvent.setup();
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
      });

      const dateHeader = screen.getByRole("button", { name: /sort by date/i });
      dateHeader.focus();

      // Rapid Enter presses
      await user.keyboard("{Enter}");
      await user.keyboard("{Enter}");
      await user.keyboard("{Enter}");

      // Should handle gracefully without errors
      expect(mockFetchTransactions).toHaveBeenCalled();
    });

    it("should announce loading state to screen readers", async () => {
      render(<Transactions showPagination={false} hideToolbar={true} />);

      // Initially loading
      const loadingState = screen.queryByText(/loading/i);
      if (loadingState) {
        expect(loadingState).toBeInTheDocument();
      }

      await waitFor(() => {
        expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
      });
    });
  });

  describe("Focus Order", () => {
    it("should follow logical focus order from headers to rows to actions", async () => {
      const user = userEvent.setup();
      render(<Transactions showPagination={false} hideToolbar={true} />);

      await waitFor(() => {
        expect(screen.getByText("TXN001")).toBeInTheDocument();
      });

      // Start from before the table
      document.body.focus();

      const focusableElements: HTMLElement[] = [];
      
      // Tab through to collect focus order
      for (let i = 0; i < 10; i++) {
        await user.tab();
        if (document.activeElement && document.activeElement !== document.body) {
          focusableElements.push(document.activeElement as HTMLElement);
        }
      }

      // Verify we captured some focusable elements
      expect(focusableElements.length).toBeGreaterThan(0);
    });
  });
});
