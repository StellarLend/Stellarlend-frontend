import React from "react";
import { render, screen, fireEvent, waitFor } from "@/test/test-utils";
import { NetWorthTrend } from "./NetWorthTrend";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/hooks/usePositionHistory", () => ({
  usePositionHistory: vi.fn(),
}));

import { usePositionHistory } from "@/hooks/usePositionHistory";

const mockUsePositionHistory = vi.mocked(usePositionHistory);

describe("NetWorthTrend Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading state correctly", () => {
    mockUsePositionHistory.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<NetWorthTrend />);

    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Net worth trend"
    );
  });

  it("renders error state correctly", () => {
    mockUsePositionHistory.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Failed to fetch"),
      refetch: vi.fn(),
    });

    render(<NetWorthTrend />);

    expect(
      screen.getByText("Failed to load net worth trend. Please try again later.")
    ).toBeInTheDocument();
  });

  it("renders empty state when history is empty", () => {
    mockUsePositionHistory.mockReturnValue({
      data: { snapshots: [], window: "7d" as const },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<NetWorthTrend />);

    expect(screen.getByText("Net Worth Trend")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No historical portfolio data available yet. Your trend will appear once snapshots have been recorded."
      )
    ).toBeInTheDocument();
  });

  it("renders single snapshot with informative message", () => {
    const now = Date.now();
    mockUsePositionHistory.mockReturnValue({
      data: {
        snapshots: [{ timestamp: now, netWorth: 5000 }],
        window: "7d" as const,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<NetWorthTrend />);

    expect(screen.getByText("Net Worth Trend")).toBeInTheDocument();
    expect(screen.getByText("$5,000.00")).toBeInTheDocument();
    expect(
      screen.getByText("Single snapshot — trend will appear after more data")
    ).toBeInTheDocument();
  });

  it("renders positive trend correctly (latest > first)", async () => {
    const now = Date.now();
    const older = now - 7 * 24 * 60 * 60 * 1000;

    mockUsePositionHistory.mockReturnValue({
      data: {
        snapshots: [
          { timestamp: older, netWorth: 4000 },
          { timestamp: now, netWorth: 5000 },
        ],
        window: "7d" as const,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<NetWorthTrend />);

    expect(screen.getByText("$5,000.00")).toBeInTheDocument();
    expect(screen.getByText("+$1,000.00")).toBeInTheDocument();
    expect(screen.getByText("+25.0%")).toBeInTheDocument();
  });

  it("renders negative trend correctly (latest < first)", async () => {
    const now = Date.now();
    const older = now - 7 * 24 * 60 * 60 * 1000;

    mockUsePositionHistory.mockReturnValue({
      data: {
        snapshots: [
          { timestamp: older, netWorth: 5000 },
          { timestamp: now, netWorth: 4500 },
        ],
        window: "7d" as const,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<NetWorthTrend />);

    expect(screen.getByText("$4,500.00")).toBeInTheDocument();
    expect(screen.getByText("-$500.00")).toBeInTheDocument();
    expect(screen.getByText("-10.0%")).toBeInTheDocument();
  });

  it("renders flat trend correctly (latest == first)", async () => {
    const now = Date.now();
    const older = now - 7 * 24 * 60 * 60 * 1000;

    mockUsePositionHistory.mockReturnValue({
      data: {
        snapshots: [
          { timestamp: older, netWorth: 5000 },
          { timestamp: now, netWorth: 5000 },
        ],
        window: "7d" as const,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<NetWorthTrend />);

    expect(screen.getByText("$5,000.00")).toBeInTheDocument();
    expect(screen.getByText("0.0%")).toBeInTheDocument();
  });

  it("handles division-by-zero when first snapshot netWorth is zero", async () => {
    const now = Date.now();
    const older = now - 7 * 24 * 60 * 60 * 1000;

    mockUsePositionHistory.mockReturnValue({
      data: {
        snapshots: [
          { timestamp: older, netWorth: 0 },
          { timestamp: now, netWorth: 1000 },
        ],
        window: "7d" as const,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<NetWorthTrend />);

    expect(screen.getByText("$1,000.00")).toBeInTheDocument();
    expect(screen.getByText("+$1,000.00")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("window selector changes values correctly", async () => {
    const now = Date.now();

    mockUsePositionHistory.mockReturnValue({
      data: {
        snapshots: [{ timestamp: now, netWorth: 5000 }],
        window: "7d" as const,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<NetWorthTrend />);

    const windowButtons = screen.getAllByRole("button");
    const sevenDayButton = windowButtons.find((btn) => btn.textContent === "7d");
    const twentyFourButton = windowButtons.find((btn) => btn.textContent === "24h");

    expect(sevenDayButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(twentyFourButton!);

    await waitFor(() => {
      expect(mockUsePositionHistory).toHaveBeenCalledWith("24h");
    });
  });

  it("applies correct colors for positive trend", () => {
    const now = Date.now();
    const older = now - 7 * 24 * 60 * 60 * 1000;

    mockUsePositionHistory.mockReturnValue({
      data: {
        snapshots: [
          { timestamp: older, netWorth: 4000 },
          { timestamp: now, netWorth: 5000 },
        ],
        window: "7d" as const,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<NetWorthTrend />);

    const trendContainer = screen.getByLabelText(
      /Change: \+.*\$1,000.00/
    ).closest("span");
    expect(trendContainer).toHaveClass("text-[#097C4C]");
  });

  it("applies correct colors for negative trend", () => {
    const now = Date.now();
    const older = now - 7 * 24 * 60 * 60 * 1000;

    mockUsePositionHistory.mockReturnValue({
      data: {
        snapshots: [
          { timestamp: older, netWorth: 5000 },
          { timestamp: now, netWorth: 4500 },
        ],
        window: "7d" as const,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<NetWorthTrend />);

    const trendContainer = screen.getByLabelText(
      /Change: -.*\$500.00/
    ).closest("span");
    expect(trendContainer).toHaveClass("text-red-400");
  });

  it("applies correct colors for flat trend", () => {
    const now = Date.now();
    const older = now - 7 * 24 * 60 * 60 * 1000;

    mockUsePositionHistory.mockReturnValue({
      data: {
        snapshots: [
          { timestamp: older, netWorth: 5000 },
          { timestamp: now, netWorth: 5000 },
        ],
        window: "7d" as const,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<NetWorthTrend />);

    const trendContainer = screen.getByLabelText(/Change:.*0%/).closest("span");
    expect(trendContainer).toHaveClass("text-[#AAABAB]");
  });

  it("invokes onWindowChange callback when window changes", async () => {
    const now = Date.now();
    mockUsePositionHistory.mockReturnValue({
      data: {
        snapshots: [{ timestamp: now, netWorth: 5000 }],
        window: "7d" as const,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const onWindowChange = vi.fn();
    render(<NetWorthTrend onWindowChange={onWindowChange} />);

    const twentyFourButton = screen.getByRole("button", { name: "Select 24h time window" });
    fireEvent.click(twentyFourButton);

    await waitFor(() => {
      expect(onWindowChange).toHaveBeenCalledWith("24h");
    });
  });

  it("renders retry button on error and calls refetch when clicked", async () => {
    const refetch = vi.fn();
    mockUsePositionHistory.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Failed to fetch"),
      refetch,
    });

    render(<NetWorthTrend />);

    const retryButton = screen.getByRole("button", { name: /retry|try again/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  it("renders permission error message when error indicates insufficient permissions", () => {
    mockUsePositionHistory.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("You do not have permission to view net worth trend"),
      refetch: vi.fn(),
    });

    render(<NetWorthTrend />);

    expect(
      screen.getByText(
        "You do not have permission to view net worth trend."
      )
    ).toBeInTheDocument();
  });

  it("makes window selector buttons focusable", () => {
    const now = Date.now();
    mockUsePositionHistory.mockReturnValue({
      data: {
        snapshots: [{ timestamp: now, netWorth: 5000 }],
        window: "7d" as const,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<NetWorthTrend />);

    const sevenDayButton = screen.getByRole("button", { name: /7d/ });
    expect(sevenDayButton).toHaveAttribute("aria-pressed", "true");
    sevenDayButton.focus();
    expect(sevenDayButton).toHaveFocus();
  });
});