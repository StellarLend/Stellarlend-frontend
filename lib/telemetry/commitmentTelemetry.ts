/**
 * Client-side telemetry service for commitment actions
 * Provides structured logging, diagnostics, and operational visibility
 * without exposing secrets or sensitive data
 */

import type { TelemetryEvent } from "@/types/commitment";
import { COMMITMENT_BOUNDS } from "@/types/commitment";

/**
 * Telemetry aggregation for pattern detection
 */
interface TelemetryAggregation {
  eventCounts: Record<string, number>;
  averageLatencies: Record<string, number>;
  errorPatterns: Record<string, number>;
  lastCircuitBreakerEvent?: TelemetryEvent;
  successRate: number;
  totalEvents: number;
}

/**
 * Diagnostic summary for operational visibility
 */
interface DiagnosticSummary {
  health: "healthy" | "degraded" | "critical";
  metrics: {
    successRate: number;
    averageLatency: number;
    errorRate: number;
    circuitBreakerStatus: "closed" | "open";
  };
  issues: Array<{
    severity: "warning" | "error" | "critical";
    message: string;
    count: number;
  }>;
  recommendations: string[];
}

/**
 * Telemetry service for commitment actions
 * Implements batching, aggregation, and diagnostic analysis
 */
export class CommitmentTelemetryService {
  private events: TelemetryEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly maxBufferSize = COMMITMENT_BOUNDS.TELEMETRY_BATCH_SIZE;
  private readonly flushInterval = COMMITMENT_BOUNDS.TELEMETRY_FLUSH_INTERVAL_MS;

  /**
   * Record a telemetry event
   */
  recordEvent(event: TelemetryEvent): void {
    // Sanitize event to ensure no secrets are logged
    const sanitizedEvent = this.sanitizeEvent(event);
    this.events.push(sanitizedEvent);

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      this.logEventToConsole(sanitizedEvent);
    }

