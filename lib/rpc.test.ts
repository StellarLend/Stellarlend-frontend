import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRpc, parseRpcFallbackUrls, RpcError, validateRpcUrl } from "./rpc";

describe("validateRpcUrl", () => {
  it("allows valid https URL in production", () => {
    expect(validateRpcUrl("https://soroban-testnet.stellar.org", true)).toBe(
      "https://soroban-testnet.stellar.org"
    );
  });

  it("allows localhost in production", () => {
    expect(validateRpcUrl("http://localhost:8000", true)).toBe("http://localhost:8000");
    expect(validateRpcUrl("http://127.0.0.1:8000", true)).toBe("http://127.0.0.1:8000");
  });

  it("throws for non-https non-localhost in production", () => {
    expect(() => validateRpcUrl("http://insecure-rpc.example.com", true)).toThrow(
      /Non-HTTPS RPC URL in production/
    );
  });

  it("allows http in development", () => {
    expect(validateRpcUrl("http://insecure-rpc.example.com", false)).toBe(
      "http://insecure-rpc.example.com"
    );
  });

  it("throws on empty or invalid URL", () => {
    expect(() => validateRpcUrl("")).toThrow(/must not be empty/);
    expect(() => validateRpcUrl("not-a-valid-url")).toThrow(/Invalid RPC URL/);
  });
});

