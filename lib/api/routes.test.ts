// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiCaches } from "./cache";
import { ContractNotConfiguredError, UpstreamRpcError } from "./errors";
import { resetApiRateLimiter } from "./rate-limit";
import type {
  MarketsSnapshot,
  PositionSummary,
  ProtocolMetrics,
} from "./lending";
import {
  ApiErrorBodySchema,
  PositionResponseSchema,
  ProtocolResponseSchema,
} from "./schema";

const mocks = vi.hoisted(() => ({
  fetchProtocolMetrics: vi.fn(),
  fetchPosition: vi.fn(),
  fetchMarkets: vi.fn(),
}));

vi.mock("@/lib/api/lending", () => ({
  fetchProtocolMetrics: mocks.fetchProtocolMetrics,
  fetchPosition: mocks.fetchPosition,
  fetchMarkets: mocks.fetchMarkets,
}));

import { GET as getProtocol } from "@/app/api/v1/protocol/route";
import { GET as getPosition } from "@/app/api/v1/positions/[address]/route";
import { GET as getMarkets } from "@/app/api/v1/markets/route";

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

function marketsRequest(ip = "203.0.113.20"): Request {
  return new Request("http://localhost/api/v1/markets", {
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

function marketsSnapshot(
  overrides: Partial<MarketsSnapshot> = {},
): MarketsSnapshot {
  return {
    markets: [
      {
        symbol: "XLM",
        name: "Stellar Lumens",
        supplyApy: 3.4,
        borrowApy: 6.1,
        utilizationBps: 4_440n,
        supplyCap: 2n ** 54n + 1n,
        borrowCap: 2n ** 53n + 7n,
        oraclePrice: 1_200_000n,
        ltvBps: 7_000,
        liqThresholdBps: 8_000,
        active: true,
      },
    ],
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
  mocks.fetchMarkets.mockResolvedValue(marketsSnapshot());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/v1/protocol", () => {
  it("returns the documented shape with string-encoded i128 values", async () => {
    const response = await getProtocol(protocolRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=15");
    expect(response.headers.get("Cache-Control")).toContain(
      "stale-while-revalidate=60",
    );
    expect(response.headers.get("X-Cache")).toBeNull();
    const parsed = ProtocolResponseSchema.parse(await response.json());
    expect(parsed).toEqual({
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

    const body = ProtocolResponseSchema.parse(
      await (await getProtocol(protocolRequest())).json(),
    );

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
    const body = ApiErrorBodySchema.parse(await response.json());
    expect(body).toEqual({
      error: {
        code: "UPSTREAM_RPC_ERROR",
        message: "Failed to read from Soroban RPC",
      },
    });
  });

  it("serves stale protocol data with an explicit cache header after refresh failure", async () => {
    await getProtocol(protocolRequest("203.0.113.26"));
    mocks.fetchProtocolMetrics.mockRejectedValueOnce(
      new UpstreamRpcError("temporary failure"),
    );

    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 16_000);
    const response = await getProtocol(protocolRequest("203.0.113.27"));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Cache")).toBe("stale");
    expect(ProtocolResponseSchema.parse(await response.json())).toEqual({
      totalSupply: "1000",
      totalBorrow: "400",
      utilizationBps: "4000",
      ledger: 123,
      fetchedAt: FIXED_FETCHED_AT,
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
    const body = ApiErrorBodySchema.parse(await blocked.json());
    expect(body).toEqual({
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
    const body = PositionResponseSchema.parse(await response.json());
    expect(body).toEqual({
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
    const body = ApiErrorBodySchema.parse(await response.json());
    expect(body).toEqual({
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
    const body = ApiErrorBodySchema.parse(await response.json());
    expect(body).toEqual({
      error: {
        code: "CONTRACT_NOT_CONFIGURED",
        message: "Lending contract is not configured",
      },
    });
  });
});

describe("GET /api/v1/markets", () => {
  it("markets route returns string-encoded bigints", async () => {
    const response = await getMarkets(marketsRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=15");
    expect(response.headers.get("Cache-Control")).toContain(
      "stale-while-revalidate=60",
    );
    await expect(response.json()).resolves.toEqual({
      markets: [
        {
          symbol: "XLM",
          name: "Stellar Lumens",
          supplyApy: 3.4,
          borrowApy: 6.1,
          utilizationBps: "4440",
          supplyCap: (2n ** 54n + 1n).toString(),
          borrowCap: (2n ** 53n + 7n).toString(),
          oraclePrice: "1200000",
          ltvBps: 7_000,
          liqThresholdBps: 8_000,
          active: true,
        },
      ],
      fetchedAt: FIXED_FETCHED_AT,
    });
  });

  it("markets route collapses concurrent requests into one upstream read", async () => {
    let resolveMarkets!: (value: MarketsSnapshot) => void;
    mocks.fetchMarkets.mockReturnValueOnce(
      new Promise<MarketsSnapshot>((resolve) => {
        resolveMarkets = resolve;
      }),
    );

    const requests = Array.from({ length: 50 }, (_, index) =>
      getMarkets(marketsRequest(`10.0.1.${index + 1}`)),
    );

    await Promise.resolve();
    expect(mocks.fetchMarkets).toHaveBeenCalledTimes(1);

    resolveMarkets(marketsSnapshot());
    const responses = await Promise.all(requests);

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(mocks.fetchMarkets).toHaveBeenCalledTimes(1);
  });

  it("markets route serves cached value within TTL", async () => {
    await getMarkets(marketsRequest("203.0.113.21"));
    await getMarkets(marketsRequest("203.0.113.22"));

    expect(mocks.fetchMarkets).toHaveBeenCalledTimes(1);
  });

  it("markets route 429s after bucket exhausted", async () => {
    const ip = "203.0.113.23";
    for (let index = 0; index < 120; index += 1) {
      const response = await getMarkets(marketsRequest(ip));
      expect(response.status).toBe(200);
    }

    const blocked = await getMarkets(marketsRequest(ip));

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Cache-Control")).toBe("no-store");
    expect(blocked.headers.get("Retry-After")).toBe("1");
    await expect(blocked.json()).resolves.toEqual({
      error: { code: "RATE_LIMITED", message: "Too many requests" },
    });
  });

  it("markets route maps upstream failure to 502", async () => {
    mocks.fetchMarkets.mockRejectedValueOnce(
      new UpstreamRpcError("simulation failed"),
    );

    const response = await getMarkets(marketsRequest("203.0.113.24"));

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UPSTREAM_RPC_ERROR",
        message: "Failed to read from Soroban RPC",
      },
    });
  });

  it("markets route returns 503 when the lending contract is not configured", async () => {
    mocks.fetchMarkets.mockRejectedValueOnce(new ContractNotConfiguredError());

    const response = await getMarkets(marketsRequest("203.0.113.25"));

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "CONTRACT_NOT_CONFIGURED",
        message: "Lending contract is not configured",
      },
    });
  });
});
