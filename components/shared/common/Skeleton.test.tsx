import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  Skeleton,
  TransactionRowSkeleton,
  TransactionCardSkeleton,
  TransactionsSkeleton,
} from "./Skeleton";

describe("Skeleton", () => {
  it("renders a div with role=status and aria attributes", () => {
    render(<Skeleton className="h-4 w-32" />);
    const el = screen.getByRole("status");
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute("aria-label", "Loading");
    expect(el).toHaveAttribute("aria-busy", "true");
  });

  it("applies custom className", () => {
    render(<Skeleton className="h-10 w-10 rounded-full" data-testid="sk" />);
    const el = screen.getByTestId("sk");
    expect(el.className).toContain("h-10");
    expect(el.className).toContain("rounded-full");
  });

  it("includes animate-pulse and motion-reduce:animate-none", () => {
    render(<Skeleton data-testid="sk" />);
    const el = screen.getByTestId("sk");
    expect(el.className).toContain("animate-pulse");
    expect(el.className).toContain("motion-reduce:animate-none");
  });

  it("passes through arbitrary HTML attributes", () => {
    render(<Skeleton data-testid="passthrough" style={{ width: 80 }} />);
    expect(screen.getByTestId("passthrough")).toHaveStyle({ width: "80px" });
  });
});

describe("TransactionRowSkeleton", () => {
  it("renders a table row with aria-hidden", () => {
    render(
      <table>
        <tbody>
          <TransactionRowSkeleton />
        </tbody>
      </table>
    );
    const row = document.querySelector("tr");
    expect(row).toBeInTheDocument();
    expect(row).toHaveAttribute("aria-hidden", "true");
  });

  it("renders 5 cells matching table columns", () => {
    render(
      <table>
        <tbody>
          <TransactionRowSkeleton />
        </tbody>
      </table>
    );
    const cells = document.querySelectorAll("td");
    expect(cells).toHaveLength(5);
  });

  it("applies decreasing opacity based on index", () => {
    const { container } = render(
      <table>
        <tbody>
          <TransactionRowSkeleton index={2} />
        </tbody>
      </table>
    );
    const row = container.querySelector("tr") as HTMLElement;
    expect(row.style.opacity).toBe("0.8");
  });
});

describe("TransactionCardSkeleton", () => {
  it("renders a div with aria-hidden", () => {
    const { container } = render(<TransactionCardSkeleton />);
    const card = container.firstChild as HTMLElement;
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute("aria-hidden", "true");
  });

  it("applies decreasing opacity based on index", () => {
    const { container } = render(<TransactionCardSkeleton index={3} />);
    const card = container.firstChild as HTMLElement;
    expect(card.style.opacity).toBe("0.7");
  });
});

describe("TransactionsSkeleton", () => {
  it("renders the desktop table with column headers", () => {
    render(<TransactionsSkeleton count={3} />);
    expect(screen.getByText("Transaction Type")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Asset")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders `count` skeleton rows in the desktop table", () => {
    render(<TransactionsSkeleton count={4} />);
    // Each row has 5 <td> elements
    const cells = document.querySelectorAll("td");
    expect(cells).toHaveLength(4 * 5);
  });

  it("defaults to 6 rows", () => {
    render(<TransactionsSkeleton />);
    const cells = document.querySelectorAll("td");
    expect(cells).toHaveLength(6 * 5);
  });

  it("renders mobile card skeletons equal to count", () => {
    render(<TransactionsSkeleton count={3} />);
    // Mobile cards: each TransactionCardSkeleton is a direct child div of the md:hidden container
    // There should be 3 aria-hidden divs (cards)
    const hiddenDivs = document.querySelectorAll("[aria-hidden='true']");
    // 3 row-level tr (aria-hidden) + 3 card-level div (aria-hidden)
    expect(hiddenDivs).toHaveLength(3 + 3);
  });

  it("has aria-label on the desktop container", () => {
    render(<TransactionsSkeleton count={1} />);
    const container = screen.getByLabelText("Loading transactions");
    expect(container).toBeInTheDocument();
  });

  it("marks the desktop table as aria-busy", () => {
    render(<TransactionsSkeleton count={1} />);
    const table = document.querySelector("table");
    expect(table).toHaveAttribute("aria-busy", "true");
  });
});
