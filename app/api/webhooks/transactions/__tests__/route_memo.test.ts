import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/webhooks/transactions/route";
import { signPayload } from "@/lib/webhooks/verify";
import { SIGNATURE_HEADER } from "@/lib/webhooks/types";
import { resetStore, updateTransactionStatus } from "@/lib/transactions/store";
import {
  clearMemoRegistry,
  registerAccountMemo,
  deriveAndRegisterMemo,
} from "@/lib/stellar/memo";

// Mock store to control getTransaction in tests precisely
vi.mock("@/lib/transactions/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/transactions/store")>();
  let mockStore = new Map<string, any>();

  return {
    ...original,
    getTransaction: vi.fn(async (id: string) => {
      return mockStore.get(id);
    }),
    updateTransactionStatus: vi.fn(async (id: string, status: any) => {
      const tx = mockStore.get(id);
      if (!tx) return null;
      tx.status = status;
      return tx;
    }),
    resetStore: vi.fn(() => {
      mockStore.clear();
      mockStore.set("TXN12345", {
        id: "TXN12345",
        type: "Deposit",
        amount: 100,
        asset: "XLM",
        date: "2026-06-01",
        time: "12:00PM",
        status: "Processing",
      });
      mockStore.set("TXN12346", {
        id: "TXN12346",
        type: "Withdrawal",
        amount: -50,
        asset: "XLM",
        date: "2026-06-01",
        time: "12:00PM",
        status: "Processing",
      });
    }),
  };
});

const TEST_SECRET = "test-webhook-secret-key";

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    event: "transaction.status_updated",
    timestamp: Date.now(),
    nonce: `nonce-${Math.random().toString(36).slice(2)}`,
    data: {
      transaction_id: "TXN12345",
      status: "Completed",
    },
    ...overrides,
  };
}

function makeWebhookRequest(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/webhooks/transactions", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function makeSignedRequest(payload: Record<string, unknown>, secret: string = TEST_SECRET) {
  const body = JSON.stringify(payload);
  const signature = signPayload(body, secret);
  return makeWebhookRequest(body, { [SIGNATURE_HEADER]: signature });
}

describe("Webhook Route - Stellar Memo Enforcement", () => {
  beforeEach(() => {
    vi.stubEnv("WEBHOOK_SECRET", TEST_SECRET);
    vi.stubEnv("STRICT_MEMO_MODE", "false");
    vi.stubEnv("MEMO_SALT", "test-salt");
    clearMemoRegistry();
    resetStore();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("Signature verification (timing-safe)", () => {
    it("returns 401 when signature header is missing", async () => {
      const body = JSON.stringify(makePayload());
      const req = makeWebhookRequest(body);
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 401 when signature header is empty string", async () => {
      const body = JSON.stringify(makePayload());
      const req = makeWebhookRequest(body, { [SIGNATURE_HEADER]: "" });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 401 when signature has wrong length (too short)", async () => {
      const body = JSON.stringify(makePayload());
      const req = makeWebhookRequest(body, { [SIGNATURE_HEADER]: "sha256=abc123" });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 401 when signature has wrong length (too long)", async () => {
      const body = JSON.stringify(makePayload());
      const longHex = "a".repeat(128);
      const req = makeWebhookRequest(body, { [SIGNATURE_HEADER]: `sha256=${longHex}` });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 401 when signature is malformed (invalid hex)", async () => {
      const body = JSON.stringify(makePayload());
      const req = makeWebhookRequest(body, { [SIGNATURE_HEADER]: "sha256=not-valid-hex!!!" });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });

  it("succeeds when valid memo is provided and resolved (Processing -> Completed)", async () => {
    const accountId = "G-USER-ACCOUNT";
    const memo = deriveAndRegisterMemo(accountId, "MEMO_ID");

    const payload = makePayload({
      data: {
        transaction_id: "TXN12345",
        status: "Completed",
        memo: memo.value,
        memo_type: memo.type,
      },
    });

    const res = await POST(makeSignedRequest(payload));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.transaction.status).toBe("Completed");
  });

  it("returns 400 when a malformed memo value is provided", async () => {
    const payload = makePayload({
      data: {
        transaction_id: "TXN12345",
        status: "Completed",
        memo: "not-an-unsigned-int",
        memo_type: "MEMO_ID",
      },
    });

    const res = await POST(makeSignedRequest(payload));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Invalid memo format");
  });

  it("succeeds with unregistered memo in non-strict mode", async () => {
    const payload = makePayload({
      data: {
        transaction_id: "TXN12345",
        status: "Completed",
        memo: "9999999", // Unregistered
        memo_type: "MEMO_ID",
      },
    });

    const res = await POST(makeSignedRequest(payload));
    expect(res.status).toBe(200);
  });

  it("returns 400 for unregistered memo in strict mode", async () => {
    vi.stubEnv("STRICT_MEMO_MODE", "true");

    const payload = makePayload({
      data: {
        transaction_id: "TXN12345",
        status: "Completed",
        memo: "9999999", // Unregistered but valid format
        memo_type: "MEMO_ID",
      },
    });

    const res = await POST(makeSignedRequest(payload));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Strict Mode Rejection: Unknown or unregistered memo");
  });

  it("returns 400 when Deposit transaction lacks a memo in strict mode", async () => {
    vi.stubEnv("STRICT_MEMO_MODE", "true");

    const payload = makePayload({
      data: {
        transaction_id: "TXN12345", // TXN12345 is a "Deposit" type in mock store
        status: "Completed",
      },
    });

    const res = await POST(makeSignedRequest(payload));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Strict Mode Rejection: Inbound deposits must have a valid memo");
  });

  it("succeeds when non-Deposit transaction lacks a memo in strict mode", async () => {
    vi.stubEnv("STRICT_MEMO_MODE", "true");

    const payload = makePayload({
      data: {
        transaction_id: "TXN12346", // TXN12346 is a "Withdrawal" type in mock store
        status: "Completed",
      },
    });

    const res = await POST(makeSignedRequest(payload));
    expect(res.status).toBe(200);
  });
});
