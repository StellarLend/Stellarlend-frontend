import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  sanitizeReturnTo,
  recordAuthorizationEvent,
  getRecentAuthorizationEvents,
  clearAuthorizationTelemetry,
  getAuthorizationDiagnostics,
  PROTECTED_ROUTE_BOUNDS,
} from "./protected-route-telemetry";

describe("protected-route-telemetry", () => {
  beforeEach(() => {
    clearAuthorizationTelemetry();
    vi.restoreAllMocks();
  });

  describe("sanitizeReturnTo", () => {
    it("passes through valid relative paths within bounds", () => {
      const result = sanitizeReturnTo("/dashboard/settings", "/fallback");
      expect(result.value).toBe("/dashboard/settings");
      expect(result.sanitized).toBe(false);
    });

    it("passes through the root path", () => {
      const result = sanitizeReturnTo("/", "/fallback");
      expect(result.value).toBe("/");
      expect(result.sanitized).toBe(false);
    });

    it("passes through paths under allowed prefixes", () => {
      expect(sanitizeReturnTo("/dashboard/portfolio", "/fallback").sanitized).toBe(false);
      expect(sanitizeReturnTo("/settings/profile", "/fallback").sanitized).toBe(false);
    });

    it("sanitizes paths exceeding MAX_RETURN_TO_LENGTH", () => {
      const longPath = "/" + "a".repeat(PROTECTED_ROUTE_BOUNDS.MAX_RETURN_TO_LENGTH);
      const result = sanitizeReturnTo(longPath, "/fallback");
      expect(result.value).toBe("/fallback");
      expect(result.sanitized).toBe(true);
    });

    it("sanitizes protocol-relative URLs (//evil.com)", () => {
      const result = sanitizeReturnTo("//evil.com/phish", "/fallback");
      expect(result.value).toBe("/fallback");
      expect(result.sanitized).toBe(true);
    });

    it("sanitizes absolute http URLs", () => {
      const result = sanitizeReturnTo("http://evil.com/phish", "/fallback");
      expect(result.value).toBe("/fallback");
      expect(result.sanitized).toBe(true);
    });

    it("sanitizes absolute https URLs", () => {
      const result = sanitizeReturnTo("https://evil.com/phish", "/fallback");
      expect(result.value).toBe("/fallback");
      expect(result.sanitized).toBe(true);
    });

    it("sanitizes unknown prefixes", () => {
      const result = sanitizeReturnTo("/admin/panel", "/fallback");
      expect(result.value).toBe("/fallback");
      expect(result.sanitized).toBe(true);
    });

    it("accepts exact prefix match", () => {
      const result = sanitizeReturnTo("/settings", "/fallback");
      expect(result.value).toBe("/settings");
      expect(result.sanitized).toBe(false);
    });

    it("uses custom bounds when provided", () => {
      const customBounds = {
        MAX_RETURN_TO_LENGTH: 10,
        ALLOWED_RETURN_TO_PREFIXES: ["/short"] as readonly string[],
      };
      const longResult = sanitizeReturnTo("/long-path-name", "/fallback", customBounds);
      expect(longResult.sanitized).toBe(true);

      const allowedResult = sanitizeReturnTo("/short/x", "/fallback", customBounds);
      expect(allowedResult.sanitized).toBe(false);
    });
  });

  describe("recordAuthorizationEvent", () => {
    it("records a granted event with sanitized targetRoute", () => {
      const record = recordAuthorizationEvent({
        outcome: "granted",
        latencyMs: 12.5,
        targetRoute: "/dashboard/settings",
      });

      expect(record.outcome).toBe("granted");
      expect(record.latencyMs).toBe(12.5);
      expect(record.targetRoute).toBe("/dashboard/settings");
      expect(record.timestamp).toBeGreaterThan(0);
      expect(record.denialReason).toBeUndefined();
    });

    it("records a denied event with denial reason", () => {
      const record = recordAuthorizationEvent({
        outcome: "denied",
        latencyMs: 5.3,
        targetRoute: "/dashboard",
        denialReason: "expired-session",
        sessionExpired: true,
      });

      expect(record.outcome).toBe("denied");
      expect(record.denialReason).toBe("expired-session");
      expect(record.sessionExpired).toBe(true);
    });

    it("redacts Stellar account addresses from targetRoute", () => {
      const record = recordAuthorizationEvent({
        outcome: "granted",
        latencyMs: 1,
        targetRoute: "/GAUFVBMULU2CJRE5IGVPEOXRYZGU5YDAOSQ3UQTBM3Y7ARUPFSXZUHN5",
      });

      expect(record.targetRoute).not.toContain("GAUFVBMULU2CJRE5IGVPEOXRYZGU5YDAOSQ3UQTBM3Y7ARUPFSXZUHN5");
      expect(record.targetRoute).toContain("[REDACTED]");
    });

    it("emits a structured console.warn for denied events", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      recordAuthorizationEvent({
        outcome: "denied",
        latencyMs: 1,
        targetRoute: "/",
        denialReason: "missing-session",
      });

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const [tag, payload] = warnSpy.mock.calls[0];
      expect(tag).toContain("Authorization denied");
      expect(payload).toMatchObject({
        outcome: "denied",
        denialReason: "missing-session",
      });
      // Must not leak secrets
      expect(JSON.stringify(payload)).not.toMatch(/[GS][A-Z0-9]{55}/);
    });

    it("emits a structured console.debug for granted events", () => {
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

      recordAuthorizationEvent({
        outcome: "granted",
        latencyMs: 2,
        targetRoute: "/",
      });

      expect(debugSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("ring buffer behavior", () => {
    it("stores up to TELEMETRY_RING_SIZE events", () => {
      for (let i = 0; i < 250; i++) {
        recordAuthorizationEvent({
          outcome: "granted",
          latencyMs: 1,
          targetRoute: "/",
        });
      }

      const events = getRecentAuthorizationEvents(300);
      expect(events.length).toBeLessThanOrEqual(200);
    });

    it("retains the most recent events when the ring is full", () => {
      // Fill with 200 "old" events
      for (let i = 0; i < 200; i++) {
        recordAuthorizationEvent({
          outcome: "granted",
          latencyMs: 1,
          targetRoute: `/old-${i}`,
        });
      }

      // Add 5 "new" events
      for (let i = 0; i < 5; i++) {
        recordAuthorizationEvent({
          outcome: "denied",
          latencyMs: 1,
          targetRoute: `/new-${i}`,
          denialReason: "missing-session",
        });
      }

      const events = getRecentAuthorizationEvents(10);
      const newEvents = events.filter((e) => e.targetRoute.startsWith("/new-"));
      expect(newEvents.length).toBe(5);
    });
  });

  describe("clearAuthorizationTelemetry", () => {
    it("empties the ring buffer", () => {
      recordAuthorizationEvent({ outcome: "granted", latencyMs: 1, targetRoute: "/" });
      recordAuthorizationEvent({ outcome: "denied", latencyMs: 1, targetRoute: "/", denialReason: "missing-session" });

      clearAuthorizationTelemetry();

      expect(getRecentAuthorizationEvents(10)).toHaveLength(0);
    });
  });

  describe("getAuthorizationDiagnostics", () => {
    it("returns zeroed diagnostics when buffer is empty", () => {
      const diag = getAuthorizationDiagnostics();
      expect(diag.totalAttempts).toBe(0);
      expect(diag.granted).toBe(0);
      expect(diag.denied).toBe(0);
      expect(diag.successRate).toBe(1);
      expect(diag.averageLatencyMs).toBe(0);
      expect(diag.denialBreakdown).toEqual({});
      expect(diag.hadSanitizations).toBe(false);
    });

    it("computes correct success rate and denial breakdown", () => {
      // 3 granted, 2 denied
      recordAuthorizationEvent({ outcome: "granted", latencyMs: 10, targetRoute: "/" });
      recordAuthorizationEvent({ outcome: "granted", latencyMs: 20, targetRoute: "/" });
      recordAuthorizationEvent({ outcome: "granted", latencyMs: 30, targetRoute: "/" });
      recordAuthorizationEvent({ outcome: "denied", latencyMs: 5, targetRoute: "/", denialReason: "expired-session" });
      recordAuthorizationEvent({ outcome: "denied", latencyMs: 8, targetRoute: "/", denialReason: "missing-session" });

      const diag = getAuthorizationDiagnostics();
      expect(diag.totalAttempts).toBe(5);
      expect(diag.granted).toBe(3);
      expect(diag.denied).toBe(2);
      expect(diag.successRate).toBeCloseTo(0.6);
      expect(diag.averageLatencyMs).toBeCloseTo(14.6);
      expect(diag.denialBreakdown).toEqual({
        "expired-session": 1,
        "missing-session": 1,
      });
    });

    it("tracks returnTo sanitization occurrences", () => {
      recordAuthorizationEvent({
        outcome: "denied",
        latencyMs: 1,
        targetRoute: "/fallback",
        returnToSanitized: true,
      });

      expect(getAuthorizationDiagnostics().hadSanitizations).toBe(true);
    });
  });

  describe("bounds constants", () => {
    it("defines MAX_RETURN_TO_LENGTH as a positive integer", () => {
      expect(PROTECTED_ROUTE_BOUNDS.MAX_RETURN_TO_LENGTH).toBeGreaterThan(0);
      expect(Number.isInteger(PROTECTED_ROUTE_BOUNDS.MAX_RETURN_TO_LENGTH)).toBe(true);
    });

    it("defines ALLOWED_RETURN_TO_PREFIXES as non-empty array starting with /", () => {
      expect(PROTECTED_ROUTE_BOUNDS.ALLOWED_RETURN_TO_PREFIXES.length).toBeGreaterThan(0);
      for (const prefix of PROTECTED_ROUTE_BOUNDS.ALLOWED_RETURN_TO_PREFIXES) {
        expect(prefix.startsWith("/")).toBe(true);
      }
    });

    it("defines SESSION_VALIDATION_TIMEOUT_MS as positive", () => {
      expect(PROTECTED_ROUTE_BOUNDS.SESSION_VALIDATION_TIMEOUT_MS).toBeGreaterThan(0);
    });

    it("defines MAX_CONCURRENT_VALIDATIONS as positive integer", () => {
      expect(PROTECTED_ROUTE_BOUNDS.MAX_CONCURRENT_VALIDATIONS).toBeGreaterThan(0);
      expect(Number.isInteger(PROTECTED_ROUTE_BOUNDS.MAX_CONCURRENT_VALIDATIONS)).toBe(true);
    });
  });
});
