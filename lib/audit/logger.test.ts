import { describe, expect, it, beforeEach } from "vitest";
import {
  appendAuditEvent,
  clearAuditEventsForTests,
  getAuditEvents,
  hashIp,
  redactAuditPayload,
} from "./logger";

describe("lib/audit/logger", () => {
  beforeEach(() => {
    clearAuditEventsForTests();
  });

  it("hashes IP addresses for storage", () => {
    const hashed = hashIp("203.0.113.10");
    expect(hashed).toMatch(/^[a-f0-9]{64}$/);
    expect(hashIp(null)).toBeNull();
  });

  it("redacts sensitive payload keys", () => {
    const redacted = redactAuditPayload({
      action: "withdraw",
      token: "secret",
      amount: 100,
    });
    expect(redacted.action).toBe("withdraw");
    expect(redacted.amount).toBe(100);
    expect(redacted.token).toBeUndefined();
  });

  it("appends audit rows with timestamps", async () => {
    await appendAuditEvent({
      action: "login",
      resource: "session",
      status: "success",
    });
    expect(getAuditEvents()).toHaveLength(1);
    expect(getAuditEvents()[0].createdAt).toBeTruthy();
  });
});
