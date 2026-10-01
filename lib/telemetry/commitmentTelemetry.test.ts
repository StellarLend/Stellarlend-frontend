/**
 * Tests for CommitmentTelemetryService
 * Covers event recording, sanitization, aggregation, diagnostics, and batching
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CommitmentTelemetryService } from "./commitmentTelemetry";
import type { TelemetryEvent } from "@/types/commitment";
import { COMMITMENT_BOUNDS } from "@/types/commitment";

describe("CommitmentTelemetryService", () => {
  let service: CommitmentTelemetryService;

  beforeEach(() => {
    service = new CommitmentTelemetryService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
  });

  describe("Event recording", () => {
    it("should record telemetry events", () => {
      const event: TelemetryEvent = {
        type: "action_initiated",
        timestamp: Date.now(),
        commitmentId: "test-123",
        action: "fund",
      };

      service.recordEvent(event);

      const events = service.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(event);
    });

    it("should accumulate multiple events", () => {
      for (let i = 0; i < 5; i++) {
        service.recordEvent({
          type: "polling_started",
          timestamp: Date.now(),
          commitmentId: `test-${i}`,
        });
      }

      expect(service.getEvents()).toHaveLength(5);
    });
  });

  describe("Secret sanitization", () => {
    it("should redact transaction hashes from error messages", () => {
      const secretHash = "a1b2c3d4".repeat(8); // 64 char hex

      const event: TelemetryEvent = {
        type: "action_failed",
        timestamp: Date.now(),
        commitmentId: "test-123",
        errorMessage: `Transaction ${secretHash} failed`,
      };

      service.recordEvent(event);

      const events = service.getEvents();
      expect(events[0].errorMessage).not.toContain(secretHash);
      expect(events[0].errorMessage).toContain("[HASH_REDACTED]");
    });

    it("should redact wallet addresses from error messages", () => {
      const address = "G" + "A".repeat(55); // Stellar address format

      const event: TelemetryEvent = {
        type: "action_failed",
        timestamp: Date.now(),
        commitmentId: "test-123",
        errorMessage: `Invalid address ${address}`,
      };

      service.recordEvent(event);

      const events = service.getEvents();
      expect(events[0].errorMessage).not.toContain(address);
      expect(events[0].errorMessage).toContain("[ADDRESS_REDACTED]");
    });

    it("should sanitize metadata values", () => {
      const secretHash = "f".repeat(64);

      const event: TelemetryEvent = {
        type: "action_completed",
        timestamp: Date.now(),
        commitmentId: "test-123",
        metadata: {
          txHash: secretHash,
          status: "success",
        },
      };

      service.recordEvent(event);

      const events = service.getEvents();
      expect(events[0].metadata?.txHash).not.toContain(secretHash);
      expect(events[0].metadata?.txHash).toContain("[HASH_REDACTED]");
    });
  });

  describe("Batching and flushing", () => {
    it("should flush when buffer reaches max size", () => {
      const flushSpy = vi.spyOn(service as any, "sendToMonitoringService");

      for (let i = 0; i < COMMITMENT_BOUNDS.TELEMETRY_BATCH_SIZE; i++) {
        service.recordEvent({
          type: "polling_started",
          timestamp: Date.now(),
          commitmentId: "test-123",
        });
      }

      expect(flushSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: "polling_started" }),
        ]),
      );
    });

    it("should flush on timer interval", () => {
      const flushSpy = vi.spyOn(service as any, "sendToMonitoringService");

      service.recordEvent({
        type: "polling_started",
        timestamp: Date.now(),
        commitmentId: "test-123",
      });

      // Advance past flush interval
      vi.advanceTimersByTime(COMMITMENT_BOUNDS.TELEMETRY_FLUSH_INTERVAL_MS);

      expect(flushSpy).toHaveBeenCalled();
    });

    it("should clear buffer after flush", () => {
      for (let i = 0; i < 3; i++) {
        service.recordEvent({
          type: "polling_started",
          timestamp: Date.now(),
          commitmentId: "test-123",
        });
      }

      service.flush();

      expect(service.getEvents()).toHaveLength(0);
    });

    it("should not schedule duplicate flush timers", () => {
      service.recordEvent({
        type: "polling_started",
        timestamp: Date.now(),
        commitmentId: "test-123",
      });

      service.recordEvent({
        type: "polling_started",
        timestamp: Date.now(),
        commitmentId: "test-123",
      });

      // Should only have one timer scheduled
      const timers = vi.getTimerCount();
      expect(timers).toBe(1);
    });
  });

  describe("Event aggregation", () => {
    it("should count events by type", () => {
      const events: TelemetryEvent[] = [
        { type: "polling_started", timestamp: Date.now(), commitmentId: "test-123" },
        { type: "polling_started", timestamp: Date.now(), commitmentId: "test-123" },
        { type: "action_initiated", timestamp: Date.now(), commitmentId: "test-123" },
        { type: "action_completed", timestamp: Date.now(), commitmentId: "test-123" },
      ];

      const aggregation = service.getAggregation(events);

      expect(aggregation.eventCounts["polling_started"]).toBe(2);
      expect(aggregation.eventCounts["action_initiated"]).toBe(1);
      expect(aggregation.eventCounts["action_completed"]).toBe(1);
    });

    it("should calculate average latencies", () => {
      const events: TelemetryEvent[] = [
        {
          type: "api_latency",
          timestamp: Date.now(),
          commitmentId: "test-123",
          action: "fund",
          latencyMs: 100,
        },
        {
          type: "api_latency",
          timestamp: Date.now(),
          commitmentId: "test-123",
          action: "fund",
          latencyMs: 200,
        },
        {
          type: "api_latency",
          timestamp: Date.now(),
          commitmentId: "test-123",
          action: "fund",
          latencyMs: 300,
        },
      ];

      const aggregation = service.getAggregation(events);

      expect(aggregation.averageLatencies["fund_api_latency"]).toBe(200);
    });

    it("should track error patterns", () => {
      const events: TelemetryEvent[] = [
        {
          type: "action_failed",
          timestamp: Date.now(),
          commitmentId: "test-123",
          errorType: "NetworkError",
        },
        {
          type: "action_failed",
          timestamp: Date.now(),
          commitmentId: "test-123",
          errorType: "NetworkError",
        },
        {
          type: "action_failed",
          timestamp: Date.now(),
          commitmentId: "test-123",
          errorType: "TimeoutError",
        },
      ];

      const aggregation = service.getAggregation(events);

      expect(aggregation.errorPatterns["NetworkError"]).toBe(2);
      expect(aggregation.errorPatterns["TimeoutError"]).toBe(1);
    });

    it("should calculate success rate", () => {
      const events: TelemetryEvent[] = [
        { type: "action_completed", timestamp: Date.now(), commitmentId: "test-123" },
        { type: "action_completed", timestamp: Date.now(), commitmentId: "test-123" },
        { type: "action_completed", timestamp: Date.now(), commitmentId: "test-123" },
        { type: "action_failed", timestamp: Date.now(), commitmentId: "test-123" },
      ];

      const aggregation = service.getAggregation(events);

      expect(aggregation.successRate).toBe(75);
    });

    it("should track last circuit breaker event", () => {
      const circuitEvent: TelemetryEvent = {
        type: "circuit_breaker_opened",
        timestamp: Date.now(),
        commitmentId: "test-123",
      };

      const events: TelemetryEvent[] = [
        { type: "polling_started", timestamp: Date.now(), commitmentId: "test-123" },
        circuitEvent,
        { type: "polling_stopped", timestamp: Date.now(), commitmentId: "test-123" },
      ];

      const aggregation = service.getAggregation(events);

      expect(aggregation.lastCircuitBreakerEvent).toEqual(circuitEvent);
    });
  });

  describe("Diagnostics generation", () => {
    it("should report healthy status with high success rate", () => {
      const events: TelemetryEvent[] = Array(10)
        .fill(null)
        .map(() => ({
          type: "action_completed",
          timestamp: Date.now(),
          commitmentId: "test-123",
        }));

      const diagnostics = service.generateDiagnostics(events);

      expect(diagnostics.health).toBe("healthy");
      expect(diagnostics.metrics.successRate).toBe(100);
      expect(diagnostics.issues).toHaveLength(0);
    });

    it("should report degraded status with moderate success rate", () => {
      const events: TelemetryEvent[] = [
        ...Array(7)
          .fill(null)
          .map(() => ({
            type: "action_completed",
            timestamp: Date.now(),
            commitmentId: "test-123",
          })),
        ...Array(3)
          .fill(null)
          .map(() => ({
            type: "action_failed",
            timestamp: Date.now(),
            commitmentId: "test-123",
          })),
      ];

      const diagnostics = service.generateDiagnostics(events);

      expect(diagnostics.health).toBe("degraded");
      expect(diagnostics.metrics.successRate).toBe(70);
      expect(diagnostics.issues.length).toBeGreaterThan(0);
    });

    it("should report critical status with low success rate", () => {
      const events: TelemetryEvent[] = [
        ...Array(3)
          .fill(null)
          .map(() => ({
            type: "action_completed",
            timestamp: Date.now(),
            commitmentId: "test-123",
          })),
        ...Array(7)
          .fill(null)
          .map(() => ({
            type: "action_failed",
            timestamp: Date.now(),
            commitmentId: "test-123",
          })),
      ];

      const diagnostics = service.generateDiagnostics(events);

      expect(diagnostics.health).toBe("critical");
      expect(diagnostics.metrics.successRate).toBe(30);
    });

    it("should report critical status when circuit breaker is open", () => {
      const events: TelemetryEvent[] = [
        { type: "circuit_breaker_opened", timestamp: Date.now(), commitmentId: "test-123" },
        { type: "action_completed", timestamp: Date.now(), commitmentId: "test-123" },
      ];

      const diagnostics = service.generateDiagnostics(events);

      expect(diagnostics.health).toBe("critical");
      expect(diagnostics.metrics.circuitBreakerStatus).toBe("open");
      expect(diagnostics.issues.some((i) => i.message.includes("circuit breaker"))).toBe(true);
    });

    it("should detect high latency", () => {
      const events: TelemetryEvent[] = [
        {
          type: "api_latency",
          timestamp: Date.now(),
          commitmentId: "test-123",
          latencyMs: 6000,
        },
        {
          type: "api_latency",
          timestamp: Date.now(),
          commitmentId: "test-123",
          latencyMs: 7000,
        },
      ];

      const diagnostics = service.generateDiagnostics(events);

      expect(diagnostics.issues.some((i) => i.message.includes("latency"))).toBe(true);
    });

    it("should detect repeated errors", () => {
      const events: TelemetryEvent[] = Array(5)
        .fill(null)
        .map(() => ({
          type: "action_failed",
          timestamp: Date.now(),
          commitmentId: "test-123",
          errorType: "NetworkError",
        }));

      const diagnostics = service.generateDiagnostics(events);

      expect(diagnostics.issues.some((i) => i.message.includes("NetworkError"))).toBe(true);
      expect(diagnostics.issues.find((i) => i.message.includes("NetworkError"))?.count).toBe(5);
    });

    it("should provide recommendations", () => {
      const events: TelemetryEvent[] = [
        ...Array(3)
          .fill(null)
          .map(() => ({
            type: "action_completed",
            timestamp: Date.now(),
            commitmentId: "test-123",
          })),
        ...Array(7)
          .fill(null)
          .map(() => ({
            type: "action_failed",
            timestamp: Date.now(),
            commitmentId: "test-123",
          })),
      ];

      const diagnostics = service.generateDiagnostics(events);

      expect(diagnostics.recommendations.length).toBeGreaterThan(0);
      expect(diagnostics.recommendations.some((r) => r.includes("backend"))).toBe(true);
    });
  });

  describe("Cleanup", () => {
    it("should clear events", () => {
      service.recordEvent({
        type: "polling_started",
        timestamp: Date.now(),
        commitmentId: "test-123",
      });

      expect(service.getEvents()).toHaveLength(1);

      service.clear();

      expect(service.getEvents()).toHaveLength(0);
    });

    it("should flush on destroy", () => {
      const flushSpy = vi.spyOn(service, "flush");

      service.recordEvent({
        type: "polling_started",
        timestamp: Date.now(),
        commitmentId: "test-123",
      });

      service.destroy();

      expect(flushSpy).toHaveBeenCalled();
    });

    it("should cancel flush timer on destroy", () => {
      service.recordEvent({
        type: "polling_started",
        timestamp: Date.now(),
        commitmentId: "test-123",
      });

      const timersBefore = vi.getTimerCount();
      expect(timersBefore).toBeGreaterThan(0);

      service.destroy();

      const timersAfter = vi.getTimerCount();
      expect(timersAfter).toBe(0);
    });
  });
});
