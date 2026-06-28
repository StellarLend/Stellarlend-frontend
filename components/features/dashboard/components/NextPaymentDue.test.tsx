import React from "react";
import { render, screen } from "@/test/test-utils";
import { NextPaymentDue } from "./NextPaymentDue";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BorrowPosition } from "@/hooks/usePositions";

// Mock the usePositions hook to return defaults, tests will override via props
vi.mock("@/hooks/usePositions", () => ({
  usePositions: () => ({
    positions: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

describe("NextPaymentDue Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set system time to June 27, 2026
    vi.setSystemTime(new Date("2026-06-27T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders loading state correctly", () => {
    render(<NextPaymentDue isLoading={true} />);

    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Loading next payment due"
    );
  });

  it("renders error state correctly", () => {
    render(<NextPaymentDue error={new Error("Failed to fetch")} />);

    expect(
      screen.getByText("Failed to load next payment due reminder.")
    ).toBeInTheDocument();
  });

  it("renders empty state when there are no borrow positions", () => {
    render(<NextPaymentDue positions={[]} />);

    expect(screen.getByText("Next Payment Due")).toBeInTheDocument();
    expect(
      screen.getByText("No upcoming payments. All borrow positions are up to date.")
    ).toBeInTheDocument();
  });

  it("renders empty state when there are positions but none have due dates", () => {
    const mockPositions: BorrowPosition[] = [
      { id: "1", asset: "USDC", amount: 500 },
      { id: "2", asset: "XLM", amount: 1000 },
    ];

    render(<NextPaymentDue positions={mockPositions} />);

    expect(
      screen.getByText("No upcoming payments. All borrow positions are up to date.")
    ).toBeInTheDocument();
  });

  it("computes and renders soonest nextDue from multiple positions", () => {
    const mockPositions: BorrowPosition[] = [
      {
        id: "1",
        asset: "XLM",
        amount: 1500,
        nextDue: "$250.00 in 4 days", // due on Jul 1, 2026
      },
      {
        id: "2",
        asset: "BTC",
        amount: 0.05,
        nextDue: "due in 2 days", // due on Jun 29, 2026 (soonest)
      },
      {
        id: "3",
        asset: "USDC",
        amount: 500, // no nextDue
      },
    ];

    render(<NextPaymentDue positions={mockPositions} />);

    expect(screen.getByText("Next Payment Due")).toBeInTheDocument();
    expect(screen.getByText("Due Soon")).toBeInTheDocument();

    // BTC is soonest due (in 2 days)
    // The amount should fall back to position amount 0.05 since no amount is in the nextDue string
    expect(screen.getByText("0.05 BTC")).toBeInTheDocument();
    expect(screen.getByText("BTC")).toBeInTheDocument();
    expect(screen.getByText("Jun 29, 2026")).toBeInTheDocument();
    expect(screen.getByText("in 2 days")).toBeInTheDocument();
  });

  it("renders overdue positions with correct warning/critical severity and negative countdown", () => {
    const mockPositions: BorrowPosition[] = [
      {
        id: "1",
        asset: "USDC",
        amount: 100,
        nextDue: "$100.00 overdue by 3 days", // due Jun 24, 2026
      },
      {
        id: "2",
        asset: "XLM",
        amount: 1000,
        nextDue: "in 2 days",
      },
    ];

    render(<NextPaymentDue positions={mockPositions} />);

    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("100.00 USDC")).toBeInTheDocument();
    expect(screen.getByText("Jun 24, 2026")).toBeInTheDocument();
    expect(screen.getByText("overdue by 3 days")).toBeInTheDocument();
  });

  it("renders same-day due positions with correct countdown and severity", () => {
    const mockPositions: BorrowPosition[] = [
      {
        id: "1",
        asset: "ETH",
        amount: 1,
        nextDue: "due today",
      },
    ];

    render(<NextPaymentDue positions={mockPositions} />);

    expect(screen.getByText("Due Today")).toBeInTheDocument();
    expect(screen.getByText("1.00 ETH")).toBeInTheDocument();
    expect(screen.getByText("Jun 27, 2026")).toBeInTheDocument();
    expect(screen.getByText("due today")).toBeInTheDocument();
  });

  it("parses absolute date strings correctly", () => {
    const mockPositions: BorrowPosition[] = [
      {
        id: "1",
        asset: "USDC",
        amount: 300,
        nextDue: "$50.00 due on 2026-06-30", // in 3 days
      },
    ];

    render(<NextPaymentDue positions={mockPositions} />);

    expect(screen.getByText("Due Soon")).toBeInTheDocument();
    expect(screen.getByText("50.00 USDC")).toBeInTheDocument();
    expect(screen.getByText("Jun 30, 2026")).toBeInTheDocument();
    expect(screen.getByText("in 3 days")).toBeInTheDocument();
  });
});
