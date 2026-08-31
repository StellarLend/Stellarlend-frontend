// @vitest-environment jsdom

/**
 * Focused tests for lib/wallet/sessionRehydration.ts
 *
 * Covers:
 *  - Success path: valid server session → ok:true with walletAddress + network
 *  - Failure paths: non-ok response, malformed JSON, wrong network, expired
 *    session, tampered sessionStorage (address mismatch), network error
 *  - REHYDRATION_TIMEOUT_MS bound: AbortError maps to rehydration_timeout
 *  - Telemetry emitted on every path with correct type and no secrets
 *  - RehydrationOutcome shape: always resolves (never throws)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rehydrateWalletSession } from "./sessionRehydration";
import type { WalletTelemetryEvent } from "@/types/wallet";
import { WALLET_BOUNDS } from "@/types/wallet";

const VALID_ADDRESS = "GAUFVBMULU2CJRE5IGVPEOXRYZGU5YDAOSQ3UQTBM3Y7ARUPFSXZUHN5";
const OTHER_VALID_ADDRESS = "GBCKQ7BCF4O7SWKH3GF7G2KRPSURA2HU5WQJRHMIFR3P6DBGVT45XLR3";

function mockResponse(ok: boolean, body: unknown = {}, status = ok ? 200 : 401) {
  return { ok, status, json: async () => body } as Response;
}

function validSessionBody(
  walletAddress = VALID_ADDRESS,
  network = "TESTNET",
  expiresOffset = 60_000,
) {
  return {
    session: {
      active: true,
      network,
      user: { walletAddress },
      issuedAt: new Date(Date.now() - 1000).toISOString(),
      expiresAt: new Date(Date.now() + expiresOffset).toISOString(),
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe("rehydrateWalletSession — success", () => {
  it("returns ok:true with walletAddress and network on a valid session", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true, validSessionBody()));
    const promise = rehydrateWalletSession({ network: "TESTNET", storedAddress: null });
    await vi.runAllMicrotasksAsync();
    const outcome = await promise;

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.walletAddress).toBe(VALID_ADDRESS);
      expect(outcome.network).toBe("TESTNET");
    }
  });

  it("accepts a session when storedAddress matches the server wallet", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true, validSessionBody()));
    const promise = rehydrateWalletSession({
      network: "TESTNET",
      storedAddress: VALID_ADDRESS,
    });
    await vi.runAllMicrotasksAsync();
    const outcome = await promise;
    expect(outcome.ok).toBe(true);
  });

  it("ignores storedAddress when it is null (no storage entry)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true, validSessionBody()));
    const promise = rehydrateWalletSession({ network: "TESTNET", storedAddress: null });
    await vi.runAllMicrotasksAsync();
    const outcome = await promise;
    expect(outcome.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Failure paths — server errors
// ---------------------------------------------------------------------------

describe("rehydrateWalletSession — server failure", () => {
  it("returns ok:false with network_error on a non-ok HTTP response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false, {}, 401));
    const promise = rehydrateWalletSession({ network: "TESTNET", storedAddress: null });
    await vi.runAllMicrotasksAsync();
    const outcome = await promise;

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("network_error");
  });

  it("returns ok:false with session_invalid when response JSON is malformed", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError("bad json"); },
    } as unknown as Response);
    const promise = rehydrateWalletSession({ network: "TESTNET", storedAddress: null });
    await vi.runAllMicrotasksAsync();
    const outcome = await promise;

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("session_invalid");
  });

  it("returns ok:false with session_wrong_network for a mismatched network", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(true, validSessionBody(VALID_ADDRESS, "PUBLIC")),
    );
    const promise = rehydrateWalletSession({ network: "TESTNET", storedAddress: null });
    await vi.runAllMicrotasksAsync();
    const outcome = await promise;

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("session_wrong_network");
  });

  it("returns ok:false with session_expired for an already-expired session", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(true, validSessionBody(VALID_ADDRESS, "TESTNET", -1000)),
    );
    const promise = rehydrateWalletSession({ network: "TESTNET", storedAddress: null });
    await vi.runAllMicrotasksAsync();
    const outcome = await promise;

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("session_expired");
  });

  it("returns ok:false with session_invalid for a missing walletAddress in session", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(true, {
        session: { active: true, network: "TESTNET", user: {} },
      }),
    );
    const promise = rehydrateWalletSession({ network: "TESTNET", storedAddress: null });
    await vi.runAllMicrotasksAsync();
    const outcome = await promise;

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("session_invalid");
  });

  it("returns ok:false with session_invalid for an inactive session", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(true, {
        session: {
          active: false,
          network: "TESTNET",
          user: { walletAddress: VALID_ADDRESS },
        },
      }),
    );
    const promise = rehydrateWalletSession({ network: "TESTNET", storedAddress: null });
    await vi.runAllMicrotasksAsync();
    const outcome = await promise;

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("session_invalid");
  });
});

// ---------------------------------------------------------------------------
// Tampered sessionStorage
// ---------------------------------------------------------------------------

describe("rehydrateWalletSession — tampered storage", () => {
  it("returns ok:false with address_mismatch when stored address differs from server session", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true, validSessionBody(VALID_ADDRESS)));
    const promise = rehydrateWalletSession({
      network: "TESTNET",
      storedAddress: OTHER_VALID_ADDRESS, // tampered
    });
    await vi.runAllMicrotasksAsync();
    const outcome = await promise;

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("address_mismatch");
  });

  it("returns ok:false with session_invalid when stored address is an invalid key", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true, validSessionBody()));
    const promise = rehydrateWalletSession({
      network: "TESTNET",
      storedAddress: "GXXXXXXX_INVALID",
    });
    await vi.runAllMicrotasksAsync();
    const outcome = await promise;

    expect(outcome.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Network error
// ---------------------------------------------------------------------------

describe("rehydrateWalletSession — network error", () => {
  it("returns ok:false with network_error on fetch rejection", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network offline"));
    const promise = rehydrateWalletSession({ network: "TESTNET", storedAddress: null });
    await vi.runAllMicrotasksAsync();
    const outcome = await promise;

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("network_error");
  });
});

// ---------------------------------------------------------------------------
// REHYDRATION_TIMEOUT_MS bound
// ---------------------------------------------------------------------------

describe("rehydrateWalletSession — timeout bound", () => {
  it("returns ok:false with rehydration_timeout when fetch exceeds timeoutMs", async () => {
    // fetch never resolves
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));

    const promise = rehydrateWalletSession({
      network: "TESTNET",
      storedAddress: null,
      timeoutMs: 100,
    });
    vi.advanceTimersByTime(200);
    await vi.runAllMicrotasksAsync();
    const outcome = await promise;

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("rehydration_timeout");
  });

  it("resolves before the timeout when the server responds quickly", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true, validSessionBody()));
    const promise = rehydrateWalletSession({
      network: "TESTNET",
      storedAddress: null,
      timeoutMs: 5_000,
    });
    await vi.runAllMicrotasksAsync();
    const outcome = await promise;

    expect(outcome.ok).toBe(true);
  });

  it("REHYDRATION_TIMEOUT_MS bound is positive and less than CONNECT_TIMEOUT_MS", () => {
    expect(WALLET_BOUNDS.REHYDRATION_TIMEOUT_MS).toBeGreaterThan(0);
    expect(WALLET_BOUNDS.REHYDRATION_TIMEOUT_MS).toBeLessThan(WALLET_BOUNDS.CONNECT_TIMEOUT_MS);
  });
});

// ---------------------------------------------------------------------------
// Telemetry emission
// ---------------------------------------------------------------------------

describe("rehydrateWalletSession — telemetry", () => {
  it("emits rehydration_started and rehydration_succeeded on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true, validSessionBody()));

    const events: WalletTelemetryEvent[] = [];
    const promise = rehydrateWalletSession({
      network: "TESTNET",
      storedAddress: null,
      onTelemetry: (e) => events.push(e),
    });
    await vi.runAllMicrotasksAsync();
    await promise;

    expect(events.map((e) => e.type)).toContain("rehydration_started");
    expect(events.map((e) => e.type)).toContain("rehydration_succeeded");
  });

  it("emits rehydration_failed with the correct failureReason on a network error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));

    const events: WalletTelemetryEvent[] = [];
    const promise = rehydrateWalletSession({
      network: "TESTNET",
      storedAddress: null,
      onTelemetry: (e) => events.push(e),
    });
    await vi.runAllMicrotasksAsync();
    await promise;

    const failed = events.find((e) => e.type === "rehydration_failed");
    expect(failed).toBeDefined();
    expect(failed?.failureReason).toBe("network_error");
  });

  it("emits rehydration_timeout when AbortController fires", async () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));

    const events: WalletTelemetryEvent[] = [];
    const promise = rehydrateWalletSession({
      network: "TESTNET",
      storedAddress: null,
      timeoutMs: 100,
      onTelemetry: (e) => events.push(e),
    });
    vi.advanceTimersByTime(200);
    await vi.runAllMicrotasksAsync();
    await promise;

    expect(events.some((e) => e.type === "rehydration_timeout")).toBe(true);
  });

  it("telemetry events never contain wallet addresses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true, validSessionBody()));

    const events: WalletTelemetryEvent[] = [];
    const promise = rehydrateWalletSession({
      network: "TESTNET",
      storedAddress: VALID_ADDRESS,
      onTelemetry: (e) => events.push(e),
    });
    await vi.runAllMicrotasksAsync();
    await promise;

    const payload = JSON.stringify(events);
    expect(payload).not.toContain(VALID_ADDRESS);
  });

  it("all telemetry events carry a positive numeric timestamp", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true, validSessionBody()));

    const events: WalletTelemetryEvent[] = [];
    const promise = rehydrateWalletSession({
      network: "TESTNET",
      storedAddress: null,
      onTelemetry: (e) => events.push(e),
    });
    await vi.runAllMicrotasksAsync();
    await promise;

    for (const e of events) {
      expect(typeof e.timestamp).toBe("number");
      expect(e.timestamp).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// RehydrationOutcome — always resolves, never throws
// ---------------------------------------------------------------------------

describe("rehydrateWalletSession — never throws", () => {
  it("resolves even when fetch itself throws", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const promise = rehydrateWalletSession({ network: "TESTNET", storedAddress: null });
    await vi.runAllMicrotasksAsync();
    // Should resolve, not reject.
    await expect(promise).resolves.toMatchObject({ ok: false });
  });

  it("resolves even when validateClientSessionResponse throws an unexpected error", async () => {
    // Return something that makes the boundary validator throw a non-standard error.
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(true, null), // null payload → should not throw unhandled
    );
    const promise = rehydrateWalletSession({ network: "TESTNET", storedAddress: null });
    await vi.runAllMicrotasksAsync();
    await expect(promise).resolves.toMatchObject({ ok: false });
  });
});
