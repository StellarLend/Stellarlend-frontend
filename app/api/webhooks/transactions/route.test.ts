import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/webhooks/transactions/route";
import { signPayload } from "@/lib/webhooks/verify";
import { SIGNATURE_HEADER } from "@/lib/webhooks/types";
import { resetStore, getTransaction } from "@/lib/transactions/store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SECRET = "test-webhook-secret-key";

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    event: "transaction.status_updated",
    timestamp: Date.now(),
    nonce: `nonce-${Math.random().toString(36).slice(2)}`,
    data: {
      transaction_id: "TXN12346", // This one has status "Processing" in mock data
      status: "Completed",
    },
    ...overrides,
  };
}

function makeWebhookRequest(
  body: string,
  headers: Record<string, string> = {},
) {
  return new NextRequest("http://localhost/api/webhooks/transactions", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function makeSignedRequest(
  payload: Record<string, unknown>,
  secret: string = TEST_SECRET,
) {
  const body = JSON.stringify(payload);
  const signature = signPayload(body, secret);
  return makeWebhookRequest(body, { [SIGNATURE_HEADER]: signature });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubEnv("WEBHOOK_SECRET", TEST_SECRET);
  resetStore();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/transactions – valid requests", () => {
  it("returns 200 and updates transaction status (Processing → Completed)", async () => {
    const payload = makePayload({
      data: { transaction_id: "TXN12346", status: "Completed" },
    });
    const res = await POST(makeSignedRequest(payload));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.transaction.id).toBe("TXN12346");
    expect(body.transaction.status).toBe("Completed");
  });

  it("returns 200 for Processing → Failed transition", async () => {
    const payload = makePayload({
      data: { transaction_id: "TXN12346", status: "Failed" },
    });
    const res = await POST(makeSignedRequest(payload));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.transaction.status).toBe("Failed");
  });

  it("updates an already-Completed transaction to Failed", async () => {
    const payload = makePayload({
      data: { transaction_id: "TXN12345", status: "Failed" },
    });
    const res = await POST(makeSignedRequest(payload));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.transaction.status).toBe("Failed");
  });
});

