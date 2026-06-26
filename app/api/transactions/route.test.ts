import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/transactions/route";
import { globalCache } from "@/lib/cache";
import { ASSET_SYMBOLS, TRANSACTION_TYPES, TRANSACTION_STATUSES } from "@/types/enums";

vi.mock("@/lib/db", () => ({
  db: {},
}));

vi.mock("@/lib/indexer", () => ({
  indexAccountTransactions: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/transactions/store", () => ({
  getTransaction: vi.fn(),
}));

vi.mock("@/lib/transactions/repository", async () => {
  const { paginateTransactionsByCursor } = await import("@/lib/transactions/cursor-pagination");

  return {
    paginateTransactionsByCursor,
    filterTransactions: (transactions: any[], filters: any) => transactions.filter((transaction) => {
      if (filters.search) {
        const query = String(filters.search).toLowerCase();
        const matches =
          transaction.type.toLowerCase().includes(query) ||
          transaction.id.toLowerCase().includes(query) ||
          transaction.asset.toLowerCase().includes(query) ||
          transaction.amount.toString().includes(query);
        if (!matches) return false;
      }
      if (filters.status && filters.status !== "All" && transaction.status !== filters.status) return false;
      if (filters.dateFrom && new Date(transaction.date) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(transaction.date) > new Date(filters.dateTo)) return false;
      return true;
    }),
    fetchTransactionRecords: vi.fn(async () => [
      { id: "TXN12345", type: "Deposit", amount: 2000, asset: "XLM", date: "2025-04-12", time: "09:32AM", status: "Completed" },
      { id: "TXN12346", type: "Loan Payment", amount: -250, asset: "BTC", date: "2025-03-10", time: "11:15AM", status: "Processing" },
      { id: "TXN12347", type: "Withdrawal", amount: -7500, asset: "USDC", date: "2025-02-28", time: "04:45PM", status: "Completed" },
      { id: "TXN12348", type: "Lend Funds", amount: -1500, asset: "XLM", date: "2025-01-05", time: "08:00AM", status: "Completed" },
      { id: "TXN12349", type: "Lend Funds", amount: -607.87, asset: "BTC", date: "2024-12-20", time: "10:20PM", status: "Failed" },
      { id: "TXN12350", type: "Deposit", amount: 20000, asset: "ETH", date: "2024-11-15", time: "01:05PM", status: "Completed" },
    ]),
  };
});


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

  it("supports pagination parameters", async () => {
    const res = await GET(makeGetRequest({ page: "2", pageSize: "2" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transactions).toHaveLength(2);
    expect(body.total).toBeGreaterThanOrEqual(2);
  });

  it("filters by asset correctly", async () => {
    const res = await GET(makeGetRequest({ asset: "XLM" }));
    const { transactions } = await res.json();
    expect(transactions.every((t: { asset: string }) => t.asset === "XLM")).toBe(true);
  });

  it("supports cursor pagination and emits next/prev cursors", async () => {
    const first = await GET(makeGetRequest({ limit: "2", sortDir: "asc" }));
    expect(first.status).toBe(200);
    const firstBody = await first.json();

    expect(firstBody.transactions.map((t: { id: string }) => t.id)).toEqual(["TXN12350", "TXN12349"]);
    expect(firstBody.prevCursor).toBeNull();
    expect(firstBody.nextCursor).toEqual(expect.any(String));

    const second = await GET(makeGetRequest({ cursor: firstBody.nextCursor, limit: "2", sortDir: "asc" }));
    expect(second.status).toBe(200);
    const secondBody = await second.json();

    expect(secondBody.transactions.map((t: { id: string }) => t.id)).toEqual(["TXN12348", "TXN12347"]);
    expect(secondBody.prevCursor).toEqual(expect.any(String));
  });

  it("uses prevCursor for reverse cursor iteration", async () => {
    const first = await GET(makeGetRequest({ limit: "2", sortDir: "asc" }));
    const firstBody = await first.json();
    const second = await GET(makeGetRequest({ cursor: firstBody.nextCursor, limit: "2", sortDir: "asc" }));
    const secondBody = await second.json();

    const previous = await GET(makeGetRequest({ cursor: secondBody.prevCursor, limit: "2", sortDir: "asc" }));
    expect(previous.status).toBe(200);
    const previousBody = await previous.json();

    expect(previousBody.transactions.map((t: { id: string }) => t.id)).toEqual(["TXN12350", "TXN12349"]);
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


  it("rejects malformed cursor pagination values", async () => {
    const res = await GET(makeGetRequest({ cursor: "invalid", limit: "2" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/cursor/);
  });

  it("rejects cursor pagination with amount sorting", async () => {
    const res = await GET(makeGetRequest({ limit: "2", sortBy: "amount" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sortBy=date/);
  });
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
