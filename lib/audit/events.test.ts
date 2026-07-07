import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";
import { clearAuditLog, emitAuditEvent, getAuditEvents } from "./events";

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
  },
}));

const loggerInfo = vi.mocked(logger.info);

describe("lib/audit/events", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T09:00:00.000Z"));
    clearAuditLog();
    loggerInfo.mockClear();
  });

  it("shapes emitted events with actor, action, timestamp, request id metadata, and logger context", () => {
    const event = emitAuditEvent("account.deleted", "user-123", {
      requestId: "req-001",
      reason: "user-requested-delete",
    });

    expect(event).toEqual({
      id: "audit-1783414800000-1",
      type: "account.deleted",
      userId: "user-123",
      timestamp: "2026-07-07T09:00:00.000Z",
      metadata: {
        requestId: "req-001",
        reason: "user-requested-delete",
      },
    });
    expect(loggerInfo).toHaveBeenCalledWith(
      "audit: account.deleted",
      "/api/audit",
      {
        eventId: event.id,
        userId: "user-123",
        type: "account.deleted",
      },
    );
  });

  it("filters stored events by user, type, and since timestamp", () => {
    emitAuditEvent("account.deleted", "user-a", { requestId: "req-a" });

    vi.setSystemTime(new Date("2026-07-07T09:01:00.000Z"));
    emitAuditEvent("sessions.revoked", "user-a", { requestId: "req-b" });
    emitAuditEvent("account.deleted", "user-b", { requestId: "req-c" });

    expect(
      getAuditEvents({ userId: "user-a" }).map((event) => event.type),
    ).toEqual(["account.deleted", "sessions.revoked"]);
    expect(
      getAuditEvents({ type: "account.deleted" }).map((event) => event.userId),
    ).toEqual(["user-a", "user-b"]);
    expect(getAuditEvents({ since: "2026-07-07T09:00:30.000Z" })).toHaveLength(
      2,
    );
  });

  it("supports missing actor fallback values without dropping the audit record", () => {
    const event = emitAuditEvent("data.cleanup.failed", "", {
      requestId: null,
      error: "missing actor in cleanup context",
    });

    expect(event.userId).toBe("");
    expect(event.metadata.requestId).toBeNull();
    expect(getAuditEvents()).toHaveLength(1);
  });

  it("stores oversized metadata payloads as explicit caller-provided context", () => {
    const largeReason = "x".repeat(2_048);

    const event = emitAuditEvent("data.cleanup.enqueued", "user-large", {
      requestId: "req-large",
      reason: largeReason,
    });

    expect(event.metadata.reason).toBe(largeReason);
    expect(getAuditEvents({ userId: "user-large" })[0].metadata.reason).toBe(
      largeReason,
    );
  });

  it("clears stored events and resets generated ids for tests", () => {
    emitAuditEvent("account.deleted", "user-before-clear");
    clearAuditLog();

    const event = emitAuditEvent("sessions.revoked", "user-after-clear");

    expect(getAuditEvents()).toHaveLength(1);
    expect(event.id).toBe("audit-1783414800000-1");
  });
});
