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

    it("rejects on 429 Too Many Requests", async () => {
      mockFetch.mockResolvedValue(errorResponse(429, "Too Many Requests"));

      await expect(fetchTransactions({})).rejects.toThrow(
        "Failed to load transactions: 429",
      );
    });

    it("rejects on 503 Service Unavailable", async () => {
      mockFetch.mockResolvedValue(errorResponse(503, "Service Unavailable"));

      await expect(fetchTransactions({})).rejects.toThrow(
        "Failed to load transactions: 503",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Boundary / edge-case inputs
  // -------------------------------------------------------------------------

  describe("boundary and edge-case inputs", () => {
    it("serializes page=0 as a query param (boundary: zero-indexed page)", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({ page: 0 });

      expect(lastFetchUrl()).toContain("page=0");
    });

    it("serializes page=1 (first page)", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({ page: 1 });

      expect(lastFetchUrl()).toContain("page=1");
    });

    it("serializes very large page numbers without overflow", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({ page: 999999 });

      expect(lastFetchUrl()).toContain("page=999999");
    });

    it("serializes pageSize=1 (minimum realistic page size)", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({ pageSize: 1 });

      expect(lastFetchUrl()).toContain("pageSize=1");
    });

    it("serializes negative pageSize (validation responsibility of server, not client)", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({ pageSize: -1 });

      expect(lastFetchUrl()).toContain("pageSize=-1");
    });

    it("serializes limit=0", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({ limit: 0 });

      expect(lastFetchUrl()).toContain("limit=0");
    });

    it("omits empty-string values — empty string is falsy but not undefined/null", async () => {
      // Empty strings ARE defined values and should be serialized as-is;
      // the current implementation uses `!== undefined && !== null` so "" is kept.
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({ search: "" });

      // "" is a defined, non-null value: it must appear in the URL
      expect(lastFetchUrl()).toContain("search=");
    });

    it("serializes a cursor containing special URL characters correctly", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      // URLSearchParams automatically percent-encodes values
      await fetchTransactions({ cursor: "abc/def?x=1&y=2" });

      const params = new URLSearchParams(lastFetchUrl().split("?")[1]);
      expect(params.get("cursor")).toBe("abc/def?x=1&y=2");
    });

    it("serializes a search term containing spaces", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({ search: "Lend Funds" });

      const params = new URLSearchParams(lastFetchUrl().split("?")[1]);
      expect(params.get("search")).toBe("Lend Funds");
    });

    it("does not produce a trailing '?' when all params are undefined", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({
        page: undefined,
        pageSize: undefined,
        cursor: undefined,
        search: undefined,
      });

      expect(lastFetchUrl()).toBe("/api/transactions");
      expect(lastFetchUrl()).not.toContain("?");
    });

    it("does not produce a trailing '?' when params object is empty", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      await fetchTransactions({});

      expect(lastFetchUrl()).not.toContain("?");
    });
  });

  // -------------------------------------------------------------------------
  // Concurrent invocations
  // -------------------------------------------------------------------------

  describe("concurrent invocations", () => {
    it("each concurrent call fetches its own URL independently", async () => {
      // Simulate two simultaneous calls with different params
      mockFetch
        .mockResolvedValueOnce(okResponse({ transactions: [], total: 0 }))
        .mockResolvedValueOnce(okResponse({ transactions: [], total: 0 }));

      await Promise.all([
        fetchTransactions({ page: 1 }),
        fetchTransactions({ page: 2 }),
      ]);

      expect(mockFetch).toHaveBeenCalledTimes(2);

      const urls = mockFetch.mock.calls.map((c) => c[0] as string);
      expect(urls.some((u) => u.includes("page=1"))).toBe(true);
      expect(urls.some((u) => u.includes("page=2"))).toBe(true);
    });

    it("a failure in one concurrent call does not affect the other", async () => {
      mockFetch
        .mockResolvedValueOnce(okResponse({ transactions: [], total: 42 }))
        .mockResolvedValueOnce(errorResponse(500));

      const [success, failure] = await Promise.allSettled([
        fetchTransactions({ page: 1 }),
        fetchTransactions({ page: 2 }),
      ]);

      expect(success.status).toBe("fulfilled");
      if (success.status === "fulfilled") {
        expect(success.value.total).toBe(42);
      }

      expect(failure.status).toBe("rejected");
      if (failure.status === "rejected") {
        expect((failure.reason as Error).message).toContain(
          "Failed to load transactions: 500",
        );
      }
    });

    it("multiple calls do not share or pollute each other's query params", async () => {
      mockFetch
        .mockResolvedValueOnce(okResponse({ transactions: [], total: 0 }))
        .mockResolvedValueOnce(okResponse({ transactions: [], total: 0 }))
        .mockResolvedValueOnce(okResponse({ transactions: [], total: 0 }));

      await Promise.all([
        fetchTransactions({ asset: "XLM" }),
        fetchTransactions({ asset: "USDC" }),
        fetchTransactions({ asset: "BTC" }),
      ]);

      const urls = mockFetch.mock.calls.map((c) => c[0] as string);
      const xlm = urls.find((u) => u.includes("asset=XLM"));
      const usdc = urls.find((u) => u.includes("asset=USDC"));
      const btc = urls.find((u) => u.includes("asset=BTC"));

      expect(xlm).toBeDefined();
      expect(usdc).toBeDefined();
      expect(btc).toBeDefined();

      // Each URL should only contain its own asset param
      expect(xlm).not.toContain("USDC");
      expect(usdc).not.toContain("XLM");
      expect(btc).not.toContain("XLM");
    });
  });

  // -------------------------------------------------------------------------
  // Regression: returned response shape
  // -------------------------------------------------------------------------

  describe("response shape regression", () => {
    it("passes through nextCursor and prevCursor when both are present", async () => {
      const body = {
        transactions: [],
        total: 100,
        nextCursor: "next-abc",
        prevCursor: "prev-xyz",
      };
      mockFetch.mockResolvedValue(okResponse(body));

      const result = await fetchTransactions({ cursor: "current" });

      expect(result.nextCursor).toBe("next-abc");
      expect(result.prevCursor).toBe("prev-xyz");
    });

    it("passes through null nextCursor (last page)", async () => {
      const body = {
        transactions: [],
        total: 5,
        nextCursor: null,
        prevCursor: "prev-abc",
      };
      mockFetch.mockResolvedValue(okResponse(body));

      const result = await fetchTransactions({});

      expect(result.nextCursor).toBeNull();
    });

    it("passes through total=0 correctly", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 0 }),
      );

      const result = await fetchTransactions({});

      expect(result.total).toBe(0);
    });

    it("passes through a large total without truncation", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ transactions: [], total: 1_000_000 }),
      );

      const result = await fetchTransactions({});

      expect(result.total).toBe(1_000_000);
    });
  });
});