describe("createRpc", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("success on primary URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        result: { status: "SUCCESS", ledger: 12345 },
      }),
    });

    const rpc = createRpc({
      urls: ["https://primary-rpc.example.com", "https://fallback-rpc.example.com"],
      fetchFn: mockFetch as unknown as typeof fetch,
      isProduction: false,
    });

    const result = await rpc.request<{ status: string; ledger: number }>({
      method: "getHealth",
    });

    expect(result).toEqual({ status: "SUCCESS", ledger: 12345 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://primary-rpc.example.com",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("timeout (>8s) -> fails over to fallback URL", async () => {
    const mockFetch = vi
      .fn()
      // First call aborts due to timeout
      .mockImplementationOnce((_url, init) => {
        return new Promise((_resolve, reject) => {
          if (init?.signal) {
            init.signal.addEventListener("abort", () => {
              reject(new Error("RPC request timeout after 10ms"));
            });
          }
        });
      })
      // Second call succeeds
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: { status: "FALLBACK_SUCCESS" },
        }),
      });

    const rpc = createRpc({
      urls: ["https://primary-rpc.example.com", "https://fallback-rpc.example.com"],
      timeoutMs: 10,
      fetchFn: mockFetch as unknown as typeof fetch,
      isProduction: false,
    });

    const result = await rpc.request<{ status: string }>({ method: "getHealth" });

    expect(result).toEqual({ status: "FALLBACK_SUCCESS" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://primary-rpc.example.com",
      expect.anything()
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://fallback-rpc.example.com",
      expect.anything()
    );
  });

  it("fails over on 503", async () => {
    const mockFetch = vi
      .fn()
      // First call 503 Service Unavailable
      .mockResolvedValueOnce({
        status: 503,
        ok: false,
        statusText: "Service Unavailable",
        text: async () => "Service Unavailable",
      })
      // Second call 200 OK
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: { version: "20.0.0" },
        }),
      });

    const rpc = createRpc({
      urls: ["https://primary-rpc.example.com", "https://fallback-rpc.example.com"],
      fetchFn: mockFetch as unknown as typeof fetch,
      isProduction: false,
    });

    const res = await rpc.request<{ version: string }>({ method: "getVersion" });

    expect(res).toEqual({ version: "20.0.0" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("4xx client error -> does NOT fail over to next URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 400,
      ok: false,
      statusText: "Bad Request",
      text: async () => "Invalid JSON payload",
    });

    const rpc = createRpc({
      urls: ["https://primary-rpc.example.com", "https://fallback-rpc.example.com"],
      fetchFn: mockFetch as unknown as typeof fetch,
      isProduction: false,
    });

    await expect(rpc.request({ method: "badMethod" })).rejects.toThrow(RpcError);
    await expect(rpc.request({ method: "badMethod" })).rejects.toThrow(/HTTP 400/);
    expect(mockFetch).toHaveBeenCalledTimes(2); // 2 distinct calls from the 2 expect assertions, 1 fetch each
  });

  it("does not fail over on simulation error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: -32000,
          message: "Transaction simulation failed: Error(Contract, #123)",
        },
      }),
    });

    const rpc = createRpc({
      urls: ["https://primary-rpc.example.com", "https://fallback-rpc.example.com"],
      fetchFn: mockFetch as unknown as typeof fetch,
      isProduction: false,
    });

    let thrownError: RpcError | null = null;
    try {
      await rpc.request({ method: "simulateTransaction" });
    } catch (err) {
      thrownError = err as RpcError;
    }

    expect(thrownError).toBeInstanceOf(RpcError);
    expect(thrownError?.isSimulationError).toBe(true);
    // Should NOT have attempted fallback URL
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("all endpoints failing yields a typed RpcError", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network failure 1"))
      .mockRejectedValueOnce(new Error("Network failure 2"));

    const rpc = createRpc({
      urls: ["https://rpc1.example.com", "https://rpc2.example.com"],
      fetchFn: mockFetch as unknown as typeof fetch,
      isProduction: false,
    });

    let thrownError: RpcError | null = null;
    try {
      await rpc.request({ method: "getHealth" });
    } catch (e) {
      thrownError = e as RpcError;
    }

    expect(thrownError).toBeInstanceOf(RpcError);
    expect(thrownError?.message).toContain("All RPC endpoints failed");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("aborts when caller signal triggers", async () => {
    const controller = new AbortController();
    controller.abort(new Error("Cancelled by caller"));

    const mockFetch = vi.fn();
    const rpc = createRpc({
      urls: ["https://primary-rpc.example.com"],
      fetchFn: mockFetch as unknown as typeof fetch,
      isProduction: false,
    });

    await expect(
      rpc.request({ method: "getHealth" }, { signal: controller.signal })
    ).rejects.toThrow("Cancelled by caller");

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("createRpc endpoint ordering", () => {
  const ok = (result: unknown) => ({
    status: 200,
    ok: true,
    json: async () => ({ jsonrpc: "2.0", id: 1, result }),
  });
  const down = {
    status: 503,
    ok: false,
    statusText: "Service Unavailable",
    text: async () => "Service Unavailable",
  };
  const urls = [
    "https://primary-rpc.example.com",
    "https://fallback-a.example.com",
    "https://fallback-b.example.com",
  ];

  it("tries the primary first, then fallbacks in configured order", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(down)
      .mockResolvedValueOnce(down)
      .mockResolvedValueOnce(ok({ status: "healthy" }));

    const rpc = createRpc({ urls, fetchFn: mockFetch as unknown as typeof fetch, isProduction: false });
    await expect(rpc.request({ method: "getHealth" })).resolves.toEqual({ status: "healthy" });

    expect(mockFetch.mock.calls.map((c) => c[0])).toEqual(urls);
  });

  it("sticks to the fallback that succeeded for later requests", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(down) // primary down
      .mockResolvedValueOnce(ok(1)) // fallback A answers
      .mockResolvedValueOnce(ok(2)); // next request goes straight to fallback A

    const rpc = createRpc({ urls, fetchFn: mockFetch as unknown as typeof fetch, isProduction: false });
    expect(rpc.activeUrl).toBe(urls[0]);

    await rpc.request({ method: "getHealth" });
    expect(rpc.activeUrl).toBe(urls[1]);

    await rpc.request({ method: "getHealth" });
    expect(mockFetch.mock.calls.map((c) => c[0])).toEqual([urls[0], urls[1], urls[1]]);
  });

  it("falls back to configured order when the sticky endpoint later fails", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(down) // 1st request: primary down
      .mockResolvedValueOnce(ok("a")) // 1st request: fallback A ok -> sticky
      .mockResolvedValueOnce(down) // 2nd request: sticky fallback A now down
      .mockResolvedValueOnce(ok("primary")); // 2nd request: primary (configured order) recovers

    const rpc = createRpc({ urls, fetchFn: mockFetch as unknown as typeof fetch, isProduction: false });
    await rpc.request({ method: "getHealth" });
    await expect(rpc.request({ method: "getHealth" })).resolves.toBe("primary");

    expect(mockFetch.mock.calls.map((c) => c[0])).toEqual([urls[0], urls[1], urls[1], urls[0]]);
    expect(rpc.activeUrl).toBe(urls[0]);
  });

  it("keeps the current endpoint when a simulation error is returned", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(down)
      .mockResolvedValueOnce(ok("a"))
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          error: { code: -32000, message: "Transaction simulation failed" },
        }),
      });

    const rpc = createRpc({ urls, fetchFn: mockFetch as unknown as typeof fetch, isProduction: false });
    await rpc.request({ method: "getHealth" });
    await expect(rpc.request({ method: "simulateTransaction" })).rejects.toMatchObject({
      isSimulationError: true,
    });

    expect(mockFetch).toHaveBeenCalledTimes(3); // no failover attempt for the simulation error
    expect(rpc.activeUrl).toBe(urls[1]);
  });
});

describe("parseRpcFallbackUrls", () => {
  it("returns an empty list for unset or blank input", () => {
    expect(parseRpcFallbackUrls(undefined)).toEqual([]);
    expect(parseRpcFallbackUrls("")).toEqual([]);
    expect(parseRpcFallbackUrls(" , ,, ")).toEqual([]);
  });

  it("trims entries, drops empties, strips trailing slashes and removes duplicates in order", () => {
    expect(
      parseRpcFallbackUrls(" https://a.example/ ,https://b.example,, https://a.example ,https://c.example//")
    ).toEqual(["https://a.example", "https://b.example", "https://c.example"]);
  });
});
