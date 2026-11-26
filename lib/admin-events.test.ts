// @vitest-environment node

import { describe, expect, it } from "vitest";
import { decodeAdminEvent, type AdminEvent } from "./admin-events";
import { SECONDS_PER_LEDGER } from "./admin";

describe("admin-events", () => {
  it("ignores unknown topics", () => {
    const raw = {
      id: "ev-1",
      ledger: 100,
      topic: ["some_random_event", "arg1"],
      value: { data: 123 },
    };

    expect(() => {
      const decoded = decodeAdminEvent(raw as unknown as Parameters<typeof decodeAdminEvent>[0]);
      expect(decoded).toBeNull();
    }).not.toThrow();
  });

  it("decodes pause with expiry", () => {
    const currentLedger = 1000;
    const expiresAtLedger = 1200; // 200 ledgers remaining

    const raw = {
      id: "ev-2",
      ledger: 950,
      txHash: "tx-hash-123",
      topic: ["set_pause", "Deposit"],
      value: {
        enabled: true,
        expires_at_ledger: expiresAtLedger,
        actor: "GA5W...SKYH",
      },
    };

    const decoded = decodeAdminEvent(raw as unknown as Parameters<typeof decodeAdminEvent>[0], currentLedger);
    expect(decoded).not.toBeNull();
    expect(decoded?.kind).toBe("pause_set");
    expect(decoded?.pauseType).toBe("Deposit");
    expect(decoded?.enabled).toBe(true);
    expect(decoded?.expiresAtLedger).toBe(expiresAtLedger);
    expect(decoded?.isExpired).toBe(false);
    expect(decoded?.remainingSeconds).toBe(200 * SECONDS_PER_LEDGER);

    // Test when passed
    const pastDecoded = decodeAdminEvent(raw as unknown as Parameters<typeof decodeAdminEvent>[0], 1250);
    expect(pastDecoded?.isExpired).toBe(true);
    expect(pastDecoded?.remainingSeconds).toBe(0);
  });

  it("load more appends", () => {
    const initialEvents: AdminEvent[] = [
      {
        id: "ev-1",
        kind: "pause_set",
        action: "Pause Deposit",
        actor: "GA1",
        ledger: 100,
        txHash: "tx1",
      },
    ];

    const nextBatch: AdminEvent[] = [
      {
        id: "ev-2",
        kind: "emergency_state_set",
        action: "Emergency State: Shutdown",
        actor: "GA2",
        ledger: 90,
        txHash: "tx2",
      },
    ];

    const combined = [...initialEvents, ...nextBatch];
    expect(combined.length).toBe(2);
    expect(combined[0].id).toBe("ev-1");
    expect(combined[1].id).toBe("ev-2");
  });
});
