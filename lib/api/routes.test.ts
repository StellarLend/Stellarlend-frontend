// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiCaches } from "./cache";
import { ContractNotConfiguredError, UpstreamRpcError } from "./errors";
import { resetApiRateLimiter } from "./rate-limit";
import type { PositionSummary, ProtocolMetrics } from "./lending";

const mocks = vi.hoisted(() => ({
  fetchProtocolMetrics: vi.fn(),
  fetchPosition: vi.fn(),
}));

vi.mock("@/lib/api/lending", () => ({
  fetchProtocolMetrics: mocks.fetchProtocolMetrics,
  fetchPosition: mocks.fetchPosition,
}));

import { GET as getProtocol } from "@/app/api/v1/protocol/route";
import { GET as getPosition } from "@/app/api/v1/positions/[address]/route";

const VALID_ADDRESS =
  "GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH";
const FIXED_FETCHED_AT = "2026-10-19T12:00:00.000Z";

function protocolRequest(ip = "203.0.113.10"): Request {
  return new Request("http://localhost/api/v1/protocol", {
    headers: { "x-forwarded-for": ip },
  });
}

function positionRequest(
  address: string,
  ip = "203.0.113.11",
): Request {
  return new Request(`http://localhost/api/v1/positions/${address}`, {
    headers: { "x-forwarded-for": ip },
  });
}

function positionContext(address: string) {
  return { params: Promise.resolve({ address }) };
}

function protocolMetrics(
  overrides: Partial<ProtocolMetrics> = {},
): ProtocolMetrics {
  return {
    totalSupply: 1_000n,
    totalBorrow: 400n,
    utilizationBps: 4_000n,
    ledger: 123,
    fetchedAt: FIXED_FETCHED_AT,
    ...overrides,
  };
}

function positionSummary(
  overrides: Partial<PositionSummary> = {},
): PositionSummary {
  return {
    collateral: 2_000n,
    debt: 500n,
    healthFactor: 8_000n,
    fetchedAt: FIXED_FETCHED_AT,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetApiCaches();
  resetApiRateLimiter();
  mocks.fetchProtocolMetrics.mockResolvedValue(protocolMetrics());
  mocks.fetchPosition.mockResolvedValue(positionSummary());
});

describe("GET /api/v1/protocol", () => {
  it("returns the documented shape with string-encoded i128 values", async () => {
    const response = await getProtocol(protocolRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=15");
    expect(response.headers.get("Cache-Control")).toContain(
      "stale-while-revalidate=60",
    );
    await expect(response.json()).resolves.toEqual({
      totalSupply: "1000",
      totalBorrow: "400",
      utilizationBps: "4000",
      ledger: 123,
      fetchedAt: FIXED_FETCHED_AT,
    });
  });

  it("serialises values above 2^53 without precision loss", async () => {
    const totalSupply = 2n ** 54n + 1n;
    const totalBorrow = 2n ** 60n + 3n;
    const utilizationBps = 2n ** 53n + 7n;

    mocks.fetchProtocolMetrics.mockResolvedValueOnce(
      protocolMetrics({ totalSupply, totalBorrow, utilizationBps }),
    );

    const body = (await (
      await getProtocol(protocolRequest())
    ).json()) as Record<string, unknown>;

    expect(body.totalSupply).toBe(totalSupply.toString());
    expect(body.totalBorrow).toBe(totalBorrow.toString());
    expect(body.utilizationBps).toBe(utilizationBps.toString());
  });

  it("collapses 100 concurrent requests into one upstream read", async () => {
    let resolveMetrics!: (value: ProtocolMetrics) => void;
    mocks.fetchProtocolMetrics.mockReturnValueOnce(
      new Promise<ProtocolMetrics>((resolve) => {
        resolveMetrics = resolve;
      }),
    );

    const requests = Array.from({ length: 100 }, (_, index) =>
      getProtocol(protocolRequest(`10.0.0.${index + 1}`)),
    );

    await Promise.resolve();
    expect(mocks.fetchProtocolMetrics).toHaveBeenCalledTimes(1);

    resolveMetrics(protocolMetrics());
    const responses = await Promise.all(requests);

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(mocks.fetchProtocolMetrics).toHaveBeenCalledTimes(1);
  });

  it("serves a cached value within the TTL", async () => {
    await getProtocol(protocolRequest("203.0.113.12"));
    await getProtocol(protocolRequest("203.0.113.13"));

    expect(mocks.fetchProtocolMetrics).toHaveBeenCalledTimes(1);
  });

  it("returns 502 when the upstream RPC fails", async () => {
    mocks.fetchProtocolMetrics.mockRejectedValueOnce(
      new UpstreamRpcError("simulation failed"),
    );

    const response = await getProtocol(protocolRequest("203.0.113.14"));

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UPSTREAM_RPC_ERROR",
        message: "Failed to read from Soroban RPC",
      },
    });
  });

  it("returns 429 with Retry-After after the rate limit is exhausted", async () => {
    const ip = "203.0.113.16";
    for (let index = 0; index < 120; index += 1) {
      const response = await getProtocol(protocolRequest(ip));
      expect(response.status).toBe(200);
    }

    const blocked = await getProtocol(protocolRequest(ip));

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Cache-Control")).toBe("no-store");
    expect(blocked.headers.get("Retry-After")).toBe("1");
    await expect(blocked.json()).resolves.toEqual({
      error: { code: "RATE_LIMITED", message: "Too many requests" },
    });
  });
});

describe("GET /api/v1/positions/[address]", () => {
  it("returns a position with string-encoded i128 values", async () => {
    const response = await getPosition(
      positionRequest(VALID_ADDRESS),
      positionContext(VALID_ADDRESS),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=10");
    await expect(response.json()).resolves.toEqual({
      address: VALID_ADDRESS,
      collateral: "2000",
      debt: "500",
      healthFactor: "8000",
      fetchedAt: FIXED_FETCHED_AT,
    });
  });

  it("returns 400 for an invalid Stellar address", async () => {
    const response = await getPosition(
      positionRequest("not-an-address"),
      positionContext("not-an-address"),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_ADDRESS",
        message: "Invalid Stellar address",
      },
    });
    expect(mocks.fetchPosition).not.toHaveBeenCalled();
  });

  it("returns 503 when the lending contract is not configured", async () => {
    mocks.fetchPosition.mockRejectedValueOnce(
      new ContractNotConfiguredError(),
    );

    const response = await getPosition(
      positionRequest(VALID_ADDRESS, "203.0.113.15"),
      positionContext(VALID_ADDRESS),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "CONTRACT_NOT_CONFIGURED",
        message: "Lending contract is not configured",
      },
    });
  });
});