// ---------------------------------------------------------------------------
// Signature errors (401)
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/transactions – signature verification", () => {
  it("returns 401 when signature header is missing", async () => {
    const body = JSON.stringify(makePayload());
    const req = makeWebhookRequest(body); // no signature header
    const res = await POST(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toMatch(/signature/i);
  });

  it("returns 401 when signature header is empty string", async () => {
    const body = JSON.stringify(makePayload());
    const req = makeWebhookRequest(body, { [SIGNATURE_HEADER]: "" });
    const res = await POST(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toMatch(/signature/i);
  });

  it("returns 401 when signature is invalid (tampered payload)", async () => {
    const payload = makePayload();
    const body = JSON.stringify(payload);
    const signature = signPayload(body + "tampered", TEST_SECRET);
    const req = makeWebhookRequest(body, { [SIGNATURE_HEADER]: signature });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when signature uses wrong secret", async () => {
    const payload = makePayload();
    const body = JSON.stringify(payload);
    const signature = signPayload(body, "wrong-secret");
    const req = makeWebhookRequest(body, { [SIGNATURE_HEADER]: signature });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when signature has wrong length (too short)", async () => {
    const payload = makePayload();
    const body = JSON.stringify(payload);
    const req = makeWebhookRequest(body, { [SIGNATURE_HEADER]: "sha256=abc123" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when signature has wrong length (too long)", async () => {
    const payload = makePayload();
    const body = JSON.stringify(payload);
    const longHex = "a".repeat(128); // SHA256 hex is 64 chars, this is double
    const req = makeWebhookRequest(body, { [SIGNATURE_HEADER]: `sha256=${longHex}` });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when signature lacks sha256= prefix", async () => {
    const payload = makePayload();
    const body = JSON.stringify(payload);
    const signature = signPayload(body, TEST_SECRET).replace("sha256=", "");
    const req = makeWebhookRequest(body, { [SIGNATURE_HEADER]: signature });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when signature is malformed (invalid hex)", async () => {
    const payload = makePayload();
    const body = JSON.stringify(payload);
    const req = makeWebhookRequest(body, { [SIGNATURE_HEADER]: "sha256=not-valid-hex!!!" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Timestamp errors (403)
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/transactions – timestamp validation", () => {
  it("returns 403 when timestamp is too old", async () => {
    const payload = makePayload({
      timestamp: Date.now() - 6 * 60 * 1000, // 6 minutes ago
    });
    const res = await POST(makeSignedRequest(payload));
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toMatch(/timestamp/i);
  });

  it("returns 403 when timestamp is too far in the future", async () => {
    const payload = makePayload({
      timestamp: Date.now() + 6 * 60 * 1000, // 6 minutes ahead
    });
    const res = await POST(makeSignedRequest(payload));
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Replay protection (409)
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/transactions – replay protection", () => {
  it("returns 409 on duplicate nonce", async () => {
    const payload = makePayload({ nonce: "duplicate-nonce-123" });

    // First request succeeds
    const res1 = await POST(makeSignedRequest(payload));
    expect(res1.status).toBe(200);

    // Second request with same nonce is rejected
    const res2 = await POST(makeSignedRequest(payload));
    expect(res2.status).toBe(409);

    const body = await res2.json();
    expect(body.error).toMatch(/already processed/i);
  });
});

// ---------------------------------------------------------------------------
// Payload validation errors (400)
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/transactions – payload validation", () => {
  it("returns 400 for malformed JSON", async () => {
    const body = "not-json{{{";
    const signature = signPayload(body, TEST_SECRET);
    const req = makeWebhookRequest(body, { [SIGNATURE_HEADER]: signature });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toMatch(/Invalid JSON/i);
  });

  it("returns 400 for unsupported event type", async () => {
    const payload = makePayload({ event: "unknown.event" });
    const res = await POST(makeSignedRequest(payload));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/Unsupported event/i);
  });

  it("returns 400 when timestamp field is missing", async () => {
    const payload = makePayload();
    delete (payload as Record<string, unknown>).timestamp;
    const res = await POST(makeSignedRequest(payload));
    expect(res.status).toBe(400);
  });

  it("returns 400 when nonce field is missing", async () => {
    const payload = makePayload({ nonce: "" });
    const res = await POST(makeSignedRequest(payload));
    expect(res.status).toBe(400);
  });

  it("returns 400 when data.transaction_id is missing", async () => {
    const payload = makePayload({ data: { status: "Completed" } });
    const res = await POST(makeSignedRequest(payload));
    expect(res.status).toBe(400);
  });

  it("returns 400 for unknown status value", async () => {
    const payload = makePayload({
      data: { transaction_id: "TXN12346", status: "Pending" },
    });
    const res = await POST(makeSignedRequest(payload));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/Unknown status/);
  });
});

// ---------------------------------------------------------------------------
// Transaction not found (404)
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/transactions – transaction lookup", () => {
  it("returns 404 when transaction ID does not exist", async () => {
    const payload = makePayload({
      data: { transaction_id: "TXN99999", status: "Completed" },
    });
    const res = await POST(makeSignedRequest(payload));
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// Server misconfiguration (500)
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/transactions – server configuration", () => {
  it("returns 500 when WEBHOOK_SECRET is not set", async () => {
    vi.stubEnv("WEBHOOK_SECRET", "");

    const payload = makePayload();
    const body = JSON.stringify(payload);
    const req = makeWebhookRequest(body);
    const res = await POST(req);
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error).toMatch(/not configured/i);
  });
});

// ---------------------------------------------------------------------------
// Body read error (400)
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/transactions – body read error", () => {
  it("returns 400 when reading request body fails", async () => {
    const req = new NextRequest("http://localhost/api/webhooks/transactions", {
      method: "POST",
    });
    vi.spyOn(req, "text").mockRejectedValue(new Error("Simulated stream read error"));
    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/Unable to read request body/i);
  });
});

// ---------------------------------------------------------------------------
// Transaction Store - getTransaction
// ---------------------------------------------------------------------------

describe("Transaction store - getTransaction", () => {
  it("retrieves a transaction that exists", async () => {
    const tx = await getTransaction("TXN12346");
    expect(tx).toBeDefined();
    expect(tx?.id).toBe("TXN12346");
  });

  it("returns undefined for a transaction that does not exist", async () => {
    const tx = await getTransaction("TXN99999");
    expect(tx).toBeUndefined();
  });
});
