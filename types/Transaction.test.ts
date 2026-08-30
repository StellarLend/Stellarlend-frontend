import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchTransactions, FetchTransactionsOptions } from "./Transaction";

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response;
}

function errorResponse(status: number, statusText = "Error") {
  return {
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve({ error: statusText }),
  } as Response;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function lastFetchUrl(): string {
  return mockFetch.mock.calls[0][0] as string;
}

function lastFetchInit(): RequestInit {
  return mockFetch.mock.calls[0][1] as RequestInit;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchTransactions", () => {
  // -------------------------------------------------------------------------
  // Query-param serialization
  // -------------------------------------------------------------------------

  describe("query param serialization", () => {
    it("requests /api/transactions with no query string when params are empty", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({});

      expect(lastFetchUrl()).toBe("/api/transactions");
    });

    it("requests /api/transactions with no query string when params is omitted", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions();

      expect(lastFetchUrl()).toBe("/api/transactions");
    });

    it("sets page and pageSize", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({ page: 2, pageSize: 25 });

      const url = lastFetchUrl();
      expect(url).toContain("page=2");
      expect(url).toContain("pageSize=25");
    });

    it("sets cursor and limit", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({ cursor: "abc123", limit: 50 });

      const url = lastFetchUrl();
      expect(url).toContain("cursor=abc123");
      expect(url).toContain("limit=50");
    });

    it("sets search, status, type, and asset", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({
        search: "hello world",
        status: "Completed",
        type: "Deposit",
        asset: "XLM",
      });

      const url = lastFetchUrl();
      expect(url).toContain("search=hello+world");
      expect(url).toContain("status=Completed");
      expect(url).toContain("type=Deposit");
      expect(url).toContain("asset=XLM");
    });

    it("sets dateFrom and dateTo", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({
        dateFrom: "2025-01-01",
        dateTo: "2025-12-31",
      });

      const url = lastFetchUrl();
      expect(url).toContain("dateFrom=2025-01-01");
      expect(url).toContain("dateTo=2025-12-31");
    });

    it("sets sortBy and sortDir", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({ sortBy: "amount", sortDir: "desc" });

      const url = lastFetchUrl();
      expect(url).toContain("sortBy=amount");
      expect(url).toContain("sortDir=desc");
    });

    it("serializes all params together", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({
        page: 1,
        pageSize: 10,
        search: "loan",
        status: "Processing",
        type: "Loan Payment",
        asset: "USDC",
        dateFrom: "2025-06-01",
        dateTo: "2025-06-30",
        sortBy: "date",
        sortDir: "asc",
      });

      const url = lastFetchUrl();
      const queryString = url.split("?")[1];
      const params = new URLSearchParams(queryString);

      expect(params.get("page")).toBe("1");
      expect(params.get("pageSize")).toBe("10");
      expect(params.get("search")).toBe("loan");
      expect(params.get("status")).toBe("Processing");
      expect(params.get("type")).toBe("Loan Payment");
      expect(params.get("asset")).toBe("USDC");
      expect(params.get("dateFrom")).toBe("2025-06-01");
      expect(params.get("dateTo")).toBe("2025-06-30");
      expect(params.get("sortBy")).toBe("date");
      expect(params.get("sortDir")).toBe("asc");
    });

    // -----------------------------------------------------------------------
    // Omission of undefined / null values
    // -----------------------------------------------------------------------

    it("omits undefined values from the query string", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({
        page: 3,
        pageSize: undefined,
        search: undefined,
      });

      const url = lastFetchUrl();
      expect(url).toContain("page=3");
      expect(url).not.toContain("pageSize");
      expect(url).not.toContain("search");
    });

    it("omits null values from the query string", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({
        page: 1,
        status: null as unknown as undefined,
        asset: null as unknown as undefined,
      });

      const url = lastFetchUrl();
      expect(url).toContain("page=1");
      expect(url).not.toContain("status");
      expect(url).not.toContain("asset");
    });

    it("omits both undefined and null values while keeping defined values", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({
        page: 1,
        pageSize: undefined,
        cursor: null as unknown as undefined,
        search: "test",
        status: undefined,
        type: null as unknown as undefined,
      });

      const url = lastFetchUrl();
      const queryString = url.split("?")[1];
      const params = new URLSearchParams(queryString);

      expect(params.get("page")).toBe("1");
      expect(params.get("search")).toBe("test");
      expect(params.has("pageSize")).toBe(false);
      expect(params.has("cursor")).toBe(false);
      expect(params.has("status")).toBe(false);
      expect(params.has("type")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Fetch options
  // -------------------------------------------------------------------------

  describe("fetch options", () => {
    it("uses cache: no-store", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({});

      expect(lastFetchInit()).toEqual({ cache: "no-store" });
    });
  });

  // -------------------------------------------------------------------------
  // Response handling
  // -------------------------------------------------------------------------

  describe("response handling", () => {
    it("returns the parsed response body", async () => {
      const body = {
        transactions: [
          {
            id: "1",
            type: "Deposit",
            amount: 100,
            asset: "XLM",
            date: "2025-06-15",
            time: "10:30",
            status: "Completed",
          },
        ],
        total: 1,
        nextCursor: "cursor-abc",
        prevCursor: null,
      };

      mockFetch.mockResolvedValue(okResponse(body));

      const result = await fetchTransactions({ page: 1 });

      expect(result).toEqual(body);
    });

    it("returns empty transactions array when none exist", async () => {
      const body = { transactions: [], total: 0, nextCursor: null, prevCursor: null };
      mockFetch.mockResolvedValue(okResponse(body));

      const result = await fetchTransactions({});

      expect(result.transactions).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe("error handling", () => {
    it("rejects with a clear error on 500 response", async () => {
      mockFetch.mockResolvedValue(errorResponse(500, "Internal Server Error"));

      await expect(fetchTransactions({})).rejects.toThrow(
        "Failed to load transactions: 500",
      );
    });

    it("rejects with a clear error on 404 response", async () => {
      mockFetch.mockResolvedValue(errorResponse(404, "Not Found"));

      await expect(fetchTransactions({ page: 1 })).rejects.toThrow(
        "Failed to load transactions: 404",
      );
    });

    it("rejects with a clear error on 400 response", async () => {
      mockFetch.mockResolvedValue(errorResponse(400, "Bad Request"));

      await expect(fetchTransactions({ pageSize: -1 })).rejects.toThrow(
        "Failed to load transactions: 400",
      );
    });

    it("rejects with a clear error on 401 response", async () => {
      mockFetch.mockResolvedValue(errorResponse(401, "Unauthorized"));

      await expect(fetchTransactions({})).rejects.toThrow(
        "Failed to load transactions: 401",
      );
    });

    it("rejects with a clear error on 403 response", async () => {
      mockFetch.mockResolvedValue(errorResponse(403, "Forbidden"));

      await expect(fetchTransactions({})).rejects.toThrow(
        "Failed to load transactions: 403",
      );
    });

    it("rejects when fetch itself throws (network error)", async () => {
      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(fetchTransactions({})).rejects.toThrow("Failed to fetch");
    });
  });
});
