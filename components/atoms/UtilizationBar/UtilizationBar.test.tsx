import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateMarketsCache } from "@/hooks/useMarkets";
import { UtilizationBar } from "./UtilizationBar";

describe("UtilizationBar", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    invalidateMarketsCache();
    vi.unstubAllGlobals();
  });

  it("shows loading state initially", () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    render(<UtilizationBar asset="XLM" />);
    expect(screen.getByTestId("utilization-loading-XLM")).toBeInTheDocument();
  });

  it("renders utilization bar with clamped values when 0", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        markets: [
          {
            asset: "XLM",
            utilization: 0,
            borrowApr: 0,
            supplyApr: 0,
            totalSupply: 0,
            totalBorrow: 0,
          },
        ],
        timestamp: "2026-06-29T12:00:00.000Z",
        source: "test",
      }),
    });

    render(<UtilizationBar asset="XLM" />);

    await waitFor(() => {
      expect(screen.getByText("0.0%")).toBeInTheDocument();
    });
  });

  it("renders utilization bar with clamped values when > 100", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        markets: [
          {
            asset: "XLM",
            utilization: 150,
            borrowApr: 0,
            supplyApr: 0,
            totalSupply: 0,
            totalBorrow: 0,
          },
        ],
        timestamp: "2026-06-29T12:00:00.000Z",
        source: "test",
      }),
    });

    render(<UtilizationBar asset="XLM" />);

    await waitFor(() => {
      expect(screen.getByText("100.0%")).toBeInTheDocument();
    });
  });

  it("renders utilization bar correctly for valid percentage", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        markets: [
          {
            asset: "XLM",
            utilization: 45.6,
            borrowApr: 0,
            supplyApr: 0,
            totalSupply: 0,
            totalBorrow: 0,
          },
        ],
        timestamp: "2026-06-29T12:00:00.000Z",
        source: "test",
      }),
    });

    render(<UtilizationBar asset="XLM" />);

    await waitFor(() => {
      expect(screen.getByText("45.6%")).toBeInTheDocument();
    });
  });

  it("degrades gracefully when market entry is missing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        markets: [],
        timestamp: "2026-06-29T12:00:00.000Z",
        source: "test",
      }),
    });

    render(<UtilizationBar asset="XLM" />);

    await waitFor(() => {
      expect(screen.getByTestId("utilization-missing-XLM")).toBeInTheDocument();
      expect(screen.getByText("N/A")).toBeInTheDocument();
    });
  });

  it("shares a single markets request across concurrent utilization bars", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        markets: [
          {
            asset: "XLM",
            utilization: 45.6,
            borrowApr: 0,
            supplyApr: 0,
            totalSupply: 0,
            totalBorrow: 0,
          },
          {
            asset: "USDC",
            utilization: 91.2,
            borrowApr: 0,
            supplyApr: 0,
            totalSupply: 0,
            totalBorrow: 0,
          },
        ],
        timestamp: "2026-06-29T12:00:00.000Z",
        source: "test",
      }),
    });

    render(
      <>
        <UtilizationBar asset="XLM" />
        <UtilizationBar asset="USDC" />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByText("45.6%")).toBeInTheDocument();
      expect(screen.getByText("91.2%")).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
