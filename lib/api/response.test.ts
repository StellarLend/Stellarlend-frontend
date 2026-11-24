// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { ContractNotConfiguredError, UpstreamRpcError } from "./errors";
import {
  errorResponse,
  etagFor,
  jsonResponse,
  mapApiError,
  normalizeRequestId,
  withRequestId,
} from "./response";

describe("jsonResponse", () => {
  it("returns the body with the provided status and Cache-Control header", async () => {
    const response = jsonResponse({ ok: true }, 201, "public, max-age=60");

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("ETag")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns 304 when etag matches", async () => {
    const payload = { ledger: 123, value: "test" };
    const etag = etagFor(payload);
    const request = new Request("http://localhost/api/v1/protocol", {
      headers: { "if-none-match": etag },
    });

    const response = jsonResponse(payload, 200, "public, max-age=60", request);
    expect(response.status).toBe(304);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(response.headers.get("ETag")).toBe(etag);
    const text = await response.text();
    expect(text).toBe("");
  });

  it("etag changes with ledger", () => {
    const payload1 = { ledger: 100, value: "test" };
    const payload2 = { ledger: 101, value: "test" };
    const etag1 = etagFor(payload1);
    const etag2 = etagFor(payload2);
    expect(etag1).not.toBe(etag2);
  });
});

describe("mapApiError", () => {
  it("maps ContractNotConfiguredError to a no-store 503 response", async () => {
    const response = mapApiError(new ContractNotConfiguredError());

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "CONTRACT_NOT_CONFIGURED",
        message: "Lending contract is not configured",
      },
    });
  });

  it("maps UpstreamRpcError to a no-store 502 response", async () => {
    const response = mapApiError(new UpstreamRpcError("internal RPC detail"));

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UPSTREAM_RPC_ERROR",
        message: "Failed to read from Soroban RPC",
      },
    });
  });

  it("returns a generic no-store 500 response for unknown errors", async () => {
    const response = mapApiError(new Error("db password=secret"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error",
      },
    });
    expect(JSON.stringify(body)).not.toContain("db password=secret");
  });
});

describe("errorResponse", () => {
  it("merges extra headers with the no-store cache header and includes requestId", async () => {
    const response = errorResponse(
      "UPSTREAM_RPC_ERROR",
      "Try again later",
      502,
      { "Retry-After": "3" },
      "req-12345678",
    );

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Retry-After")).toBe("3");
    expect(response.headers.get("x-request-id")).toBe("req-12345678");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UPSTREAM_RPC_ERROR",
        message: "Try again later",
        requestId: "req-12345678",
      },
    });
  });
});

describe("withRequestId", () => {
  it("echoes valid incoming id", async () => {
    const validId = "custom-request-id-12345";
    const handler = withRequestId(async () => {
      return jsonResponse({ ok: true }, 200, "no-store");
    });

    const req = new Request("http://localhost/api/test", {
      headers: { "x-request-id": validId },
    });
    const res = await handler(req, {});
    expect(res.headers.get("x-request-id")).toBe(validId);
  });

  it("replaces invalid id", async () => {
    const invalidId = "bad!";
    const handler = withRequestId(async () => {
      return jsonResponse({ ok: true }, 200, "no-store");
    });

    const req = new Request("http://localhost/api/test", {
      headers: { "x-request-id": invalidId },
    });
    const res = await handler(req, {});
    const outId = res.headers.get("x-request-id");
    expect(outId).not.toBe(invalidId);
    expect(normalizeRequestId(outId)).toBe(outId);
  });

  it("logs 5xx once with redaction", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withRequestId(async () => {
      throw new UpstreamRpcError("Failed for GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH");
    });

    const req = new Request(
      "http://localhost/api/v1/positions/GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH",
      { headers: { "x-request-id": "req-id-123456" } },
    );

    const res = await handler(req, {});
    expect(res.status).toBe(502);
    expect(consoleSpy).toHaveBeenCalledTimes(1);

    const logLine = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(logLine);
    expect(parsed.status).toBe(502);
    expect(parsed.requestId).toBe("req-id-123456");
    expect(parsed.code).toBe("UPSTREAM_RPC_ERROR");
    expect(logLine).not.toContain("GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH");
    expect(logLine).toContain("GA5W...SKYH");

    consoleSpy.mockRestore();
  });
});
