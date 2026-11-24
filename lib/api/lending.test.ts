// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { nativeToScVal, rpc, type xdr } from "@stellar/stellar-sdk";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports that use them.
// ---------------------------------------------------------------------------

// A valid Soroban contract address (StrKey-encoded, 56 chars, starts with C).
const VALID_CONTRACT_ID = "CBAVZSICA7ECGQXSZT23DB6ZUL3HPHG47F2SIY3DI3J5AWCA2G5YPMGD";

const mocks = vi.hoisted(() => ({
  simulateTransaction: vi.fn(),
  // Must be a literal inside vi.hoisted — the block is lifted above all const declarations.
  lendingId: "CBAVZSICA7ECGQXSZT23DB6ZUL3HPHG47F2SIY3DI3J5AWCA2G5YPMGD",
}));

// Mock rpc.Server so simulate() never hits the network.
vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();

  class MockServer {
    simulateTransaction(...args: unknown[]) {
      return mocks.simulateTransaction(...args);
    }
  }

  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: MockServer,
    },
  };
});

// Mock config so tests control lendingId without touching env vars.
vi.mock("@/lib/config", () => ({
  config: {
    rpc: "https://rpc.example.com",
    networkPassphrase: "Test SDF Network ; September 2015",
    get lendingId() {
      return mocks.lendingId;
    },
    marketAssets: {},
  },
}));

// MARKETS is not needed for fetchProtocolMetrics / fetchPosition.
vi.mock("@/lib/markets", () => ({ MARKETS: [] }));

import {
  fetchPosition,
  fetchProtocolMetrics,
} from "@/lib/api/lending";
import { ContractNotConfiguredError, UpstreamRpcError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the shape rpc.Api.isSimulationError returns `false` for — a successful
 * simulation with a single return value encoded as an ScVal.
 */
function successResponse(retval: xdr.ScVal) {
  return {
    _parsed: true,
    latestLedger: 100,
    result: { auth: [], retval },
  } as unknown as rpc.Api.SimulateTransactionSuccessResponse;
}

/** Build the shape rpc.Api.isSimulationError returns `true` for. */
function errorResponse(error = "contract execution failed") {
  return { error, latestLedger: 100 };
}

/** Encode a plain JS object as an ScVal map so scValToNative round-trips it. */
function scMap(obj: Record<string, unknown>) {
  return nativeToScVal(obj);
}

const LENDING_ID = VALID_CONTRACT_ID;
const USER_ADDRESS =
  "GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH";

// ---------------------------------------------------------------------------
// fetchProtocolMetrics
// ---------------------------------------------------------------------------

describe("fetchProtocolMetrics", () => {
  beforeEach(() => {
    mocks.lendingId = LENDING_ID;
    mocks.simulateTransaction.mockReset();
  });

  it("decodes all fields and returns bigint values", async () => {
    mocks.simulateTransaction.mockResolvedValue(
      successResponse(
        scMap({
          total_supply: 1_000_000n,
          total_borrow: 400_000n,
          utilization_bps: 4_000n,
          ledger: 99n,
        }),
      ),
    );

    const result = await fetchProtocolMetrics();

    expect(result.totalSupply).toBe(1_000_000n);
    expect(result.totalBorrow).toBe(400_000n);
    expect(result.utilizationBps).toBe(4_000n);
    expect(result.ledger).toBe(99);
  });

  it("fetchedAt is a valid ISO 8601 timestamp", async () => {
    mocks.simulateTransaction.mockResolvedValue(
      successResponse(
        scMap({
          total_supply: 0n,
          total_borrow: 0n,
          utilization_bps: 0n,
          ledger: 1n,
        }),
      ),
    );

    const before = Date.now();
    const result = await fetchProtocolMetrics();
    const after = Date.now();

    const ts = new Date(result.fetchedAt).getTime();
    expect(Number.isNaN(ts)).toBe(false);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
    // ISO 8601 format: ends with 'Z'
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$/);
  });

  it("handles zero total_supply without throwing (no divide-by-zero)", async () => {
    mocks.simulateTransaction.mockResolvedValue(
      successResponse(
        scMap({
          total_supply: 0n,
          total_borrow: 0n,
          utilization_bps: 0n,
          ledger: 1n,
        }),
      ),
    );

    await expect(fetchProtocolMetrics()).resolves.toMatchObject({
      totalSupply: 0n,
      totalBorrow: 0n,
      utilizationBps: 0n,
    });
  });

  it("returns utilizationBps of 10 000 when fully utilised (100 %)", async () => {
    mocks.simulateTransaction.mockResolvedValue(
      successResponse(
        scMap({
          total_supply: 1_000_000n,
          total_borrow: 1_000_000n,
          utilization_bps: 10_000n,
          ledger: 50n,
        }),
      ),
    );

    const result = await fetchProtocolMetrics();
    expect(result.utilizationBps).toBe(10_000n);
  });

  it("throws ContractNotConfiguredError when lendingId is empty", async () => {
    mocks.lendingId = "";

    await expect(fetchProtocolMetrics()).rejects.toThrow(
      ContractNotConfiguredError,
    );
    expect(mocks.simulateTransaction).not.toHaveBeenCalled();
  });

  it("throws UpstreamRpcError when simulateTransaction rejects (network failure)", async () => {
    mocks.simulateTransaction.mockRejectedValue(new Error("connection refused"));

    await expect(fetchProtocolMetrics()).rejects.toThrow(UpstreamRpcError);
  });

  it("throws UpstreamRpcError when the simulation returns an error response", async () => {
    mocks.simulateTransaction.mockResolvedValue(errorResponse("HostError: some contract error"));

    await expect(fetchProtocolMetrics()).rejects.toThrow(UpstreamRpcError);
  });

  it("throws UpstreamRpcError when the simulation result has no retval", async () => {
    mocks.simulateTransaction.mockResolvedValue({
      _parsed: true,
      latestLedger: 100,
      // result is intentionally absent
    });

    await expect(fetchProtocolMetrics()).rejects.toThrow(UpstreamRpcError);
  });

  it("preserves UpstreamRpcError as the thrown type (not a plain Error)", async () => {
    mocks.simulateTransaction.mockRejectedValue(new Error("timeout"));

    const err = await fetchProtocolMetrics().catch((e) => e);
    expect(err).toBeInstanceOf(UpstreamRpcError);
    expect(err.name).toBe("UpstreamRpcError");
  });

  it("throws UpstreamRpcError when total_supply field is not a valid integer", async () => {
    mocks.simulateTransaction.mockResolvedValue(
      successResponse(
        scMap({
          total_supply: "not-a-number",
          total_borrow: 0n,
          utilization_bps: 0n,
          ledger: 1n,
        }),
      ),
    );

    await expect(fetchProtocolMetrics()).rejects.toThrow(UpstreamRpcError);
  });
});

