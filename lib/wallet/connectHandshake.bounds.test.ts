// @vitest-environment jsdom

/**
 * Focused acceptance-criteria tests for lib/wallet/connectHandshake.ts
 *
 * Covers:
 *  - WalletConnectError typed reasons on every failure path
 *  - Overall CONNECT_TIMEOUT_MS bound (via timeoutMs override)
 *  - Per-request REQUEST_TIMEOUT_MS bound via AbortError
 *  - Telemetry emitted on success, failure, and timeout
 *  - Telemetry messages are sanitised (no addresses, no XDR)
 *  - Redundant-connect guard is the caller's responsibility but the
 *    handshake itself must not swallow AbortError
 *  - Boundary: address returned by server differs from public key
 *  - Boundary: server returns invalid address
 *  - isValidStellarAddress boundary values
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  connectWallet,
  isValidStellarAddress,
  WalletConnectError,
} from "./connectHandshake";
import type { WalletTelemetryEvent } from "@/types/wallet";
import { WALLET_BOUNDS } from "@/types/wallet";

const VALID_ADDRESS = "GAUFVBMULU2CJRE5IGVPEOXRYZGU5YDAOSQ3UQTBM3Y7ARUPFSXZUHN5";
const OTHER_VALID_ADDRESS = "GBCKQ7BCF4O7SWKH3GF7G2KRPSURA2HU5WQJRHMIFR3P6DBGVT45XLR3";

function mockResponse(ok: boolean, body: unknown = {}, status = ok ? 200 : 500) {
  return { ok, status, json: async () => body } as Response;
}

function mockAbortResponse(): Promise<Response> {
  return Promise.reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
}

function setupStellar(overrides: Partial<typeof window.stellar> = {}) {
  (window as any).stellar = {
    getPublicKey: vi.fn().mockResolvedValue(VALID_ADDRESS),
    signTransaction: vi.fn().mockResolvedValue("signed-xdr"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  (window as any).stellar = undefined;
});

// ---------------------------------------------------------------------------
// isValidStellarAddress — boundary values
// ---------------------------------------------------------------------------

describe("isValidStellarAddress — boundary values", () => {
  it("accepts a well-formed 56-char G-prefixed address", () => {
    expect(isValidStellarAddress(VALID_ADDRESS)).toBe(true);
  });

  it("rejects an address one char too short", () => {
    expect(isValidStellarAddress(VALID_ADDRESS.slice(0, 55))).toBe(false);
  });

  it("rejects an address one char too long", () => {
    expect(isValidStellarAddress(VALID_ADDRESS + "A")).toBe(false);
  });

  it("rejects an address without a G prefix", () => {
    expect(isValidStellarAddress("A".repeat(56))).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidStellarAddress("")).toBe(false);
  });

  it("STELLAR_ADDRESS_LENGTH bound equals the known Stellar standard", () => {
    expect(WALLET_BOUNDS.STELLAR_ADDRESS_LENGTH).toBe(56);
    expect(VALID_ADDRESS.length).toBe(WALLET_BOUNDS.STELLAR_ADDRESS_LENGTH);
  });
});

// ---------------------------------------------------------------------------
// WalletConnectError — typed reason
// ---------------------------------------------------------------------------

describe("WalletConnectError", () => {
  it("carries the reason property set in the constructor", () => {
    const err = new WalletConnectError("connect_timeout", "Timed out");
    expect(err.reason).toBe("connect_timeout");
    expect(err.message).toBe("Timed out");
    expect(err.name).toBe("WalletConnectError");
    expect(err instanceof Error).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// connectWallet — failure paths emit typed WalletConnectError
// ---------------------------------------------------------------------------

describe("connectWallet — typed failure reasons", () => {
  it("throws WalletConnectError('no_wallet_extension') when Freighter absent", async () => {
    (window as any).stellar = undefined;
    const promise = connectWallet("TESTNET");
    vi.runAllTimers();
    await expect(promise).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof WalletConnectError && e.reason === "no_wallet_extension",
    );
  });

  it("throws WalletConnectError('no_public_key') when getPublicKey returns null", async () => {
    setupStellar({ getPublicKey: vi.fn().mockResolvedValue(null) });
    const promise = connectWallet("TESTNET");
    vi.runAllTimers();
    await expect(promise).rejects.toSatisfy(
      (e: unknown) => e instanceof WalletConnectError && e.reason === "no_public_key",
    );
  });

  it("throws WalletConnectError('invalid_public_key') for a malformed key", async () => {
    setupStellar({ getPublicKey: vi.fn().mockResolvedValue("not-a-key") });
    const promise = connectWallet("TESTNET");
    vi.runAllTimers();
    await expect(promise).rejects.toSatisfy(
      (e: unknown) => e instanceof WalletConnectError && e.reason === "invalid_public_key",
    );
  });

  it("throws WalletConnectError('challenge_failed') when challenge endpoint fails", async () => {
    setupStellar();
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false, { error: "Server error" }, 500));
    const promise = connectWallet("TESTNET");
    vi.runAllTimers();
    await expect(promise).rejects.toSatisfy(
      (e: unknown) => e instanceof WalletConnectError && e.reason === "challenge_failed",
    );
  });

  it("throws WalletConnectError('sign_failed') when signTransaction rejects", async () => {
    setupStellar({
      signTransaction: vi.fn().mockRejectedValue(new Error("User rejected")),
    });
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true, { transaction: "xdr" }));
    const promise = connectWallet("TESTNET");
    vi.runAllTimers();
    await expect(promise).rejects.toSatisfy(
      (e: unknown) => e instanceof WalletConnectError && e.reason === "sign_failed",
    );
  });

  it("throws WalletConnectError('verify_failed') when verify endpoint fails", async () => {
    setupStellar();
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(true, { transaction: "xdr" }))
      .mockResolvedValueOnce(mockResponse(false, { error: "Invalid signature" }, 400));
    const promise = connectWallet("TESTNET");
    vi.runAllTimers();
    await expect(promise).rejects.toSatisfy(
      (e: unknown) => e instanceof WalletConnectError && e.reason === "verify_failed",
    );
  });

  it("throws WalletConnectError('verify_failed') when verify returns an invalid address", async () => {
    setupStellar();
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(true, { transaction: "xdr" }))
      .mockResolvedValueOnce(mockResponse(true, { walletAddress: "bad-addr" }));
    const promise = connectWallet("TESTNET");
    vi.runAllTimers();
    await expect(promise).rejects.toSatisfy(
      (e: unknown) => e instanceof WalletConnectError && e.reason === "verify_failed",
    );
  });

  it("throws WalletConnectError('address_mismatch') when server returns a different valid address", async () => {
    setupStellar();
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(true, { transaction: "xdr" }))
      .mockResolvedValueOnce(mockResponse(true, { walletAddress: OTHER_VALID_ADDRESS }));
    const promise = connectWallet("TESTNET");
    vi.runAllTimers();
    await expect(promise).rejects.toSatisfy(
      (e: unknown) => e instanceof WalletConnectError && e.reason === "address_mismatch",
    );
  });
});

// ---------------------------------------------------------------------------
// connectWallet — overall timeout bound
// ---------------------------------------------------------------------------

describe("connectWallet — overall CONNECT_TIMEOUT_MS bound", () => {
  it("rejects with connect_timeout when the handshake exceeds timeoutMs", async () => {
    // getPublicKey never resolves → handshake hangs
    setupStellar({
      getPublicKey: vi.fn().mockReturnValue(new Promise(() => {})),
    });

    const promise = connectWallet("TESTNET", { timeoutMs: 100 });
    vi.advanceTimersByTime(200);

    await expect(promise).rejects.toSatisfy(
      (e: unknown) => e instanceof WalletConnectError && e.reason === "connect_timeout",
    );
  });

  it("succeeds before the timeout if the handshake completes in time", async () => {
    setupStellar();
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(true, { transaction: "xdr" }))
      .mockResolvedValueOnce(mockResponse(true, { walletAddress: VALID_ADDRESS }));

    const promise = connectWallet("TESTNET", { timeoutMs: 5_000 });
    // Let microtasks run but don't advance timers past timeout.
    await vi.runAllMicrotasksAsync();

    await expect(promise).resolves.toBe(VALID_ADDRESS);
  });
});

// ---------------------------------------------------------------------------
// connectWallet — per-request timeout (AbortError maps to connect_timeout)
// ---------------------------------------------------------------------------

describe("connectWallet — per-request AbortError handling", () => {
  it("wraps a challenge AbortError as WalletConnectError('connect_timeout')", async () => {
    setupStellar();
    vi.mocked(fetch).mockImplementationOnce(() => mockAbortResponse());

    const promise = connectWallet("TESTNET");
    vi.runAllTimers();

    await expect(promise).rejects.toSatisfy(
      (e: unknown) => e instanceof WalletConnectError && e.reason === "connect_timeout",
    );
  });

  it("wraps a verify AbortError as WalletConnectError('connect_timeout')", async () => {
    setupStellar();
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(true, { transaction: "xdr" }))
      .mockImplementationOnce(() => mockAbortResponse());

    const promise = connectWallet("TESTNET");
    vi.runAllTimers();

    await expect(promise).rejects.toSatisfy(
      (e: unknown) => e instanceof WalletConnectError && e.reason === "connect_timeout",
    );
  });
});

// ---------------------------------------------------------------------------
// connectWallet — telemetry emission
// ---------------------------------------------------------------------------

describe("connectWallet — telemetry", () => {
  it("emits connect_started and connect_succeeded on success", async () => {
    setupStellar();
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(true, { transaction: "xdr" }))
      .mockResolvedValueOnce(mockResponse(true, { walletAddress: VALID_ADDRESS }));

    const events: WalletTelemetryEvent[] = [];
    const promise = connectWallet("TESTNET", { onTelemetry: (e) => events.push(e) });
    await vi.runAllMicrotasksAsync();
    await promise;

    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining(["connect_started", "connect_succeeded"]),
    );
  });

  it("emits connect_failed with the correct failureReason on error", async () => {
    (window as any).stellar = undefined;

    const events: WalletTelemetryEvent[] = [];
    const promise = connectWallet("TESTNET", { onTelemetry: (e) => events.push(e) });
    vi.runAllTimers();
    await expect(promise).rejects.toBeInstanceOf(WalletConnectError);

    const failed = events.find((e) => e.type === "connect_failed");
    expect(failed).toBeDefined();
    expect(failed?.failureReason).toBe("no_wallet_extension");
  });

  it("emits connect_timeout when the overall timeout fires", async () => {
    setupStellar({
      getPublicKey: vi.fn().mockReturnValue(new Promise(() => {})),
    });

    const events: WalletTelemetryEvent[] = [];
    const promise = connectWallet("TESTNET", {
      timeoutMs: 100,
      onTelemetry: (e) => events.push(e),
    });
    vi.advanceTimersByTime(200);
    await expect(promise).rejects.toBeInstanceOf(WalletConnectError);

    expect(events.some((e) => e.type === "connect_timeout")).toBe(true);
  });

  it("telemetry messages do not contain raw wallet addresses", async () => {
    setupStellar();
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(true, { transaction: "xdr" }))
      .mockResolvedValueOnce(mockResponse(true, { walletAddress: OTHER_VALID_ADDRESS }));

    const events: WalletTelemetryEvent[] = [];
    const promise = connectWallet("TESTNET", { onTelemetry: (e) => events.push(e) });
    vi.runAllTimers();
    await expect(promise).rejects.toBeInstanceOf(WalletConnectError);

    const allMessages = events
      .flatMap((e) => [e.message ?? "", JSON.stringify(e.metadata ?? {})])
      .join(" ");
    // Neither the verified address nor the public key should appear verbatim.
    expect(allMessages).not.toContain(VALID_ADDRESS);
    expect(allMessages).not.toContain(OTHER_VALID_ADDRESS);
  });

  it("telemetry events always carry a numeric timestamp", async () => {
    (window as any).stellar = undefined;
    const events: WalletTelemetryEvent[] = [];
    const promise = connectWallet("TESTNET", { onTelemetry: (e) => events.push(e) });
    vi.runAllTimers();
    await expect(promise).rejects.toBeInstanceOf(WalletConnectError);

    for (const event of events) {
      expect(typeof event.timestamp).toBe("number");
      expect(event.timestamp).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// WALLET_BOUNDS — bound completeness
// ---------------------------------------------------------------------------

describe("WALLET_BOUNDS — completeness and sanity", () => {
  it("CONNECT_TIMEOUT_MS is positive and at least 5 s", () => {
    expect(WALLET_BOUNDS.CONNECT_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000);
  });

  it("REHYDRATION_TIMEOUT_MS is positive and less than CONNECT_TIMEOUT_MS", () => {
    expect(WALLET_BOUNDS.REHYDRATION_TIMEOUT_MS).toBeGreaterThan(0);
    expect(WALLET_BOUNDS.REHYDRATION_TIMEOUT_MS).toBeLessThan(WALLET_BOUNDS.CONNECT_TIMEOUT_MS);
  });

  it("REQUEST_TIMEOUT_MS is positive and at most CONNECT_TIMEOUT_MS", () => {
    expect(WALLET_BOUNDS.REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
    expect(WALLET_BOUNDS.REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(WALLET_BOUNDS.CONNECT_TIMEOUT_MS);
  });

  it("BALANCE_STALE_AFTER_MS is at least 10 s", () => {
    expect(WALLET_BOUNDS.BALANCE_STALE_AFTER_MS).toBeGreaterThanOrEqual(10_000);
  });

  it("RECONNECT_DEBOUNCE_MS is positive and less than CONNECT_TIMEOUT_MS", () => {
    expect(WALLET_BOUNDS.RECONNECT_DEBOUNCE_MS).toBeGreaterThan(0);
    expect(WALLET_BOUNDS.RECONNECT_DEBOUNCE_MS).toBeLessThan(WALLET_BOUNDS.CONNECT_TIMEOUT_MS);
  });

  it("MAX_ACCOUNTS is at least 1", () => {
    expect(WALLET_BOUNDS.MAX_ACCOUNTS).toBeGreaterThanOrEqual(1);
  });

  it("MAX_CONCURRENT_CONNECT_REQUESTS is exactly 1 (single-handshake invariant)", () => {
    expect(WALLET_BOUNDS.MAX_CONCURRENT_CONNECT_REQUESTS).toBe(1);
  });
});
