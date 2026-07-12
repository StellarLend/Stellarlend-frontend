import { describe, expect, it, beforeEach } from "vitest";
import {
  clearAuditLog,
  emitAuditEvent,
  getAuditEvents,
} from "./events";

describe("lib/audit/events", () => {
  beforeEach(() => {
    clearAuditLog();
  });

  it("emits audit events with metadata", () => {
    const event = emitAuditEvent("account.deleted", "user-42", { reason: "self-service" });
    expect(event.type).toBe("account.deleted");
    expect(event.userId).toBe("user-42");
    expect(event.metadata.reason).toBe("self-service");
  });

  it("filters events by user and type", () => {
    emitAuditEvent("sessions.revoked", "user-a");
    emitAuditEvent("account.deleted", "user-b");
    expect(getAuditEvents({ userId: "user-a" })).toHaveLength(1);
    expect(getAuditEvents({ type: "account.deleted" })).toHaveLength(1);
  });
});
