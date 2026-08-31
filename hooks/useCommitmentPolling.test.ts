/**
 * Tests for useCommitmentPolling hook
 * Covers success, failure, boundary, retry, circuit breaker, and cleanup behavior
 */

import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useCommitmentPolling } from "./useCommitmentPolling";
import type { Commitment, CommitmentDetailResponse, TelemetryEvent } from "@/types/commitment";
import { COMMITMENT_BOUNDS } from "@/types/commitment";

// Mock fetch
global.fetch = vi.fn();

const mockCommitment: Commitment = {
  id: "test-commitment-123",
  status: "active",
  borrower: "GBTEST",
  lender: "GCTEST",
  asset: "XLM",
  amount: 1000,
  interestRate: 10,
  duration: 30,
  collateralAsset: "USDC",
  collateralAmount: 1500,
  fundedAmount: 1000,
  outstandingDebt: 1008.33,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockResponse: CommitmentDetailResponse = {
  commitment: mockCommitment,
  canPerformActions: {
    fund: { allowed: false, reason: "Already funded" },
    dispute: { allowed: true },
    early_exit: { allowed: true },
    settle: { allowed: true },
  },
};

describe("useCommitmentPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe("Success paths", () => {
    it("should fetch commitment data on mount", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() =>
        useCommitmentPolling({ commitmentId: "test-123", enabled: true }),
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.commitment).toBeNull();

      await waitFor(() => {
        expect(result.current.commitment).not.toBeNull();
      });

      expect(result.current.commitment?.id).toBe(mockCommitment.id);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/commitments/test-123",
        expect.objectContaining({
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    it("should poll at configured interval", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      renderHook(() => useCommitmentPolling({ commitmentId: "test-123" }));

      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

      // Advance by initial polling interval
      vi.advanceTimersByTime(COMMITMENT_BOUNDS.POLLING_INITIAL_INTERVAL_MS);

      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    });

    it("should emit telemetry events", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const onTelemetry = vi.fn();

      renderHook(() =>
        useCommitmentPolling({
          commitmentId: "test-123",
          onTelemetry,
        }),
      );

      await waitFor(() => {
        expect(onTelemetry).toHaveBeenCalled();
      });

      const events = onTelemetry.mock.calls.map((call) => call[0]);
      expect(events.some((e: TelemetryEvent) => e.type === "polling_started")).toBe(true);
      expect(events.some((e: TelemetryEvent) => e.type === "api_latency")).toBe(true);
    });

    it("should detect state transitions", async () => {
      const onTelemetry = vi.fn();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { rerender } = renderHook(() =>
        useCommitmentPolling({
          commitmentId: "test-123",
          onTelemetry,
        }),
      );

      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

      // Mock status change
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockResponse,
          commitment: { ...mockCommitment, status: "settled" },
        }),
      });

      vi.advanceTimersByTime(COMMITMENT_BOUNDS.POLLING_INITIAL_INTERVAL_MS);

      await waitFor(() => {
        const events = onTelemetry.mock.calls.map((call) => call[0]);
        expect(events.some((e: TelemetryEvent) => e.type === "state_transition")).toBe(true);
      });
    });
  });

  describe("Failure handling", () => {
    it("should handle network errors", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() =>
        useCommitmentPolling({ commitmentId: "test-123" }),
      );

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error?.message).toBe("Network error");
      expect(result.current.commitment).toBeNull();
    });

    it("should handle HTTP errors", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const { result } = renderHook(() =>
        useCommitmentPolling({ commitmentId: "test-123" }),
      );

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error?.message).toContain("500");
    });

    it("should handle rate limiting", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });

      const { result } = renderHook(() =>
        useCommitmentPolling({ commitmentId: "test-123" }),
      );

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error?.message).toBe("Rate limited");
    });

    it("should sanitize error messages to remove secrets", async () => {
      const secretHash = "a".repeat(64);
      (global.fetch as any).mockRejectedValueOnce(
        new Error(`Transaction ${secretHash} failed`),
      );

      const { result } = renderHook(() =>
        useCommitmentPolling({ commitmentId: "test-123" }),
      );

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error?.message).not.toContain(secretHash);
      expect(result.current.error?.message).toContain("[REDACTED]");
    });
  });

  describe("Exponential backoff and retry", () => {
    it("should implement exponential backoff on failures", async () => {
      (global.fetch as any)
        .mockRejectedValueOnce(new Error("Fail 1"))
        .mockRejectedValueOnce(new Error("Fail 2"))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

      const onTelemetry = vi.fn();

      renderHook(() =>
        useCommitmentPolling({
          commitmentId: "test-123",
          onTelemetry,
        }),
      );

      // First failure
      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

      // Should wait longer after failure (exponential backoff)
      const initialInterval = COMMITMENT_BOUNDS.POLLING_INITIAL_INTERVAL_MS;
      const backoffInterval = Math.min(
        initialInterval * COMMITMENT_BOUNDS.POLLING_BACKOFF_MULTIPLIER,
        COMMITMENT_BOUNDS.POLLING_MAX_INTERVAL_MS,
      );

      vi.advanceTimersByTime(backoffInterval);

      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    });

    it("should stop polling after max retries", async () => {
      (global.fetch as any).mockRejectedValue(new Error("Persistent failure"));

      const onTelemetry = vi.fn();

      renderHook(() =>
        useCommitmentPolling({
          commitmentId: "test-123",
          onTelemetry,
        }),
      );

      // Simulate max retries
      for (let i = 0; i < COMMITMENT_BOUNDS.POLLING_MAX_RETRIES + 1; i++) {
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        vi.advanceTimersByTime(COMMITMENT_BOUNDS.POLLING_MAX_INTERVAL_MS);
      }

      const events = onTelemetry.mock.calls.map((call) => call[0]);
      const stoppedEvent = events.find(
        (e: TelemetryEvent) =>
          e.type === "polling_stopped" && e.metadata?.reason === "max_retries_exceeded",
      );
      expect(stoppedEvent).toBeDefined();
    });

    it("should cap backoff at max interval", async () => {
      (global.fetch as any).mockRejectedValue(new Error("Error"));

      renderHook(() => useCommitmentPolling({ commitmentId: "test-123" }));

      // Simulate multiple failures to reach max backoff
      for (let i = 0; i < 5; i++) {
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        vi.advanceTimersByTime(COMMITMENT_BOUNDS.POLLING_MAX_INTERVAL_MS);
      }

      // Should not exceed max interval
      const callCount = (global.fetch as any).mock.calls.length;
      vi.advanceTimersByTime(COMMITMENT_BOUNDS.POLLING_MAX_INTERVAL_MS * 2);

      // Should have made one more call (not two)
      await waitFor(() => {
        const newCallCount = (global.fetch as any).mock.calls.length;
        expect(newCallCount).toBeLessThanOrEqual(callCount + 1);
      });
    });
  });

  describe("Circuit breaker", () => {
    it("should open circuit breaker after threshold failures", async () => {
      (global.fetch as any).mockRejectedValue(new Error("Failure"));

      const onTelemetry = vi.fn();

      renderHook(() =>
        useCommitmentPolling({
          commitmentId: "test-123",
          onTelemetry,
        }),
      );

      // Trigger failures up to threshold
      for (let i = 0; i < COMMITMENT_BOUNDS.CIRCUIT_BREAKER_THRESHOLD; i++) {
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        vi.advanceTimersByTime(COMMITMENT_BOUNDS.POLLING_MAX_INTERVAL_MS);
      }

      const events = onTelemetry.mock.calls.map((call) => call[0]);
      const circuitOpenEvent = events.find(
        (e: TelemetryEvent) => e.type === "circuit_breaker_opened",
      );
      expect(circuitOpenEvent).toBeDefined();
    });

    it("should close circuit breaker after reset timeout", async () => {
      (global.fetch as any)
        .mockRejectedValue(new Error("Failure"))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

      const onTelemetry = vi.fn();

      renderHook(() =>
        useCommitmentPolling({
          commitmentId: "test-123",
          onTelemetry,
        }),
      );

      // Open circuit breaker
      for (let i = 0; i < COMMITMENT_BOUNDS.CIRCUIT_BREAKER_THRESHOLD; i++) {
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        vi.advanceTimersByTime(COMMITMENT_BOUNDS.POLLING_MAX_INTERVAL_MS);
      }

      // Wait for reset timeout
      vi.advanceTimersByTime(COMMITMENT_BOUNDS.CIRCUIT_BREAKER_RESET_MS);

      // Next request should succeed and close circuit
      vi.advanceTimersByTime(COMMITMENT_BOUNDS.POLLING_MAX_INTERVAL_MS);

      await waitFor(() => {
        const events = onTelemetry.mock.calls.map((call) => call[0]);
        const circuitClosedEvents = events.filter(
          (e: TelemetryEvent) => e.type === "circuit_breaker_closed",
        );
        expect(circuitClosedEvents.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Concurrent request limiting", () => {
    it("should enforce max concurrent requests", async () => {
      let resolveFirst: any;
      const firstRequest = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      (global.fetch as any).mockReturnValueOnce(firstRequest);

      const onTelemetry = vi.fn();

      renderHook(() =>
        useCommitmentPolling({
          commitmentId: "test-123",
          onTelemetry,
        }),
      );

      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

      // Try to trigger another request while first is pending
      vi.advanceTimersByTime(COMMITMENT_BOUNDS.POLLING_INITIAL_INTERVAL_MS);

      // Should not make another request (concurrent limit)
      expect(global.fetch).toHaveBeenCalledTimes(1);

      resolveFirst({
        ok: true,
        json: async () => mockResponse,
      });
    });
  });

  describe("Timeout handling", () => {
    it("should timeout requests after configured duration", async () => {
      const slowFetch = new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: async () => mockResponse,
          });
        }, COMMITMENT_BOUNDS.REQUEST_TIMEOUT_MS + 1000);
      });

      (global.fetch as any).mockReturnValueOnce(slowFetch);

      const { result } = renderHook(() =>
        useCommitmentPolling({ commitmentId: "test-123" }),
      );

      // Advance past timeout
      vi.advanceTimersByTime(COMMITMENT_BOUNDS.REQUEST_TIMEOUT_MS);

      // Should not error on timeout (aborted requests are ignored)
      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe("Cleanup and lifecycle", () => {
    it("should stop polling when disabled", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const { rerender } = renderHook(
        ({ enabled }) => useCommitmentPolling({ commitmentId: "test-123", enabled }),
        { initialProps: { enabled: true } },
      );

      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

      // Disable polling
      rerender({ enabled: false });

      const callCount = (global.fetch as any).mock.calls.length;

      // Advance time
      vi.advanceTimersByTime(COMMITMENT_BOUNDS.POLLING_INITIAL_INTERVAL_MS * 3);

      // Should not make more requests
      expect(global.fetch).toHaveBeenCalledTimes(callCount);
    });

    it("should cleanup on unmount", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const onTelemetry = vi.fn();

      const { unmount } = renderHook(() =>
        useCommitmentPolling({
          commitmentId: "test-123",
          onTelemetry,
        }),
      );

      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

      unmount();

      const events = onTelemetry.mock.calls.map((call) => call[0]);
      const stoppedEvent = events.find((e: TelemetryEvent) => e.type === "polling_stopped");
      expect(stoppedEvent).toBeDefined();
    });

    it("should cancel in-flight requests on unmount", async () => {
      let abortSignal: AbortSignal | undefined;

      (global.fetch as any).mockImplementation((_url: string, options: RequestInit) => {
        abortSignal = options.signal;
        return new Promise(() => {}); // Never resolves
      });

      const { unmount } = renderHook(() =>
        useCommitmentPolling({ commitmentId: "test-123" }),
      );

      await waitFor(() => expect(global.fetch).toHaveBeenCalled());

      expect(abortSignal?.aborted).toBe(false);

      unmount();

      // Signal should be aborted
      expect(abortSignal?.aborted).toBe(true);
    });
  });

  describe("Manual controls", () => {
    it("should support manual refetch", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() =>
        useCommitmentPolling({ commitmentId: "test-123" }),
      );

      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

      // Manual refetch
      await result.current.refetch();

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should support manual stop/start", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() =>
        useCommitmentPolling({ commitmentId: "test-123" }),
      );

      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

      result.current.stopPolling();

      const callCount = (global.fetch as any).mock.calls.length;

      vi.advanceTimersByTime(COMMITMENT_BOUNDS.POLLING_INITIAL_INTERVAL_MS * 3);

      // Should not poll while stopped
      expect(global.fetch).toHaveBeenCalledTimes(callCount);

      result.current.startPolling();

      // Should resume polling
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(callCount + 1);
      });
    });
  });
});
