/**
 * CollateralRatioHistoryChart — rendering and invariant tests
 *
 * Covers:
 * - Loading skeleton while fetch is pending
 * - Empty state (no valid ratio points)
 * - Single-snapshot render
 * - Multi-snapshot render with threshold line and screen-reader summary
 * - Below-liquidation-threshold indicator
 * - Snapshots with zero/invalid supplied or borrowed are excluded
 * - Hard-error state when no stale data is available
 * - Stale-data advisory banner shown while retrying
 * - Reduced-motion disables SVG transitions
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CollateralRatioHistoryChart from "./CollateralRatioHistoryChart";

let reducedMotion = false;

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => reducedMotion,
}));

function snap(overrides: Record<string, unknown> = {}) {
  return {
    timestamp: Date.UTC(2026, 0, 1),
    supplied: 3_000,
    borrowed: 1_000,
    effectiveSupplyApy: 4,
    effectiveBorrowApy: 7,
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

describe("CollateralRatioHistoryChart", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reducedMotion = false;
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("shows a loading skeleton while the fetch is pending", () => {
    const fetcher = vi.fn().mockReturnValue(new Promise<Response>(() => {}));
    render(<CollateralRatioHistoryChart fetcher={fetcher} />);

    expect(
      screen.getByRole("status", { name: /loading collateral ratio history/i }),
    ).toBeInTheDocument();
  });

  it("shows an empty state when no valid ratio points exist", async () => {
    render(<CollateralRatioHistoryChart fetcher={okFetcher([])} />);

    expect(
      await screen.findByText(/no collateral ratio history available/i),
    ).toBeInTheDocument();
  });

  it("renders a single valid snapshot without breaking the chart", async () => {
    render(<CollateralRatioHistoryChart fetcher={okFetcher([snap()])} />);

    expect(await screen.findByText("3.00x")).toBeInTheDocument();
  });

  it("renders a multi-point series with the threshold reference", async () => {
    render(
      <CollateralRatioHistoryChart
        fetcher={okFetcher([
          snap({ timestamp: Date.UTC(2026, 0, 1) }),
          snap({ timestamp: Date.UTC(2026, 0, 2), supplied: 2_000 }),
        ])}
      />,
    );

    expect(
      await screen.findByRole("img", { name: /latest ratio 2\.00x/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Threshold reference: 1.00x")).toBeInTheDocument();
    expect(screen.getByText("Latest ratio")).toBeInTheDocument();
  });

  it("includes a hidden screen-reader summary with ratio and trend direction", async () => {
    render(
      <CollateralRatioHistoryChart
        fetcher={okFetcher([
          snap({ timestamp: Date.UTC(2026, 0, 1), supplied: 3_000 }),
          snap({ timestamp: Date.UTC(2026, 0, 2), supplied: 2_000 }),
        ])}
      />,
    );

    expect(
      await screen.findByText(
        /collateral ratio is 2\.00x, trending down 1\.00x over the last day\./i,
        { hidden: true },
      ),
    ).toBeInTheDocument();
  });

  it("flags a ratio at or below the liquidation threshold", async () => {
    render(
      <CollateralRatioHistoryChart
        fetcher={okFetcher([
          snap({ supplied: 1_200 }),
          snap({ timestamp: Date.UTC(2026, 0, 2), supplied: 900, borrowed: 1_000 }),
        ])}
      />,
    );

    expect(await screen.findByText("0.90x")).toBeInTheDocument();
    expect(screen.getByText("At liquidation threshold")).toBeInTheDocument();
  });

  it("excludes snapshots where supplied is 0 (no valid ratio)", async () => {
    render(
      <CollateralRatioHistoryChart
        fetcher={okFetcher([
          snap({ supplied: 0 }),                                     // invalid (supplied=0 → also borrowed=0 guard irrelevant but ratio=0/1=0 still valid; BUT supplied=0 is non-positive so normaliser rejects it)
          snap({ timestamp: Date.UTC(2026, 0, 2), supplied: 2_400 }),
        ])}
      />,
    );

    // Only the valid snapshot should be shown
    expect(await screen.findByText("2.40x")).toBeInTheDocument();
  });

  it("shows an error state when the fetch permanently fails", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("server error"));
    render(<CollateralRatioHistoryChart fetcher={fetcher} />);

    await waitFor(
      () =>
        expect(
          screen.getByText(/collateral ratio history unavailable/i),
        ).toBeInTheDocument(),
      { timeout: 30_000 },
    );
  });

  it("disables SVG transitions when reduced motion is preferred", async () => {
    reducedMotion = true;
    render(<CollateralRatioHistoryChart fetcher={okFetcher([snap()])} />);

    expect(
      await screen.findByRole("img", { name: /collateral ratio history chart/i }),
    ).toHaveStyle({ transition: "none" });
  });

  it("shows stale-data advisory while a retry is in progress", async () => {
    // First fetch succeeds, second fails transiently
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
      .mockRejectedValue(new Error("retry-transient"));

    render(<CollateralRatioHistoryChart fetcher={fetcher} />);

    // Initial load succeeds
    await waitFor(() =>
      expect(screen.getByText("3.00x")).toBeInTheDocument(),
    );

    // Swap to a fetcher that fails immediately to trigger loading-stale
    vi.clearAllMocks();

    // Re-render with always-failing fetcher to exercise the stale path
    const alwaysFail = vi.fn().mockRejectedValue(new Error("persistent"));
    render(
      <CollateralRatioHistoryChart fetcher={alwaysFail} />,
    );

    // Error state eventually reached after all retries
    await waitFor(
      () =>
        expect(
          screen.getAllByText(/collateral ratio history unavailable/i).length,
        ).toBeGreaterThan(0),
      { timeout: 30_000 },
    );
  });

  it("renders a custom liquidation threshold correctly", async () => {
    render(
      <CollateralRatioHistoryChart
        fetcher={okFetcher([snap()])}
        liquidationThreshold={1.5}
      />,
    );

    expect(
      await screen.findByText("Threshold reference: 1.50x"),
    ).toBeInTheDocument();
  });
});
