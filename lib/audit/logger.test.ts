import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendAuditEvent,
  auditAdminUsersRead,
  clearAuditEventsForTests,
  emitAuditEvent,
  getAuditEvents,
  hashIp,
  redactAuditPayload,
} from "./logger";

describe("lib/audit/logger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T10:00:00.000Z"));
    clearAuditEventsForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("hashes IP addresses deterministically and keeps missing IPs null", () => {
    const expected = crypto
      .createHash("sha256")
      .update("203.0.113.10")
      .digest("hex");

    expect(hashIp("203.0.113.10")).toBe(expected);
    expect(hashIp(null)).toBeNull();
    expect(hashIp(undefined)).toBeNull();
  });

  it("redacts sensitive payload fields while preserving safe context", () => {
    const redacted = redactAuditPayload({
      actorWallet: "GACTOR",
      page: 1,
      password: "plain-password",
      publicKey: "GPUBLIC",
      query: "status:active",
      secret: "secret-value",
      signedEnvelopeXdr: "AAAA...",
      token: "session-token",
      transaction: "signed-transaction",
      walletAddress: "GWALLET",
    });

    expect(redacted).toEqual({
      page: 1,
      query: "status:active",
    });
  });

  it("appends audit records with actor, action, timestamp, request id slot, and status", async () => {
    const row = await appendAuditEvent({
      actorWallet: "GACTOR",
      action: "profile.update",
      resource: "account.profile",
      status: "success",
      requestId: "req-123",
      ipHash: "hashed-ip",
    });

    expect(row).toEqual({
      actorWallet: "GACTOR",
      action: "profile.update",
      resource: "account.profile",
      status: "success",
      requestId: "req-123",
      ipHash: "hashed-ip",
      createdAt: "2026-07-07T10:00:00.000Z",
    });
    expect(getAuditEvents()).toEqual([row]);
  });

  it("returns a copy of the append-only audit event list", async () => {
    await appendAuditEvent({
      actorWallet: null,
      action: "auth.verify",
      resource: "wallet",
      status: "failure",
      requestId: null,
      ipHash: null,
    });

    const snapshot = getAuditEvents();
    snapshot.length = 0;

    expect(getAuditEvents()).toHaveLength(1);
  });

  it("writes admin audit events as JSON lines to the configured stdout sink", () => {
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    emitAuditEvent("admin.users.read", "admin-1", { page: 2 });

    expect(writeSpy).toHaveBeenCalledOnce();
    const written = writeSpy.mock.calls[0][0] as string;
    expect(written.endsWith("\n")).toBe(true);
    expect(JSON.parse(written)).toEqual({
      type: "AUDIT",
      timestamp: "2026-07-07T10:00:00.000Z",
      action: "admin.users.read",
      actorId: "admin-1",
      context: { page: 2 },
    });
  });

  it("wraps admin user read query params without adding sensitive defaults", () => {
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    auditAdminUsersRead("admin-2", { page: 1, search: "active" });

    const written = writeSpy.mock.calls[0][0] as string;
    expect(JSON.parse(written)).toMatchObject({
      action: "admin.users.read",
      actorId: "admin-2",
      context: {
        queryParams: { page: 1, search: "active" },
      },
    });
    expect(written).not.toContain("token");
    expect(written).not.toContain("password");
  });
});
