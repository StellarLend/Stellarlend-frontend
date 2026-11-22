// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { ApiClientError, fetchPosition, fetchProtocol } from "./client";
import {
  ApiErrorBodySchema,
  DecimalStringSchema,
  PositionResponseSchema,
  ProtocolResponseSchema,
} from "./schema";

const VALID_ADDRESS =
  "GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH";
const VALID_PROTOCOL_PAYLOAD = {
  totalSupply: "100000000000000000000",
  totalBorrow: "40000000000000000000",
  utilizationBps: "4000",
  ledger: 123456,
  fetchedAt: "2026-10-19T12:00:00.000Z",
};
const VALID_POSITION_PAYLOAD = {
  address: VALID_ADDRESS,
  collateral: "2000",
  debt: "500",
  healthFactor: "8000",
  fetchedAt: "2026-10-19T12:00:00.000Z",
};

function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("API zod schemas", () => {
  it("validates decimal integer strings and rejects non-decimal values", () => {
    expect(DecimalStringSchema.parse("0")).toBe("0");
    expect(DecimalStringSchema.parse("18446744073709551617")).toBe(
      "18446744073709551617",
    );
    expect(DecimalStringSchema.parse("-42")).toBe("-42");

    expect(() => DecimalStringSchema.parse("12.34")).toThrow();
    expect(() => DecimalStringSchema.parse("abc")).toThrow();
    expect(() => DecimalStringSchema.parse("")).toThrow();
    expect(() => DecimalStringSchema.parse(" 100 ")).toThrow();
  });

  it("parses valid protocol, position, and error envelopes", () => {
    expect(ProtocolResponseSchema.parse(VALID_PROTOCOL_PAYLOAD)).toEqual(
      VALID_PROTOCOL_PAYLOAD,
    );
    expect(PositionResponseSchema.parse(VALID_POSITION_PAYLOAD)).toEqual(
      VALID_POSITION_PAYLOAD,
    );
    expect(
      ApiErrorBodySchema.parse({
        error: { code: "UPSTREAM_RPC_ERROR", message: "RPC failed" },
      }),
    ).toEqual({
      error: { code: "UPSTREAM_RPC_ERROR", message: "RPC failed" },
    });
  });
});

describe("API client", () => {
  it("fetches and parses protocol metrics", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(mockJsonResponse(VALID_PROTOCOL_PAYLOAD));

    const result = await fetchProtocol({ fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/protocol",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result).toEqual(VALID_PROTOCOL_PAYLOAD);
  });

  it("fetches and parses a user position", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(mockJsonResponse(VALID_POSITION_PAYLOAD));

    const result = await fetchPosition(VALID_ADDRESS, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/positions/${VALID_ADDRESS}`,
      expect.objectContaining({ method: "GET" }),
    );
    expect(result).toEqual(VALID_POSITION_PAYLOAD);
  });

  it("throws ApiClientError with INVALID_RESPONSE when a required field is missing", async () => {
    const { totalBorrow: _omitted, ...missingField } = VALID_PROTOCOL_PAYLOAD;
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(mockJsonResponse(missingField));

    await expect(fetchProtocol({ fetchImpl })).rejects.toMatchObject({
      name: "ApiClientError",
      code: "INVALID_RESPONSE",
      status: 200,
    });
  });

  it("throws ApiClientError with INVALID_RESPONSE when a bigint-as-string field is malformed", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      mockJsonResponse({
        ...VALID_POSITION_PAYLOAD,
        collateral: "12.5",
      }),
    );

    const err = await fetchPosition(VALID_ADDRESS, { fetchImpl }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).code).toBe("INVALID_RESPONSE");
  });

  it("surfaces structured API error codes on non-2xx responses", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      mockJsonResponse(
        {
          error: {
            code: "UPSTREAM_RPC_ERROR",
            message: "Failed to read from Soroban RPC",
          },
        },
        502,
      ),
    );

    await expect(fetchProtocol({ fetchImpl })).rejects.toMatchObject({
      name: "ApiClientError",
      code: "UPSTREAM_RPC_ERROR",
      message: "Failed to read from Soroban RPC",
      status: 502,
    });
  });

  it("throws ApiClientError with TIMEOUT when the request exceeds timeoutMs", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    await expect(
      fetchProtocol({ fetchImpl, timeoutMs: 15 }),
    ).rejects.toMatchObject({
      name: "ApiClientError",
      code: "TIMEOUT",
    });
  });

  it("throws ApiClientError with NETWORK_ERROR when fetch rejects", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(fetchProtocol({ fetchImpl })).rejects.toMatchObject({
      name: "ApiClientError",
      code: "NETWORK_ERROR",
    });
  });
});
