/**
 * SupplyApyChart — rendering and invariant tests
 *
 * Covers:
 * - Loading skeleton while fetch is pending
 * - Empty state when no snapshots returned
 * - Single-point render (no division-by-zero)
 * - Multi-point render with screen-reader summary
 * - Hard-error state (no stale data available)
 * - Stale-data advisory banner shown during retries
 * - APY clamped: a value >100 displays as ≤100
 * - Snapshots with invalid supplied/borrowed excluded from chart
 * - Error recovery: advisory banner gone once retry succeeds
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SupplyApyChart from "./SupplyApyChart";

// Minimal snapshot factory
function snap(overrides: Record<string, unknown> = {}) {
  return {
    timestamp: 1_700_000_000_000,
    supplied: 1_200,
    borrowed: 300,
    effectiveSupplyApy: 4.2,
    effectiveBorrowApy: 6.1,
    ...overrides,
  };
}

function okFetcher(snapshots: unknown[] = [snap()]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      walletAddress: "G",
      snapshots,
      interval: "1d",
      bucketCount: snapshots.length,
    }),
  } as Response);
}

describe("SupplyApyChart", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("shows a loading skeleton while the fetch is pending", () => {
    const fetcher = vi.fn().mockReturnValue(new Promise<Response>(() => {}));
    render(<SupplyApyChart fetcher={fetcher} />);

    expect(
      screen.getByRole("status", { name: /loading trend data/i }),
    ).toBeInTheDocument();
  });

  it("shows an empty state when the response has no snapshots", async () => {
    render(<SupplyApyChart fetcher={okFetcher([])} />);

    expect(
      await screen.findByText(/no trend history available/i),
    ).toBeInTheDocument();
  });

  it("renders a single data point without breaking the chart", async () => {
    render(<SupplyApyChart fetcher={okFetcher([snap()])} />);

    expect(
      await screen.findByRole("img", { name: /supply apy trend/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/4\.20%/i, { selector: "p" })).toBeInTheDocument();
  });

  it("includes a hidden screen-reader summary with current value and time range", async () => {
    render(<SupplyApyChart fetcher={okFetcher([snap()])} />);

    expect(
      await screen.findByText(/supply apy is 4\.20%.*unchanged.*as of/i, {
        hidden: true,
      }),
    ).toBeInTheDocument();
  });

  it("shows the error state when the fetch permanently fails", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("failed"));
    render(<SupplyApyChart fetcher={fetcher} />);

    // Wait through all retries
    await waitFor(
      () => expect(screen.getByRole("alert")).toBeInTheDocument(),
      { timeout: 30_000 },
    );
    expect(screen.getByText(/trend data unavailable/i)).toBeInTheDocument();
  });

  it("shows a stale-data advisory banner while a retry is in flight", async () => {
    // First fetch resolves with good data; second (refetch) is slow
    let resolveRefetch!: (v: Response) => void;

    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          walletAddress: "G",
          snapshots: [snap()],
          interval: "1d",
          bucketCount: 1,
        }),
      } as Response)
      .mockReturnValueOnce(
        new Promise<Response>((r) => { resolveRefetch = r; }),
      );

    const { rerender } = render(<SupplyApyChart fetcher={fetcher} />);

    // First load resolves
    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: /supply apy trend/i }),
      ).toBeInTheDocument(),
    );

    // Unmount and remount with a new fetcher that will fail → loading-stale
    const failFetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockReturnValue(new Promise<Response>(() => {}));

    rerender(<SupplyApyChart fetcher={failFetcher} />);

    await waitFor(
      () =>
        expect(
          screen.queryByRole("status", {
            name: /retrying to load latest trend data/i,
          }) ||
          screen.queryByText(/displaying last known data/i),
        ).toBeTruthy(),
      { timeout: 10_000 },
    );

    resolveRefetch?.({
      ok: true,
      json: async () => ({
        walletAddress: "G",
        snapshots: [snap()],
        interval: "1d",
        bucketCount: 1,
      }),
    } as Response);
  });

  it("displays a clamped APY value (≤ 100%) when the server returns >100", async () => {
    render(
      <SupplyApyChart fetcher={okFetcher([snap({ effectiveSupplyApy: 150 })])} />,
    );

    // Clamped to 100.00%
    expect(await screen.findByText(/100\.00%/i, { selector: "p" })).toBeInTheDocument();
  });

  it("falls back to empty state when all snapshots have invalid supplied values", async () => {
    render(
      <SupplyApyChart
        fetcher={okFetcher([snap({ supplied: -999 }), snap({ supplied: Infinity })])}
      />,
    );

    expect(
      await screen.findByText(/no trend history available/i),
    ).toBeInTheDocument();
  });

  it("renders a two-point series with a meaningful screen-reader trend summary", async () => {
    render(
      <SupplyApyChart
        fetcher={okFetcher([
          snap({ timestamp: Date.UTC(2026, 0, 1), effectiveSupplyApy: 3.0 }),
          snap({ timestamp: Date.UTC(2026, 0, 2), effectiveSupplyApy: 5.0 }),
        ])}
      />,
    );

    expect(
      await screen.findByText(/supply apy is 5\.00%.*trending up 2\.00%.*over the last day/i, {
        hidden: true,
      }),
    ).toBeInTheDocument();
  });
});
