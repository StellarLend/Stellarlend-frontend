import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/transactions/route";
import { globalCache } from "@/lib/cache";
import { ASSET_SYMBOLS, TRANSACTION_TYPES, TRANSACTION_STATUSES } from "@/types/enums";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/transactions");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

function makePostRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/transactions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

beforeEach(() => {
  globalCache.clear();
});

// ---------------------------------------------------------------------------
// GET – accepted values
// ---------------------------------------------------------------------------

describe("GET /api/transactions – accepted values", () => {
  it("returns 200 with no filters", async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.transactions)).toBe(true);
  });

  it.each([...ASSET_SYMBOLS])("accepts asset=%s", async (asset) => {
    const res = await GET(makeGetRequest({ asset }));
    expect(res.status).toBe(200);
  });

  it.each([...TRANSACTION_TYPES])("accepts type=%s", async (type) => {
    const res = await GET(makeGetRequest({ type }));
    expect(res.status).toBe(200);
  });

  it.each([...TRANSACTION_STATUSES])("accepts status=%s", async (status) => {
    const res = await GET(makeGetRequest({ status }));
    expect(res.status).toBe(200);
  });

  it("filters by asset correctly", async () => {
    const res = await GET(makeGetRequest({ asset: "XLM" }));
    const { transactions } = await res.json();
    expect(transactions.every((t: { asset: string }) => t.asset === "XLM")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET – rejected values
// ---------------------------------------------------------------------------

describe("GET /api/transactions – rejected values", () => {
  it.each(["STRK", "DOGE", "xlm", ""])(
    "rejects unknown asset=%s with 400",
    async (asset) => {
      const res = await GET(makeGetRequest({ asset }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Unknown asset/);
      expect(body.error).toMatch(ASSET_SYMBOLS.join(", "));
    }
  );

  it.each(["Transfer", "deposit", "DEPOSIT"])(
    "rejects unknown type=%s with 400",
    async (type) => {
      const res = await GET(makeGetRequest({ type }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Unknown type/);
    }
  );

  it.each(["Pending", "completed", "FAILED"])(
    "rejects unknown status=%s with 400",
    async (status) => {
      const res = await GET(makeGetRequest({ status }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Unknown status/);
    }
  );
});

// ---------------------------------------------------------------------------
// POST – accepted values
// ---------------------------------------------------------------------------

const validBody = {
  asset: "XLM",
  type: "Deposit",
  status: "Completed",
  amount: 100,
  date: "2025-01-01",
  time: "09:00AM",
};

describe("POST /api/transactions – accepted values", () => {
  it("creates a transaction with valid body", async () => {
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.transaction).toMatchObject(validBody);
    expect(body.transaction.id).toMatch(/^TXN/);
  });

  it("replays the original response for duplicate idempotency keys", async () => {
    const first = await POST(makePostRequest(validBody, { "Idempotency-Key": "txn-idempotent" }));
    expect(first.status).toBe(201);
    const firstBody = await first.json();

    const duplicate = await POST(makePostRequest(validBody, { "Idempotency-Key": "txn-idempotent" }));
    expect(duplicate.status).toBe(201);
    const duplicateBody = await duplicate.json();

    expect(duplicateBody).toEqual(firstBody);
    expect(duplicateBody.transaction.id).toBe(firstBody.transaction.id);
  });

  it("returns a conflict when the same key is reused with a different payload", async () => {
    const first = await POST(makePostRequest(validBody, { "Idempotency-Key": "txn-conflict" }));
    expect(first.status).toBe(201);

    const conflictingBody = {
      ...validBody,
      amount: 999,
    };

    const conflict = await POST(makePostRequest(conflictingBody, { "Idempotency-Key": "txn-conflict" }));
    expect(conflict.status).toBe(409);

    const conflictBody = await conflict.json();
    expect(conflictBody.error.code).toBe("IDEMPOTENCY_CONFLICT");
    expect(conflictBody.error.message).toContain("txn-conflict");
  });

  it.each([...ASSET_SYMBOLS])("accepts asset=%s", async (asset) => {
    const res = await POST(makePostRequest({ ...validBody, asset }));
    expect(res.status).toBe(201);
  });

  it.each([...TRANSACTION_TYPES])("accepts type=%s", async (type) => {
    const res = await POST(makePostRequest({ ...validBody, type }));
    expect(res.status).toBe(201);
  });

  it.each([...TRANSACTION_STATUSES])("accepts status=%s", async (status) => {
    const res = await POST(makePostRequest({ ...validBody, status }));
    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// POST – rejected values
// ---------------------------------------------------------------------------

describe("POST /api/transactions – rejected values", () => {
  it.each(["STRK", "DOGE", "xlm", null, undefined])(
    "rejects unknown asset=%s with 400",
    async (asset) => {
      const res = await POST(makePostRequest({ ...validBody, asset }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Unknown asset/);
    }
  );

  it.each(["Transfer", "deposit", null])(
    "rejects unknown type=%s with 400",
    async (type) => {
      const res = await POST(makePostRequest({ ...validBody, type }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Unknown type/);
    }
  );

  it.each(["Pending", "completed", null])(
    "rejects unknown status=%s with 400",
    async (status) => {
      const res = await POST(makePostRequest({ ...validBody, status }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Unknown status/);
    }
  );

  it("rejects non-numeric amount with 400", async () => {
    const res = await POST(makePostRequest({ ...validBody, amount: "not-a-number" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/amount/);
  });

  it("rejects missing date with 400", async () => {
    const { date: _d, ...noDate } = validBody;
    const res = await POST(makePostRequest(noDate));
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON with 400", async () => {
    const req = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid JSON/);
  });
});