    // Trigger flush if buffer is full
    if (this.events.length >= this.maxBufferSize) {
      this.flush();
    } else {
      // Schedule flush if not already scheduled
      this.scheduleFlush();
    }
  }

  /**
   * Sanitize event to remove potential secrets
   */
  private sanitizeEvent(event: TelemetryEvent): TelemetryEvent {
    const sanitized = { ...event };

    // Remove any potential transaction hashes or wallet addresses
    if (sanitized.errorMessage) {
      sanitized.errorMessage = sanitized.errorMessage.replace(
        /[A-Z0-9]{56}/g,
        "[ADDRESS_REDACTED]",
      );
      sanitized.errorMessage = sanitized.errorMessage.replace(/[a-f0-9]{64}/gi, "[HASH_REDACTED]");
    }

    // Sanitize metadata
    if (sanitized.metadata) {
      const sanitizedMetadata = { ...sanitized.metadata };
      Object.keys(sanitizedMetadata).forEach((key) => {
        const value = sanitizedMetadata[key];
        if (typeof value === "string") {
          sanitizedMetadata[key] = value
            .replace(/[A-Z0-9]{56}/g, "[ADDRESS_REDACTED]")
            .replace(/[a-f0-9]{64}/gi, "[HASH_REDACTED]");
        }
      });
      sanitized.metadata = sanitizedMetadata;
    }

    return sanitized;
  }

  /**
   * Log event to console with formatting
   */
  private logEventToConsole(event: TelemetryEvent): void {
    const timestamp = new Date(event.timestamp).toLocaleTimeString();
    const emoji = this.getEventEmoji(event.type);

    let logLevel: "log" | "warn" | "error" = "log";
    if (event.type.includes("error") || event.type.includes("failed")) {
      logLevel = "error";
    } else if (event.type.includes("circuit_breaker")) {
      logLevel = "warn";
    }

    const message = `${emoji} [${timestamp}] ${event.type}`;
    const details: Record<string, unknown> = {
      commitmentId: event.commitmentId,
    };

    if (event.action) details.action = event.action;
    if (event.status) details.status = event.status;
    if (event.latencyMs) details.latencyMs = `${event.latencyMs}ms`;
    if (event.errorType) details.errorType = event.errorType;
    if (event.errorMessage) details.errorMessage = event.errorMessage;
    if (event.metadata) details.metadata = event.metadata;

    console[logLevel](message, details);
  }

  /**
   * Get emoji for event type
   */
  private getEventEmoji(type: string): string {
    const emojiMap: Record<string, string> = {
      action_initiated: "🚀",
      action_completed: "✅",
      action_failed: "❌",
      polling_started: "🔄",
      polling_stopped: "⏸️",
      polling_error: "⚠️",
      api_latency: "⏱️",
      circuit_breaker_opened: "🔴",
      circuit_breaker_closed: "🟢",
      state_transition: "🔀",
    };
    return emojiMap[type] || "📊";
  }

  /**
   * Schedule flush timer
   */
  private scheduleFlush(): void {
    if (this.flushTimer) {
      return; // Already scheduled
    }

    this.flushTimer = setTimeout(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Flush events to monitoring service
   */
  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.events.length === 0) {
      return;
    }

    const eventsToFlush = [...this.events];
    this.events = [];

    // In production, send to monitoring service
    if (process.env.NODE_ENV === "production" && typeof window !== "undefined") {
      this.sendToMonitoringService(eventsToFlush);
    }
  }

  /**
   * Send events to monitoring service
   * In production, integrate with services like Datadog, New Relic, etc.
   */
  private sendToMonitoringService(events: TelemetryEvent[]): void {
    // Example: Send to analytics endpoint
    // This is a placeholder - replace with actual monitoring integration
    try {
      // Avoid sending in test environment
      if (process.env.NODE_ENV === "test") {
        return;
      }

      // Send telemetry via beacon API (non-blocking)
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ events })], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/telemetry/commitment-actions", blob);
      } else {
        // Fallback to fetch with keepalive
        fetch("/api/telemetry/commitment-actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events }),
          keepalive: true,
        }).catch((err) => {
          console.warn("Failed to send telemetry:", err);
        });
      }
    } catch (err) {
      console.warn("Telemetry send failed:", err);
    }
  }

  /**
   * Get aggregated telemetry data
   */
  getAggregation(events: TelemetryEvent[]): TelemetryAggregation {
    const eventCounts: Record<string, number> = {};
    const latencies: Record<string, number[]> = {};
    const errorPatterns: Record<string, number> = {};
    let lastCircuitBreakerEvent: TelemetryEvent | undefined;

    let successCount = 0;
    let failureCount = 0;

    events.forEach((event) => {
      // Count events by type
      eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;

      // Track latencies
      if (event.latencyMs && event.action) {
        const key = `${event.action}_${event.type}`;
        if (!latencies[key]) latencies[key] = [];
        latencies[key].push(event.latencyMs);
      }

      // Track error patterns
      if (event.errorType) {
        errorPatterns[event.errorType] = (errorPatterns[event.errorType] || 0) + 1;
      }

      // Track success/failure
      if (event.type === "action_completed") {
        successCount++;
      } else if (event.type === "action_failed") {
        failureCount++;
      }

      // Track circuit breaker events
      if (event.type.includes("circuit_breaker")) {
        lastCircuitBreakerEvent = event;
      }
    });

    // Calculate average latencies
    const averageLatencies: Record<string, number> = {};
    Object.entries(latencies).forEach(([key, values]) => {
      averageLatencies[key] = values.reduce((a, b) => a + b, 0) / values.length;
    });

    const totalActions = successCount + failureCount;
    const successRate = totalActions > 0 ? (successCount / totalActions) * 100 : 100;

    return {
      eventCounts,
      averageLatencies,
      errorPatterns,
      lastCircuitBreakerEvent,
      successRate,
      totalEvents: events.length,
    };
  }

  /**
   * Generate diagnostic summary
   */
  generateDiagnostics(events: TelemetryEvent[]): DiagnosticSummary {
    const aggregation = this.getAggregation(events);
    const issues: DiagnosticSummary["issues"] = [];
    const recommendations: string[] = [];

    // Calculate metrics
    const totalApiCalls = (aggregation.eventCounts.api_latency || 0);
    const totalErrors =
      (aggregation.eventCounts.action_failed || 0) + (aggregation.eventCounts.polling_error || 0);
    const errorRate = totalApiCalls > 0 ? (totalErrors / totalApiCalls) * 100 : 0;

    // Calculate average latency across all operations
    const allLatencies = Object.values(aggregation.averageLatencies);
    const averageLatency =
      allLatencies.length > 0
        ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length
        : 0;

    // Determine circuit breaker status
    const circuitBreakerStatus =
      aggregation.lastCircuitBreakerEvent?.type === "circuit_breaker_opened" ? "open" : "closed";

    // Analyze health
    let health: DiagnosticSummary["health"] = "healthy";

    // Check success rate
    if (aggregation.successRate < 50) {
      health = "critical";
      issues.push({
        severity: "critical",
        message: "Success rate below 50%",
        count: 1,
      });
      recommendations.push("Investigate backend service health and error patterns");
    } else if (aggregation.successRate < 80) {
      health = "degraded";
      issues.push({
        severity: "warning",
        message: "Success rate below 80%",
        count: 1,
      });
      recommendations.push("Review recent failures and consider retry logic adjustments");
    }

    // Check circuit breaker
    if (circuitBreakerStatus === "open") {
      health = "critical";
      issues.push({
        severity: "critical",
        message: "Circuit breaker is open",
        count: 1,
      });
      recommendations.push(
        "Wait for circuit breaker to reset or investigate repeated failures",
      );
    }

    // Check latency
    if (averageLatency > 5000) {
      if (health === "healthy") health = "degraded";
      issues.push({
        severity: "warning",
        message: `High average latency: ${Math.round(averageLatency)}ms`,
        count: 1,
      });
      recommendations.push("Check network conditions and backend response times");
    }

    // Check error patterns
    Object.entries(aggregation.errorPatterns).forEach(([errorType, count]) => {
      if (count > 3) {
        issues.push({
          severity: "error",
          message: `Repeated error: ${errorType}`,
          count,
        });
        if (!recommendations.includes("Review error logs for patterns")) {
          recommendations.push("Review error logs for patterns");
        }
      }
    });

    return {
      health,
      metrics: {
        successRate: aggregation.successRate,
        averageLatency,
        errorRate,
        circuitBreakerStatus,
      },
      issues,
      recommendations,
    };
  }

  /**
   * Get all recorded events
   */
  getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Cleanup on unmount
   */
  destroy(): void {
    this.flush();
    this.clear();
  }
}

// Singleton instance
let telemetryServiceInstance: CommitmentTelemetryService | null = null;

/**
 * Get telemetry service singleton
 */
export function getCommitmentTelemetryService(): CommitmentTelemetryService {
  if (!telemetryServiceInstance) {
    telemetryServiceInstance = new CommitmentTelemetryService();
  }
  return telemetryServiceInstance;
}

/**
 * Hook for using telemetry service
 */
export function useCommitmentTelemetry() {
  const service = getCommitmentTelemetryService();

  return {
    recordEvent: (event: TelemetryEvent) => service.recordEvent(event),
    getAggregation: (events: TelemetryEvent[]) => service.getAggregation(events),
    generateDiagnostics: (events: TelemetryEvent[]) => service.generateDiagnostics(events),
    flush: () => service.flush(),
  };
}