// ---------------------------------------------------------------------------
// fetchPosition
// ---------------------------------------------------------------------------

describe("fetchPosition", () => {
  beforeEach(() => {
    mocks.lendingId = LENDING_ID;
    mocks.simulateTransaction.mockReset();
  });

  it("decodes all fields as bigint values", async () => {
    mocks.simulateTransaction.mockResolvedValue(
      successResponse(
        scMap({
          collateral: 2_000n,
          debt: 500n,
          health_factor: 8_000n,
        }),
      ),
    );

    const result = await fetchPosition(USER_ADDRESS);

    expect(result.collateral).toBe(2_000n);
    expect(result.debt).toBe(500n);
    expect(result.healthFactor).toBe(8_000n);
  });

  it("fetchedAt is a valid ISO 8601 timestamp", async () => {
    mocks.simulateTransaction.mockResolvedValue(
      successResponse(
        scMap({ collateral: 0n, debt: 0n, health_factor: 0n }),
      ),
    );

    const result = await fetchPosition(USER_ADDRESS);

    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$/);
    expect(Number.isNaN(new Date(result.fetchedAt).getTime())).toBe(false);
  });

  it("passes the caller address as the first argument to get_position", async () => {
    mocks.simulateTransaction.mockResolvedValue(
      successResponse(
        scMap({ collateral: 0n, debt: 0n, health_factor: 0n }),
      ),
    );

    await fetchPosition(USER_ADDRESS);

    // The transaction passed to simulateTransaction encodes the address as an
    // Address ScVal in the invoke-contract operation args.
    const tx = mocks.simulateTransaction.mock.calls[0]?.[0] as {
      operations: Array<{
        func: {
          invokeContract: {
            functionName: { toString(): string };
            args: xdr.ScVal[];
          };
        };
      }>;
    };

    const invoke = tx.operations[0]?.func.invokeContract;
    expect(invoke?.functionName.toString()).toBe("get_position");

    const { scValToNative } = await import("@stellar/stellar-sdk");
    const decodedArg = scValToNative(invoke!.args[0]!);
    expect(decodedArg).toBe(USER_ADDRESS);
  });

  it("throws ContractNotConfiguredError when lendingId is empty", async () => {
    mocks.lendingId = "";

    await expect(fetchPosition(USER_ADDRESS)).rejects.toThrow(
      ContractNotConfiguredError,
    );
    expect(mocks.simulateTransaction).not.toHaveBeenCalled();
  });

  it("throws UpstreamRpcError when simulateTransaction rejects", async () => {
    mocks.simulateTransaction.mockRejectedValue(new Error("network error"));

    await expect(fetchPosition(USER_ADDRESS)).rejects.toThrow(UpstreamRpcError);
  });

  it("throws UpstreamRpcError when the simulation returns an error response", async () => {
    mocks.simulateTransaction.mockResolvedValue(errorResponse());

    await expect(fetchPosition(USER_ADDRESS)).rejects.toThrow(UpstreamRpcError);
  });

  it("preserves UpstreamRpcError as the thrown type (not a plain Error)", async () => {
    mocks.simulateTransaction.mockRejectedValue(new Error("timeout"));

    const err = await fetchPosition(USER_ADDRESS).catch((e) => e);
    expect(err).toBeInstanceOf(UpstreamRpcError);
    expect(err.name).toBe("UpstreamRpcError");
  });

  it("throws UpstreamRpcError when a bigint field is missing from the result", async () => {
    mocks.simulateTransaction.mockResolvedValue(
      successResponse(
        // health_factor intentionally absent
        scMap({ collateral: 1_000n, debt: 100n }),
      ),
    );

    await expect(fetchPosition(USER_ADDRESS)).rejects.toThrow(UpstreamRpcError);
  });

  it("handles a position with zero collateral and zero debt without throwing", async () => {
    mocks.simulateTransaction.mockResolvedValue(
      successResponse(
        scMap({ collateral: 0n, debt: 0n, health_factor: 0n }),
      ),
    );

    await expect(fetchPosition(USER_ADDRESS)).resolves.toMatchObject({
      collateral: 0n,
      debt: 0n,
      healthFactor: 0n,
    });
  });
});
