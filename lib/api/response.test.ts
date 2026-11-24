// @vitest-environment node

import { describe, expect, it } from "vitest";
import { ContractNotConfiguredError, UpstreamRpcError } from "./errors";
import { errorResponse, jsonResponse, mapApiError } from "./response";

describe("jsonResponse", () => {
  it("returns the body with the provided status and Cache-Control header", async () => {
    const response = jsonResponse({ ok: true }, 201, "public, max-age=60");

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(response.headers.get("Content-Type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ ok: true });
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
  it("merges extra headers with the no-store cache header", async () => {
    const response = errorResponse(
      "UPSTREAM_RPC_ERROR",
      "Try again later",
      502,
      { "Retry-After": "3" },
    );

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Retry-After")).toBe("3");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UPSTREAM_RPC_ERROR",
        message: "Try again later",
      },
    });
  });
});
