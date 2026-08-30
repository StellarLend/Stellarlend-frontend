/**
 * useChartHistory — authorization and hostile-input boundary tests
 *
 * Covers:
 * - Disconnected wallet: no fetch is issued; state is "unauthorized"
 * - Connecting wallet: treated as disconnected until fully "connected"
 * - Wallet error status: treated as disconnected
 * - Invalid wallet address in authContext: "unauthorized" / "invalid-wallet"
 * - Server returns 401: maps to "unauthorized" / "forbidden" (no retry)
 * - Server returns 403: maps to "unauthorized" / "forbidden" (no retry)
 * - Response walletAddress mismatch: "unauthorized" / "wallet-mismatch"
 * - Response walletAddress is not a valid Stellar account ID: "unauthorized" / "invalid-wallet"
 * - Replay: stale response from prior generation does not mutate state
 * - Wallet disconnect mid-flight: in-progress fetch generation is discarded
 * - Recovery: wallet reconnects after unauthorized → fetch resumes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useChartHistory,
  isChartUnauthorized,
  isChartLoading,
  getSnapshots,
  type ChartAuthContext,
} from "./useChartHistory";

// ─── Constants ────────────────────────────────────────────────────────────────

const TEST_URL = "/api/positions/history?interval=1d";

// A well-formed Stellar public key (56 chars, starts with G, base32)
const VALID_WALLET = "GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBRZKNKBDO";
const OTHER_WALLET = "GBVZM3RXQZQBFMKRG6CTBHQFYWLGTL6BSYAQJY5EXF3PIF7OHQXE3";
const INVALID_WALLET = "not-a-stellar-address";

const CONNECTED_CTX: ChartAuthContext = {
  walletAddress: VALID_WALLET,
  status: "connected",
  network: "TESTNET",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    timestamp: 1_700_000_000_000,
    supplied: 3_000,
    borrowed: 1_000,
    effectiveSupplyApy: 4.5,
    effectiveBorrowApy: 7.0,
    ...overrides,
  };
}

function okResponse(walletAddress = VALID_WALLET, snapshots: unknown[] = [snapshot()]) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      walletAddress,
      snapshots,
      interval: "1d",
      bucketCount: snapshots.length,
    }),
  } as Response;
}

function httpResponse(status: number, statusText = "Error") {
  return {
    ok: false,
    status,
    statusText,
    json: async () => ({}),
  } as unknown as Response;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useChartHistory — auth: disconnected wallet", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("never issues a fetch when status is 'disconnected'", async () => {
    const fetcher = vi.fn();
    const authContext: ChartAuthContext = {
      walletAddress: null,
      status: "disconnected",
      network: "TESTNET",
    };

    const { result } = renderHook(() =>
      useChartHistory(TEST_URL, { fetcher, authContext }),
    );

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe("unauthorized");
    expect(isChartUnauthorized(result.current.state)).toBe(true);
    if (result.current.state.status === "unauthorized") {
      expect(result.current.state.reason).toBe("disconnected-wallet");
    }
  });

  it("never issues a fetch when status is 'connecting'", async () => {
    const fetcher = vi.fn();
    const authContext: ChartAuthContext = {
      walletAddress: null,
      status: "connecting",
      network: "TESTNET",
    };

    const { result } = renderHook(() =>
      useChartHistory(TEST_URL, { fetcher, authContext }),
    );

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe("unauthorized");
    if (result.current.state.status === "unauthorized") {
      expect(result.current.state.reason).toBe("disconnected-wallet");
    }
  });

  it("never issues a fetch when status is 'error'", async () => {
    const fetcher = vi.fn();
    const authContext: ChartAuthContext = {
      walletAddress: null,
      status: "error",
      network: "TESTNET",
    };

    const { result } = renderHook(() =>
      useChartHistory(TEST_URL, { fetcher, authContext }),
    );

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe("unauthorized");
  });

  it("never issues a fetch when walletAddress is null even if status is 'connected'", async () => {
    const fetcher = vi.fn();
    const authContext: ChartAuthContext = {
      walletAddress: null,
      status: "connected",
      network: "TESTNET",
    };

    const { result } = renderHook(() =>
      useChartHistory(TEST_URL, { fetcher, authContext }),
    );

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe("unauthorized");
    if (result.current.state.status === "unauthorized") {
      expect(result.current.state.reason).toBe("disconnected-wallet");
    }
  });
});

describe("useChartHistory — auth: invalid wallet address in context", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("rejects a non-Stellar address with 'invalid-wallet' and issues no fetch", async () => {
    const fetcher = vi.fn();
    const authContext: ChartAuthContext = {
      walletAddress: INVALID_WALLET,
      status: "connected",
      network: "TESTNET",
    };

    const { result } = renderHook(() =>
      useChartHistory(TEST_URL, { fetcher, authContext }),
    );

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe("unauthorized");
    if (result.current.state.status === "unauthorized") {
      expect(result.current.state.reason).toBe("invalid-wallet");
    }
  });
});

describe("useChartHistory — auth: 401 / 403 HTTP responses", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("maps a 401 response to 'unauthorized' / 'forbidden' without retrying", async () => {
    const fetcher = vi.fn().mockResolvedValue(httpResponse(401, "Unauthorized"));

    const { result } = renderHook(() =>
      useChartHistory(TEST_URL, { fetcher, authContext: CONNECTED_CTX }),
    );

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.state.status).toBe("unauthorized");
    if (result.current.state.status === "unauthorized") {
      expect(result.current.state.reason).toBe("forbidden");
    }
    // Must not retry auth failures — only 1 call
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("maps a 403 response to 'unauthorized' / 'forbidden' without retrying", async () => {
    const fetcher = vi.fn().mockResolvedValue(httpResponse(403, "Forbidden"));

    const { result } = renderHook(() =>
      useChartHistory(TEST_URL, { fetcher, authContext: CONNECTED_CTX }),
    );

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.state.status).toBe("unauthorized");
    if (result.current.state.status === "unauthorized") {
      expect(result.current.state.reason).toBe("forbidden");
    }
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("still retries on 5xx responses (not an auth failure)", async () => {
    const fetcher = vi.fn().mockResolvedValue(httpResponse(503, "Service Unavailable"));

    const { result } = renderHook(() =>
      useChartHistory(TEST_URL, { fetcher, authContext: CONNECTED_CTX }),
    );

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.state.status).toBe("error");
    // 1 initial + 3 retries = 4 calls
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});

describe("useChartHistory — auth: response wallet address ownership", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("accepts a response whose walletAddress matches the connected wallet", async () => {
    const fetcher = vi.fn().mockResolvedValue(okResponse(VALID_WALLET));

    const { result } = renderHook(() =>
      useChartHistory(TEST_URL, { fetcher, authContext: CONNECTED_CTX }),
    );

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.state.status).toBe("ready");
    expect(getSnapshots(result.current.state)).toHaveLength(1);
  });

  it("rejects a response whose walletAddress differs from the connected wallet (wallet-mismatch)", async () => {
    const fetcher = vi.fn().mockResolvedValue(okResponse(OTHER_WALLET));

    const { result } = renderHook(() =>
      useChartHistory(TEST_URL, { fetcher, authContext: CONNECTED_CTX }),
    );

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.state.status).toBe("unauthorized");
    if (result.current.state.status === "unauthorized") {
      expect(result.current.state.reason).toBe("wallet-mismatch");
    }
  });

  it("rejects a response whose walletAddress is not a valid Stellar account ID (invalid-wallet)", async () => {
    const fetcher = vi.fn().mockResolvedValue(okResponse(INVALID_WALLET));

    const { result } = renderHook(() =>
      useChartHistory(TEST_URL, { fetcher, authContext: CONNECTED_CTX }),
    );

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.state.status).toBe("unauthorized");
    if (result.current.state.status === "unauthorized") {
      expect(result.current.state.reason).toBe("invalid-wallet");
    }
  });

  it("skips ownership check when no authContext is provided (backward-compatible)", async () => {
    // Response carries a different wallet — but no authContext means no check
    const fetcher = vi.fn().mockResolvedValue(okResponse(OTHER_WALLET));

    const { result } = renderHook(() =>
      useChartHistory(TEST_URL, { fetcher }),
    );

    await act(async () => { await vi.runAllTimersAsync(); });

    // Should succeed — no auth check performed
    expect(result.current.state.status).toBe("ready");
  });
});

describe("useChartHistory — auth: replay / stale response after wallet change", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("discards a slow response from the previous wallet identity (generation counter)", async () => {
    let resolveFirst!: (v: Response) => void;

    const fetcher = vi
      .fn()
      // First call (generation 1, old wallet) — slow
      .mockImplementationOnce(
        () => new Promise<Response>((r) => { resolveFirst = r; }),
      )
      // Second call (generation 2, new wallet) — fast, returns new wallet
      .mockResolvedValueOnce(okResponse(OTHER_WALLET));

    // Start with VALID_WALLET
    const { result, rerender } = renderHook(
      ({ auth }: { auth: ChartAuthContext }) =>
        useChartHistory(TEST_URL, { fetcher, authContext: auth }),
      { initialProps: { auth: CONNECTED_CTX } },
    );

    // Switch wallet — triggers a new generation
    const newCtx: ChartAuthContext = {
      walletAddress: OTHER_WALLET,
      status: "connected",
      network: "TESTNET",
    };

    act(() => { rerender({ auth: newCtx }); });

    // Let the new fetch (gen 2) settle
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.state.status).toBe("ready");
    const snapsAfterRerender = getSnapshots(result.current.state);
    expect(snapsAfterRerender).toHaveLength(1);

    // Now resolve the stale first fetch (gen 1) — state must not change
    await act(async () => {
      resolveFirst(okResponse(VALID_WALLET));
      await vi.runAllTimersAsync();
    });

    // State is unchanged — stale response from old wallet was discarded
    expect(getSnapshots(result.current.state)).toEqual(snapsAfterRerender);
    expect(result.current.state.status).toBe("ready");
  });
});

describe("useChartHistory — auth: wallet disconnect mid-flight", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("transitions to unauthorized when wallet disconnects before response arrives", async () => {
    let resolveFirst!: (v: Response) => void;

    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<Response>((r) => { resolveFirst = r; }),
      );

    const { result, rerender } = renderHook(
      ({ auth }: { auth: ChartAuthContext }) =>
        useChartHistory(TEST_URL, { fetcher, authContext: auth }),
      { initialProps: { auth: CONNECTED_CTX } },
    );

    // Wallet disconnects before the response arrives
    const disconnectedCtx: ChartAuthContext = {
      walletAddress: null,
      status: "disconnected",
      network: "TESTNET",
    };

    act(() => { rerender({ auth: disconnectedCtx }); });

    // Now resolve the response (for the now-superseded generation)
    await act(async () => {
      resolveFirst(okResponse(VALID_WALLET));
      await vi.runAllTimersAsync();
    });

    // The new generation's pre-flight check should fire and set unauthorized
    expect(result.current.state.status).toBe("unauthorized");
    if (result.current.state.status === "unauthorized") {
      expect(result.current.state.reason).toBe("disconnected-wallet");
    }
  });
});

describe("useChartHistory — auth: recovery after unauthorized", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("resumes fetching and reaches 'ready' when wallet reconnects", async () => {
    const fetcher = vi.fn().mockResolvedValue(okResponse(VALID_WALLET));

    const disconnectedCtx: ChartAuthContext = {
      walletAddress: null,
      status: "disconnected",
      network: "TESTNET",
    };

    const { result, rerender } = renderHook(
      ({ auth }: { auth: ChartAuthContext }) =>
        useChartHistory(TEST_URL, { fetcher, authContext: auth }),
      { initialProps: { auth: disconnectedCtx } },
    );

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.state.status).toBe("unauthorized");
    expect(fetcher).not.toHaveBeenCalled();

    // Wallet reconnects
    act(() => { rerender({ auth: CONNECTED_CTX }); });

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.state.status).toBe("ready");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(getSnapshots(result.current.state)).toHaveLength(1);
  });
});

describe("useChartHistory — auth: isChartUnauthorized selector", () => {
  it("returns true only for the 'unauthorized' status", () => {
    expect(isChartUnauthorized({ status: "idle" })).toBe(false);
    expect(isChartUnauthorized({ status: "loading", isStale: false })).toBe(false);
    expect(isChartUnauthorized({ status: "empty", isStale: false })).toBe(false);
    expect(isChartUnauthorized({ status: "ready", isStale: false, snapshots: [] })).toBe(false);
    expect(isChartUnauthorized({ status: "error", isStale: true, error: new Error("x"), snapshots: [] })).toBe(false);
    expect(isChartUnauthorized({ status: "unauthorized", reason: "forbidden" })).toBe(true);
    expect(isChartUnauthorized({ status: "unauthorized", reason: "disconnected-wallet" })).toBe(true);
    expect(isChartUnauthorized({ status: "unauthorized", reason: "wallet-mismatch" })).toBe(true);
    expect(isChartUnauthorized({ status: "unauthorized", reason: "invalid-wallet" })).toBe(true);
  });
});
