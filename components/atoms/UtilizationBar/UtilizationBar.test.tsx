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
        markets: [{ asset: "XLM", utilization: 0 }],
      }),
    } as Response);

    render(<UtilizationBar asset="XLM" />);

    await waitFor(() => {
      expect(screen.getByText("0.0%")).toBeInTheDocument();
    });
  });

  it("renders utilization bar with clamped values when > 100", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        markets: [{ asset: "XLM", utilization: 150 }],
      }),
    } as Response);

    render(<UtilizationBar asset="XLM" />);

    await waitFor(() => {
      expect(screen.getByText("100.0%")).toBeInTheDocument();
    });
  });

  it("renders utilization bar correctly for valid percentage", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        markets: [{ asset: "XLM", utilization: 45.6 }],
      }),
    } as Response);

    render(<UtilizationBar asset="XLM" />);

    await waitFor(() => {
      expect(screen.getByText("45.6%")).toBeInTheDocument();
    });
  });

  it("degrades gracefully when market entry is missing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ markets: [] }),
    } as Response);

    render(<UtilizationBar asset="XLM" />);

    await waitFor(() => {
      expect(screen.getByTestId("utilization-missing-XLM")).toBeInTheDocument();
      expect(screen.getByText("N/A")).toBeInTheDocument();
    });
  });

  it("shares one markets request across multiple instances", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        markets: [
          { asset: "XLM", utilization: 45.6 },
          { asset: "USDC", utilization: 72.3 },
        ],
      }),
    } as Response);

    render(
      <>
        <UtilizationBar asset="XLM" />
        <UtilizationBar asset="USDC" />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByText("45.6%")).toBeInTheDocument();
      expect(screen.getByText("72.3%")).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/markets");
  });
});
