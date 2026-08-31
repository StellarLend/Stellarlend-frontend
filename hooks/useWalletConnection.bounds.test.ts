/**
 * Focused tests for the bounded-performance and telemetry additions to
 * useWalletConnection:
 *
 *  - Rehydration deduplication (one fetch per hook instance)
 *  - Session-fetch timeout → telemetry + disconnected state
 *  - Abort on unmount (no state update after cleanup)
 *  - Concurrent connect guard → only one connect proceeds
 *  - Connect timeout → error state + telemetry
 *  - Telemetry emission for all paths (rehydration, connect, disconnect)
 *  - Address sanitization in telemetry error messages
 *  - isLoading transitions correctly around rehydration
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { useWalletConnection } from "./useWalletConnection";
import {
  getWalletTelemetryService,
  _resetWalletTelemetryService,
  WALLET_BOUNDS,
} from "@/lib/telemetry/walletTelemetry";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_ADDRESS = "GAUFVBMULU2CJRE5IGVPEOXRYZGU5YDAOSQ3UQTBM3Y7ARUPFSXZUHN5";

function sessionBody(walletAddress = TEST_ADDRESS, network = "TESTNET") {
  return {
    session: {
      active: true,
      network,
      user: { walletAddress },
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  };
}

function mockOk(body: unknown = {}, status = 200): Response {
  return { ok: true, status, json: async () => body } as Response;
}

function mockFail(status = 500, body: unknown = {}): Response {
  return { ok: false, status, json: async () => body } as Response;
}

function setupStellar(pubKey = TEST_ADDRESS) {
  (window as any).stellar = {
    getPublicKey: vi.fn().mockResolvedValue(pubKey),
    signTransaction: vi.fn().mockResolvedValue("signed-xdr"),
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  vi.stubGlobal("fetch", vi.fn());
  sessionStorage.clear();
  _resetWalletTelemetryService();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  (window as any).stellar = undefined;
  _resetWalletTelemetryService();
});

// ---------------------------------------------------------------------------
// Rehydration deduplication
// ---------------------------------------------------------------------------

describe("rehydration deduplication", () => {
  it("calls /api/auth/session exactly once per hook instance", async () => {
    vi.mocked(fetch).mockResolvedValue(mockFail());

    const { result } = renderHook(() => useWalletConnection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("a new hook instance fetches once independently", async () => {
    vi.mocked(fetch).mockResolvedValue(mockFail());

    const { unmount } = renderHook(() => useWalletConnection());
    await waitFor(() => {});
    unmount();

    vi.mocked(fetch).mockResolvedValue(mockFail());
    const { result } = renderHook(() => useWalletConnection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Session-fetch timeout
// ---------------------------------------------------------------------------

describe("session fetch timeout", () => {
  it("records session_fetch_timeout and leaves status disconnected", async () => {
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useWalletConnection());

    await act(async () => {
      vi.advanceTimersByTime(WALLET_BOUNDS.SESSION_FETCH_TIMEOUT_MS + 100);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.status).toBe("disconnected");
    expect(result.current.isConnected).toBe(false);

    const events = getWalletTelemetryService().getEvents();
    expect(events.some((e) => e.type === "session_fetch_timeout")).toBe(true);
  });

  it("timeout event carries an errorMessage without leaking secrets", async () => {
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}));

    renderHook(() => useWalletConnection());

    await act(async () => {
      vi.advanceTimersByTime(WALLET_BOUNDS.SESSION_FETCH_TIMEOUT_MS + 100);
    });

    const timeoutEvent = getWalletTelemetryService()
      .getEvents()
      .find((e) => e.type === "session_fetch_timeout");

    expect(timeoutEvent?.errorMessage).toBeDefined();
    expect(timeoutEvent?.errorMessage).not.toContain(TEST_ADDRESS);
  });
});

// ---------------------------------------------------------------------------
// Abort on unmount
// ---------------------------------------------------------------------------

describe("abort on unmount", () => {
  it("does not update state after the hook unmounts before rehydration resolves", async () => {
    let resolveSession!: (r: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise<Response>((res) => { resolveSession = res; }),
    );

    const { result, unmount } = renderHook(() => useWalletConnection());

    // Unmount before the fetch resolves.
    unmount();

    // Resolve after unmount.
    await act(async () => {
      resolveSession(mockOk(sessionBody()));
    });

    // The last recorded status before unmount should still be the initial value.
    expect(result.current.status).toBe("disconnected");
    expect(result.current.address).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Concurrent connect guard
// ---------------------------------------------------------------------------

describe("concurrent connect guard", () => {
  it("rejects a second connect while one is in-flight", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFail()); // rehydration
    setupStellar();

    // Challenge fetch hangs.
    let resolveChallenge!: (r: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise<Response>((res) => { resolveChallenge = res; }),
    );

    const { result } = renderHook(() => useWalletConnection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Start first connect — hangs.
    act(() => { result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe("connecting"));

    // Second connect should be rejected.
    await act(async () => { await result.current.connect(); });

    const events = getWalletTelemetryService().getEvents();
    expect(events.some((e) => e.type === "connect_rejected_concurrent")).toBe(true);

    // Cleanup: resolve the hanging challenge.
    await act(async () => {
      resolveChallenge(mockFail(500, { error: "cancelled" }));
    });
  });

  it("allows a new connect after the previous one errors out", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFail()); // rehydration
    setupStellar();
    vi.mocked(fetch).mockResolvedValueOnce(mockFail(500, { error: "boom" })); // challenge

    const { result } = renderHook(() => useWalletConnection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe("error"));

    // Second attempt succeeds.
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockOk({ transaction: "xdr" }))
      .mockResolvedValueOnce(mockOk({ walletAddress: TEST_ADDRESS }));

    await act(async () => { await result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe("connected"));
    expect(result.current.address).toBe(TEST_ADDRESS);
    expect(result.current.isConnected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Connect timeout
// ---------------------------------------------------------------------------

describe("connect timeout", () => {
  it("transitions to error when connect exceeds CONNECT_TIMEOUT_MS", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFail()); // rehydration
    setupStellar();

    // Challenge fetch never resolves — simulates a hung handshake.
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}));

    const { result } = renderHook(() => useWalletConnection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => { result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe("connecting"));

    await act(async () => {
      vi.advanceTimersByTime(WALLET_BOUNDS.CONNECT_TIMEOUT_MS + 100);
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/timed out/i);
    expect(result.current.address).toBeNull();
    expect(result.current.isConnected).toBe(false);

    const events = getWalletTelemetryService().getEvents();
    expect(events.some((e) => e.type === "connect_failed")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Telemetry emission
// ---------------------------------------------------------------------------

describe("telemetry emission", () => {
  it("emits rehydration_started + rehydration_succeeded on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk(sessionBody()));

    const { result } = renderHook(() => useWalletConnection());
    await waitFor(() => expect(result.current.status).toBe("connected"));

    const types = getWalletTelemetryService().getEvents().map((e) => e.type);
    expect(types).toContain("rehydration_started");
    expect(types).toContain("rehydration_succeeded");
  });

  it("emits rehydration_started + rehydration_failed on non-OK response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFail());

    const { result } = renderHook(() => useWalletConnection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const types = getWalletTelemetryService().getEvents().map((e) => e.type);
    expect(types).toContain("rehydration_started");
    expect(types).toContain("rehydration_failed");
  });

  it("emits rehydration_failed on network error during rehydration", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useWalletConnection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const types = getWalletTelemetryService().getEvents().map((e) => e.type);
    expect(types).toContain("rehydration_failed");
    expect(result.current.status).toBe("disconnected");
  });

  it("emits connect_started + connect_succeeded on successful connect", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFail()); // rehydration
    setupStellar();
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockOk({ transaction: "xdr" }))
      .mockResolvedValueOnce(mockOk({ walletAddress: TEST_ADDRESS }));

    const { result } = renderHook(() => useWalletConnection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe("connected"));

    const types = getWalletTelemetryService().getEvents().map((e) => e.type);
    expect(types).toContain("connect_started");
    expect(types).toContain("connect_succeeded");
  });

  it("emits connect_started + connect_failed on handshake error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFail()); // rehydration
    setupStellar();
    vi.mocked(fetch).mockResolvedValueOnce(mockFail(500, { error: "boom" }));

    const { result } = renderHook(() => useWalletConnection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe("error"));

    const types = getWalletTelemetryService().getEvents().map((e) => e.type);
    expect(types).toContain("connect_started");
    expect(types).toContain("connect_failed");
  });

  it("emits disconnect_started + disconnect_succeeded on clean disconnect", async () => {
    sessionStorage.setItem("walletAddress", TEST_ADDRESS);
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockOk(sessionBody()))
      .mockResolvedValueOnce(mockOk());

    const { result } = renderHook(() => useWalletConnection());
    await waitFor(() => expect(result.current.status).toBe("connected"));

    await act(async () => { await result.current.disconnect(); });
    await waitFor(() => expect(result.current.status).toBe("disconnected"));

    const types = getWalletTelemetryService().getEvents().map((e) => e.type);
    expect(types).toContain("disconnect_started");
    expect(types).toContain("disconnect_succeeded");
  });

  it("emits disconnect_failed but still clears state when server DELETE throws", async () => {
    sessionStorage.setItem("walletAddress", TEST_ADDRESS);
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockOk(sessionBody()))
      .mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useWalletConnection());
    await waitFor(() => expect(result.current.status).toBe("connected"));

    await act(async () => { await result.current.disconnect(); });
    await waitFor(() => expect(result.current.status).toBe("disconnected"));

    const types = getWalletTelemetryService().getEvents().map((e) => e.type);
    expect(types).toContain("disconnect_failed");
    expect(result.current.address).toBeNull();
    expect(sessionStorage.getItem("walletAddress")).toBeNull();
  });

  it("succeeded events carry a non-negative latencyMs", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk(sessionBody()));

    const { result } = renderHook(() => useWalletConnection());
    await waitFor(() => expect(result.current.status).toBe("connected"));

    const event = getWalletTelemetryService()
      .getEvents()
      .find((e) => e.type === "rehydration_succeeded");

    expect(event?.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Address sanitization
// ---------------------------------------------------------------------------

describe("address sanitization in telemetry", () => {
  it("does not leak the wallet address in rehydration error messages", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(
      new Error(`Session error for address ${TEST_ADDRESS}`),
    );

    const { result } = renderHook(() => useWalletConnection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const events = getWalletTelemetryService().getEvents();
    for (const e of events) {
      if (e.errorMessage) {
        expect(e.errorMessage).not.toContain(TEST_ADDRESS);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// isLoading transitions
// ---------------------------------------------------------------------------

describe("isLoading transitions", () => {
  it("starts true, becomes false after rehydration resolves (success)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOk(sessionBody()));

    const { result } = renderHook(() => useWalletConnection());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.status).toBe("connected");
  });

  it("starts true, becomes false after rehydration resolves (failure)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFail());

    const { result } = renderHook(() => useWalletConnection());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.status).toBe("disconnected");
  });

  it("is true while connecting and false after connect completes", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFail()); // rehydration
    setupStellar();

    let resolveVerify!: (r: Response) => void;
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockOk({ transaction: "xdr" })) // challenge
      .mockReturnValueOnce(
        new Promise<Response>((res) => { resolveVerify = res; }), // verify hangs
      );

    const { result } = renderHook(() => useWalletConnection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => { result.current.connect(); });
    await waitFor(() => expect(result.current.isLoading).toBe(true));

    await act(async () => {
      resolveVerify(mockOk({ walletAddress: TEST_ADDRESS }));
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.status).toBe("connected");
  });
});
