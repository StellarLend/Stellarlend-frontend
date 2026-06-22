import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import PositionHistoryChart from "./PositionHistoryChart";

const snapshots = [
  {
    timestamp: Date.UTC(2026, 0, 1),
    supplied: 5000,
    borrowed: 1500,
    effectiveSupplyApy: 3.25,
    effectiveBorrowApy: 8.5,
  },
  {
    timestamp: Date.UTC(2026, 0, 2),
    supplied: 5200,
    borrowed: 1200,
    effectiveSupplyApy: 3.5,
    effectiveBorrowApy: 8.25,
  },
];

describe("PositionHistoryChart", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ snapshots, interval: "1d", bucketCount: snapshots.length }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches history and renders a chart plus accessible table fallback", async () => {
    render(<PositionHistoryChart />);

    expect(screen.getByLabelText(/loading position history/i)).toBeInTheDocument();

    expect(await screen.findByRole("img", { name: /supplied and borrowed balances/i })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /position history data/i })).toBeInTheDocument();
    expect(screen.getByText("5,000")).toBeInTheDocument();
    expect(screen.getByText("8.50%")).toBeInTheDocument();
  });

  it("refetches when interval changes", async () => {
    const user = userEvent.setup();
    render(<PositionHistoryChart />);

    await screen.findByRole("table", { name: /position history data/i });
    await user.selectOptions(screen.getByLabelText(/interval/i), "7d");

    await waitFor(() => {
      expect(fetch).toHaveBeenLastCalledWith(
        expect.stringContaining("interval=7d"),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  it("shows an empty state when no snapshots are returned", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ snapshots: [], interval: "1d", bucketCount: 0 }),
    } as Response);

    render(<PositionHistoryChart />);

    expect(await screen.findByText(/No position history snapshots/i)).toBeInTheDocument();
  });

  it("validates the 365-day maximum range before fetching", async () => {
    const user = userEvent.setup();
    render(<PositionHistoryChart />);

    await screen.findByRole("table", { name: /position history data/i });
    await user.clear(screen.getByLabelText(/from/i));
    await user.type(screen.getByLabelText(/from/i), "2024-01-01");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Date range cannot exceed 365 days.",
    );
  });
});
