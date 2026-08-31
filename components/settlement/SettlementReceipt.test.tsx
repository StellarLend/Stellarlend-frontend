import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import SettlementReceipt from "./SettlementReceipt";
import { COMMITMENT_BOUNDS } from "../../types/commitment";

// Mock fetch globally
const globalFetch = vi.fn();
global.fetch = globalFetch;

describe("SettlementReceipt", () => {
  const mockCommitmentId = "commit-123";
  const mockTelemetry = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    globalFetch.mockReset();
    mockTelemetry.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders loading state initially and then success state", async () => {
    globalFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        commitment: {
          id: mockCommitmentId,
          status: "active",
          amount: 100,
          asset: "USDC",
          collateralAmount: 200,
          collateralAsset: "XLM",
        },
      }),
    });

    render(
      <SettlementReceipt
        commitmentId={mockCommitmentId}
        onTelemetry={mockTelemetry}
      />
    );

    expect(screen.getByText("Loading receipt...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Settlement Receipt")).toBeInTheDocument();
    });

    expect(screen.getByText("active")).toBeInTheDocument();
    expect(mockTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ type: "api_latency" })
    );
  });

  it("handles errors gracefully", async () => {
    globalFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    render(
      <SettlementReceipt
        commitmentId={mockCommitmentId}
        onTelemetry={mockTelemetry}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Error Loading Receipt")).toBeInTheDocument();
    });
    
    expect(mockTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ type: "polling_error" })
    );
  });

  it("polls with exponential backoff if status is pending and stops at max retries", async () => {
    const pendingResponse = {
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        commitment: { id: mockCommitmentId, status: "pending" },
      }),
    };

    globalFetch.mockResolvedValue(pendingResponse);

    render(
      <SettlementReceipt
        commitmentId={mockCommitmentId}
        onTelemetry={mockTelemetry}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("pending")).toBeInTheDocument();
    });

    expect(mockTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ type: "polling_started" })
    );

    // Initial fetch is done. Next fetch should be scheduled in POLLING_INITIAL_INTERVAL_MS.
    let delay = COMMITMENT_BOUNDS.POLLING_INITIAL_INTERVAL_MS;

    for (let i = 0; i < COMMITMENT_BOUNDS.POLLING_MAX_RETRIES; i++) {
      await act(async () => {
        vi.advanceTimersByTime(delay);
      });
      delay = Math.min(
        COMMITMENT_BOUNDS.POLLING_INITIAL_INTERVAL_MS * Math.pow(COMMITMENT_BOUNDS.POLLING_BACKOFF_MULTIPLIER, i + 1),
        COMMITMENT_BOUNDS.POLLING_MAX_INTERVAL_MS
      );
    }

    // After MAX_RETRIES, polling should stop.
    expect(globalFetch).toHaveBeenCalledTimes(COMMITMENT_BOUNDS.POLLING_MAX_RETRIES + 1);

    expect(mockTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ type: "polling_stopped" })
    );
  });

  it("stops polling when status changes from pending to active", async () => {
    const pendingResponse = {
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        commitment: { id: mockCommitmentId, status: "pending" },
      }),
    };
    const activeResponse = {
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        commitment: { id: mockCommitmentId, status: "active" },
      }),
    };

    globalFetch.mockResolvedValueOnce(pendingResponse).mockResolvedValueOnce(activeResponse);

    render(
      <SettlementReceipt
        commitmentId={mockCommitmentId}
        onTelemetry={mockTelemetry}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("pending")).toBeInTheDocument();
    });

    await act(async () => {
      vi.advanceTimersByTime(COMMITMENT_BOUNDS.POLLING_INITIAL_INTERVAL_MS);
    });

    await waitFor(() => {
      expect(screen.getByText("active")).toBeInTheDocument();
    });

    expect(mockTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ type: "polling_stopped" })
    );
  });
});
