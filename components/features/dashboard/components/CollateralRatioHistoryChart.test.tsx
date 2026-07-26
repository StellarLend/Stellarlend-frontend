import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CollateralRatioHistoryChart from "./CollateralRatioHistoryChart";

const fetchMock = vi.fn();
let reducedMotion = false;

vi.stubGlobal("fetch", fetchMock);

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => reducedMotion,
}));

function historyResponse(snapshots: unknown[]) {
  return {
    ok: true,
    json: async () => ({
      walletAddress: "wallet-1",
      snapshots,
      interval: "1d",
      bucketCount: snapshots.length,
    }),
  } as Response;
}

describe("CollateralRatioHistoryChart", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    reducedMotion = false;
  });

  it("shows a loading state while history is being fetched", () => {
    fetchMock.mockImplementation(() => new Promise(() => undefined));

    render(<CollateralRatioHistoryChart />);

    expect(
      screen.getByRole("status", { name: /loading collateral ratio history/i }),
    ).toBeInTheDocument();
  });

  it("shows an empty state when no valid ratio points exist", async () => {
    fetchMock.mockResolvedValueOnce(historyResponse([]));

    render(<CollateralRatioHistoryChart />);

    expect(
      await screen.findByText(/No collateral ratio history available/i),
    ).toBeInTheDocument();
  });

  it("renders a populated collateral ratio series with the liquidation threshold", async () => {
    fetchMock.mockResolvedValueOnce(
      historyResponse([
        {
          timestamp: Date.UTC(2026, 0, 1),
          supplied: 3_000,
          borrowed: 1_000,
          effectiveSupplyApy: 4,
          effectiveBorrowApy: 7,
        },
        {
          timestamp: Date.UTC(2026, 0, 2),
          supplied: 2_000,
          borrowed: 1_000,
          effectiveSupplyApy: 4,
          effectiveBorrowApy: 7,
        },
      ]),
    );

    render(<CollateralRatioHistoryChart />);

    expect(
      await screen.findByRole("img", { name: /latest ratio 2\.00x/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Threshold reference: 1.00x")).toBeInTheDocument();
    expect(screen.getByText("Latest ratio")).toBeInTheDocument();
  });

  it("renders a single valid snapshot without breaking the chart", async () => {
    fetchMock.mockResolvedValueOnce(
      historyResponse([
        {
          timestamp: Date.UTC(2026, 0, 1),
          supplied: 1_500,
          borrowed: 1_000,
          effectiveSupplyApy: 3,
          effectiveBorrowApy: 6,
        },
      ]),
    );

    render(<CollateralRatioHistoryChart />);

    expect(await screen.findByText("1.50x")).toBeInTheDocument();
  });

  it("flags the latest ratio when it crosses the liquidation threshold", async () => {
    fetchMock.mockResolvedValueOnce(
      historyResponse([
        {
          timestamp: Date.UTC(2026, 0, 1),
          supplied: 1_200,
          borrowed: 1_000,
          effectiveSupplyApy: 3,
          effectiveBorrowApy: 6,
        },
        {
          timestamp: Date.UTC(2026, 0, 2),
          supplied: 900,
          borrowed: 1_000,
          effectiveSupplyApy: 3,
          effectiveBorrowApy: 6,
        },
      ]),
    );

    render(<CollateralRatioHistoryChart />);

    expect(await screen.findByText("0.90x")).toBeInTheDocument();
    expect(screen.getByText("At liquidation threshold")).toBeInTheDocument();
  });

  it("ignores snapshots missing usable collateral or debt values", async () => {
    fetchMock.mockResolvedValueOnce(
      historyResponse([
        {
          timestamp: Date.UTC(2026, 0, 1),
          supplied: 0,
          borrowed: 1_000,
          effectiveSupplyApy: 3,
          effectiveBorrowApy: 6,
        },
        {
          timestamp: Date.UTC(2026, 0, 2),
          supplied: 2_400,
          borrowed: 1_200,
          effectiveSupplyApy: 3,
          effectiveBorrowApy: 6,
        },
      ]),
    );

    render(<CollateralRatioHistoryChart />);

    expect(await screen.findByText("2.00x")).toBeInTheDocument();
  });

  it("shows an error state when the history request fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    render(<CollateralRatioHistoryChart />);

    expect(
      await screen.findByText(/Collateral ratio history unavailable/i),
    ).toBeInTheDocument();
  });

  it("disables inline svg transitions when reduced motion is requested", async () => {
    reducedMotion = true;
    fetchMock.mockResolvedValueOnce(
      historyResponse([
        {
          timestamp: Date.UTC(2026, 0, 1),
          supplied: 2_000,
          borrowed: 1_000,
          effectiveSupplyApy: 3,
          effectiveBorrowApy: 6,
        },
      ]),
    );

    render(<CollateralRatioHistoryChart />);

    expect(
      await screen.findByRole("img", {
        name: /collateral ratio history chart/i,
      }),
    ).toHaveStyle({
      transition: "none",
    });
  });
});
