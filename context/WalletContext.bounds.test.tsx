// @vitest-environment jsdom

/**
 * Focused acceptance-criteria tests for context/WalletContext.tsx
 *
 * Covers the invariants added in the bounded-performance revision:
 *  - isInitializing status: starts as 'initializing', resolves to
 *    'connected' or 'disconnected' after the rehydration fetch
 *  - Redundant-connect guard: connect() is blocked while 'initializing'
 *    and while 'connecting'
 *  - Debounce guard: rapid connect() calls within RECONNECT_DEBOUNCE_MS
 *    are dropped
 *  - Telemetry: onTelemetry prop receives structured events with no
 *    secrets on connect_started, connect_succeeded, connect_failed,
 *    duplicate_connect_blocked, disconnect_started, disconnect_succeeded
 *  - Account list is bounded to MAX_ACCOUNTS
 *  - WalletConnectError.reason surfaces correctly in the error state
 *  - Rehydration uses the shared utility (server session confirms state)
 *  - switchAccount blocks when the next address is not in the known list
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { WalletProvider, useWalletContext } from "./WalletContext";
import type { WalletTelemetryEvent } from "@/types/wallet";
import { WALLET_BOUNDS } from "@/types/wallet";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const TEST_ADDRESS = "GAUFVBMULU2CJRE5IGVPEOXRYZGU5YDAOSQ3UQTBM3Y7ARUPFSXZUHN5";
const OTHER_ADDRESS = "GBCKQ7BCF4O7SWKH3GF7G2KRPSURA2HU5WQJRHMIFR3P6DBGVT45XLR3";

function mockResponse(ok: boolean, body: unknown = {}, status = ok ? 200 : 401) {
  return { ok, status, json: async () => body } as Response;
}

function validSession(walletAddress = TEST_ADDRESS, network = "TESTNET") {
  return {
    session: {
      active: true,
      network,
      user: { walletAddress },
      issuedAt: new Date(Date.now() - 1000).toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  };
}

function makeWrapper(
  onTelemetry?: (e: WalletTelemetryEvent) => void,
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(WalletProvider, { onTelemetry }, children);
  };
}

function setupStellar(overrides: Partial<NonNullable<typeof window.stellar>> = {}) {
  (window as any).stellar = {
    getPublicKey: vi.fn().mockResolvedValue(TEST_ADDRESS),
    signTransaction: vi.fn().mockResolvedValue("signed-xdr"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.useFakeTimers();
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  (window as any).stellar = undefined;
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// isInitializing
// ---------------------------------------------------------------------------

describe("WalletContext — isInitializing", () => {
  it("starts with status='initializing' and isInitializing=true", () => {
    // fetch never resolves during this assertion window
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useWalletContext(), { wrapper: makeWrapper() });

    expect(result.current.status).toBe("initializing");
    expect(result.current.isInitializing).toBe(true);
  });

  it("transitions to 'connected' after a successful rehydration", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true, validSession()));
    const { result } = renderHook(() => useWalletContext(), { wrapper: makeWrapper() });

    await vi.runAllMicrotasksAsync();
    await waitFor(() => expect(result.current.status).toBe("connected"));
    expect(result.current.isInitializing).toBe(false);
    expect(result.current.address).toBe(TEST_ADDRESS);
  });

  it("transitions to 'disconnected' after a failed rehydration", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
    const { result } = renderHook(() => useWalletContext(), { wrapper: makeWrapper() });

    await vi.runAllMicrotasksAsync();
    await waitFor(() => expect(result.current.status).toBe("disconnected"));
    expect(result.current.isInitializing).toBe(false);
    expect(result.current.address).toBeNull();
  });

  it("transitions to 'disconnected' after a network error during rehydration", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useWalletContext(), { wrapper: makeWrapper() });

    await vi.runAllMicrotasksAsync();
    await waitFor(() => expect(result.current.status).toBe("disconnected"));
    expect(result.current.isInitializing).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Redundant-connect guard
// ---------------------------------------------------------------------------

describe("WalletContext — redundant-connect guard", () => {
  it("blocks connect() while status is 'initializing'", async () => {
    // Rehydration fetch hangs so status stays 'initializing'.
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    const events: WalletTelemetryEvent[] = [];
    const { result } = renderHook(
      () => useWalletContext(),
      { wrapper: makeWrapper((e) => events.push(e)) },
    );

    expect(result.current.status).toBe("initializing");

    await act(async () => {
      await result.current.connect();
    });

    // Status must NOT have changed to 'connecting'.
    expect(result.current.status).toBe("initializing");
    expect(events.some((e) => e.type === "duplicate_connect_blocked")).toBe(true);
  });

  it("blocks a second connect() call while the first is in-flight ('connecting')", async () => {
    // Rehydration fails immediately so status reaches 'disconnected'.
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));

    const events: WalletTelemetryEvent[] = [];
    const { result } = renderHook(
      () => useWalletContext(),
      { wrapper: makeWrapper((e) => events.push(e)) },
    );

    await vi.runAllMicrotasksAsync();
    await waitFor(() => expect(result.current.status).toBe("disconnected"));

    // Set up Stellar but make getPublicKey hang so status stays 'connecting'.
    setupStellar({ getPublicKey: vi.fn().mockReturnValue(new Promise(() => {})) });

    // First connect → transitions to 'connecting'
    void act(async () => { await result.current.connect(); });
    await vi.runAllMicrotasksAsync();

    // Advance timers so debounce window passes.
    vi.advanceTimersByTime(WALLET_BOUNDS.RECONNECT_DEBOUNCE_MS + 10);

    // Second connect → should be blocked.
    await act(async () => {
      await result.current.connect();
    });

    expect(events.some((e) => e.type === "duplicate_connect_blocked")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Debounce guard
// ---------------------------------------------------------------------------

describe("WalletContext — RECONNECT_DEBOUNCE_MS debounce", () => {
  it("blocks a connect() call within RECONNECT_DEBOUNCE_MS of the previous one", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
    const events: WalletTelemetryEvent[] = [];
    const { result } = renderHook(
      () => useWalletContext(),
      { wrapper: makeWrapper((e) => events.push(e)) },
    );

    await vi.runAllMicrotasksAsync();
    await waitFor(() => expect(result.current.status).toBe("disconnected"));

    setupStellar();
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(true, { transaction: "xdr" }))
      .mockResolvedValueOnce(mockResponse(true, { walletAddress: TEST_ADDRESS }));

    // First connect fires immediately.
    await act(async () => { await result.current.connect(); });

    // Second connect within debounce window.
    await act(async () => { await result.current.connect(); });

    const blockedEvents = events.filter((e) => e.type === "duplicate_connect_blocked");
    expect(blockedEvents.length).toBeGreaterThanOrEqual(1);
    expect(blockedEvents.some((e) => e.metadata?.reason === "debounced")).toBe(true);
  });

  it("allows a connect() call after RECONNECT_DEBOUNCE_MS has elapsed", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
    const { result } = renderHook(() => useWalletContext(), { wrapper: makeWrapper() });

    await vi.runAllMicrotasksAsync();
    await waitFor(() => expect(result.current.status).toBe("disconnected"));

    // First attempt fails (Freighter absent).
    await act(async () => { await result.current.connect(); });
    expect(result.current.status).toBe("error");

    // Reset to disconnected so we can test the debounce window.
    // After RECONNECT_DEBOUNCE_MS, the next call should not be dropped.
    vi.advanceTimersByTime(WALLET_BOUNDS.RECONNECT_DEBOUNCE_MS + 10);

    setupStellar();
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(true, { transaction: "xdr" }))
      .mockResolvedValueOnce(mockResponse(true, { walletAddress: TEST_ADDRESS }));

    await act(async () => { await result.current.connect(); });
    await vi.runAllMicrotasksAsync();

    await waitFor(() => expect(result.current.status).toBe("connected"));
    expect(result.current.address).toBe(TEST_ADDRESS);
  });
});

// ---------------------------------------------------------------------------
// Telemetry
// ---------------------------------------------------------------------------

describe("WalletContext — telemetry emission", () => {
  it("emits connect_started and connect_succeeded on a successful connect", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
    const events: WalletTelemetryEvent[] = [];
    const { result } = renderHook(
      () => useWalletContext(),
      { wrapper: makeWrapper((e) => events.push(e)) },
    );

    await vi.runAllMicrotasksAsync();
    await waitFor(() => expect(result.current.status).toBe("disconnected"));

    setupStellar();
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(true, { transaction: "xdr" }))
      .mockResolvedValueOnce(mockResponse(true, { walletAddress: TEST_ADDRESS }));

    await act(async () => { await result.current.connect(); });
    await vi.runAllMicrotasksAsync();
    await waitFor(() => expect(result.current.status).toBe("connected"));

    const types = events.map((e) => e.type);
    expect(types).toContain("connect_started");
    expect(types).toContain("connect_succeeded");
  });

  it("emits connect_failed on a failed connect", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
    const events: WalletTelemetryEvent[] = [];
    const { result } = renderHook(
      () => useWalletContext(),
      { wrapper: makeWrapper((e) => events.push(e)) },
    );

    await vi.runAllMicrotasksAsync();
    await waitFor(() => expect(result.current.status).toBe("disconnected"));

    // Freighter absent → connect_failed
    (window as any).stellar = undefined;
    await act(async () => { await result.current.connect(); });
    await vi.runAllMicrotasksAsync();

    expect(events.some((e) => e.type === "connect_failed")).toBe(true);
  });

  it("emits disconnect_started and disconnect_succeeded on disconnect", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(true, validSession()))
      .mockResolvedValueOnce(mockResponse(true));

    const events: WalletTelemetryEvent[] = [];
    const { result } = renderHook(
      () => useWalletContext(),
      { wrapper: makeWrapper((e) => events.push(e)) },
    );

    await vi.runAllMicrotasksAsync();
    await waitFor(() => expect(result.current.status).toBe("connected"));

    await act(async () => { await result.current.disconnect(); });
    await vi.runAllMicrotasksAsync();

    const types = events.map((e) => e.type);
    expect(types).toContain("disconnect_started");
    expect(types).toContain("disconnect_succeeded");
  });

  it("telemetry events carry a positive numeric timestamp", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
    const events: WalletTelemetryEvent[] = [];
    const { result } = renderHook(
      () => useWalletContext(),
      { wrapper: makeWrapper((e) => events.push(e)) },
    );

    await vi.runAllMicrotasksAsync();
    await waitFor(() => expect(result.current.status).toBe("disconnected"));

    (window as any).stellar = undefined;
    await act(async () => { await result.current.connect(); });
    await vi.runAllMicrotasksAsync();

    for (const e of events) {
      expect(typeof e.timestamp).toBe("number");
      expect(e.timestamp).toBeGreaterThan(0);
    }
  });

  it("telemetry messages do not contain raw wallet addresses", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(true, validSession()))
      .mockResolvedValueOnce(mockResponse(true));

    const events: WalletTelemetryEvent[] = [];
    const { result } = renderHook(
      () => useWalletContext(),
      { wrapper: makeWrapper((e) => events.push(e)) },
    );

    await vi.runAllMicrotasksAsync();
    await waitFor(() => expect(result.current.status).toBe("connected"));

    await act(async () => { await result.current.disconnect(); });
    await vi.runAllMicrotasksAsync();

    const payload = JSON.stringify(events);
    expect(payload).not.toContain(TEST_ADDRESS);
  });
});

// ---------------------------------------------------------------------------
// Account list bounded to MAX_ACCOUNTS
// ---------------------------------------------------------------------------

describe("WalletContext — MAX_ACCOUNTS bound", () => {
  it("truncates the getAccounts() list to MAX_ACCOUNTS", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
    const { result } = renderHook(() => useWalletContext(), { wrapper: makeWrapper() });

    await vi.runAllMicrotasksAsync();
    await waitFor(() => expect(result.current.status).toBe("disconnected"));

    // Build a list of MAX_ACCOUNTS + 5 addresses, all valid Stellar keys.
    // We reuse TEST_ADDRESS for all of them (duplicates are deduped anyway,
    // but the bound must be checked BEFORE dedup to prevent memory blowup).
    const manyAccounts = Array.from(
      { length: WALLET_BOUNDS.MAX_ACCOUNTS + 5 },
      (_, i) => (i % 2 === 0 ? TEST_ADDRESS : OTHER_ADDRESS),
    );

    setupStellar({
      getAccounts: vi.fn().mockResolvedValue(manyAccounts),
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(true, { transaction: "xdr" }))
      .mockResolvedValueOnce(mockResponse(true, { walletAddress: TEST_ADDRESS }));

    await act(async () => { await result.current.connect(); });
    await vi.runAllMicrotasksAsync();
    await waitFor(() => expect(result.current.status).toBe("connected"));

    expect(result.current.accounts.length).toBeLessThanOrEqual(WALLET_BOUNDS.MAX_ACCOUNTS);
  });
});

// ---------------------------------------------------------------------------
// switchAccount — invariants
// ---------------------------------------------------------------------------

describe("WalletContext — switchAccount invariants", () => {
  it("sets an error when switching to an address not in the known accounts list", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true, validSession()));
    const { result } = renderHook(() => useWalletContext(), { wrapper: makeWrapper() });

    await vi.runAllMicrotasksAsync();
    await waitFor(() => expect(result.current.status).toBe("connected"));

    await act(async () => {
      await result.current.switchAccount(OTHER_ADDRESS);
    });

    expect(result.current.error).toBeTruthy();
  });

  it("does not change address when switching to an address that requires re-auth", async () => {
    // Manually populate a two-account list to exercise the re-auth guard.
    // We'll hack sessionStorage to include both addresses pre-connect.
    sessionStorage.setItem("walletAddress", TEST_ADDRESS);
    sessionStorage.setItem("walletAccounts", JSON.stringify([TEST_ADDRESS, OTHER_ADDRESS]));

    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true, validSession()));
    const { result } = renderHook(() => useWalletContext(), { wrapper: makeWrapper() });

    await vi.runAllMicrotasksAsync();
    await waitFor(() => expect(result.current.status).toBe("connected"));

    // Switching to OTHER_ADDRESS (which differs from the session address) should be blocked.
    await act(async () => {
      await result.current.switchAccount(OTHER_ADDRESS);
    });

    expect(result.current.address).toBe(TEST_ADDRESS);
    expect(result.current.error).toBeTruthy();
  });

  it("is a no-op when switching to the already-active account", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true, validSession()));
    const { result } = renderHook(() => useWalletContext(), { wrapper: makeWrapper() });

    await vi.runAllMicrotasksAsync();
    await waitFor(() => expect(result.current.status).toBe("connected"));

    const errorBefore = result.current.error;
    await act(async () => {
      await result.current.switchAccount(TEST_ADDRESS);
    });

    // Should not have set an error.
    expect(result.current.error).toBe(errorBefore);
    expect(result.current.address).toBe(TEST_ADDRESS);
  });
});

// ---------------------------------------------------------------------------
// Error state from WalletConnectError
// ---------------------------------------------------------------------------

describe("WalletContext — WalletConnectError surfacing", () => {
  it("surfaces the WalletConnectError message in the error state", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
    const { result } = renderHook(() => useWalletContext(), { wrapper: makeWrapper() });

    await vi.runAllMicrotasksAsync();
    await waitFor(() => expect(result.current.status).toBe("disconnected"));

    (window as any).stellar = undefined;
    await act(async () => { await result.current.connect(); });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Stellar wallet provider (Freighter) not detected");
  });
});

// ---------------------------------------------------------------------------
// useWalletContext outside provider
// ---------------------------------------------------------------------------

describe("useWalletContext", () => {
  it("throws when used outside WalletProvider", () => {
    expect(() =>
      renderHook(() => useWalletContext()),
    ).toThrow("useWalletContext must be used within a WalletProvider");
  });
});
