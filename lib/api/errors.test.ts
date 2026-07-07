import { describe, expect, it } from "vitest";
import {
  AuthError,
  UpstreamError,
  ValidationError,
  getApiErrorStatus,
  toApiErrorEnvelope,
} from "./errors";

describe("lib/api/errors", () => {
  it("maps domain errors to stable HTTP status codes", () => {
    expect(getApiErrorStatus(new ValidationError("Invalid profile"))).toBe(400);
    expect(getApiErrorStatus(new AuthError("Unauthorized"))).toBe(401);
    expect(getApiErrorStatus(new UpstreamError("Horizon unavailable"))).toBe(
      502,
    );
  });

  it("falls back to a safe 500 status for unknown errors", () => {
    expect(
      getApiErrorStatus(new Error("database password leaked in message")),
    ).toBe(500);
    expect(getApiErrorStatus("unexpected string failure")).toBe(500);
  });

  it("builds a validation envelope with request id and field details", () => {
    const envelope = toApiErrorEnvelope(
      new ValidationError("Invalid request body", {
        email: ["email is required", "email must be valid"],
        wallet: ["wallet address is invalid"],
      }),
      { requestId: "01HZ0000000000000000000000" },
    );

    expect(envelope).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request body",
        requestId: "01HZ0000000000000000000000",
        details: {
          email: ["email is required", "email must be valid"],
          wallet: ["wallet address is invalid"],
        },
      },
    });
  });

  it("builds auth and upstream envelopes without validation details", () => {
    expect(toApiErrorEnvelope(new AuthError("Session required"))).toEqual({
      error: {
        code: "AUTHENTICATION_ERROR",
        message: "Session required",
        requestId: null,
      },
    });

    expect(
      toApiErrorEnvelope(new UpstreamError("Price oracle unavailable"), {
        requestId: "req-123",
      }),
    ).toEqual({
      error: {
        code: "UPSTREAM_ERROR",
        message: "Price oracle unavailable",
        requestId: "req-123",
      },
    });
  });

  it("sanitizes unknown and nested errors without leaking internals", () => {
    const error = new Error("postgres://user:secret@example/db failed", {
      cause: new Error("nested token should stay private"),
    });

    expect(toApiErrorEnvelope(error, { requestId: "req-private" })).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        requestId: "req-private",
      },
    });
  });
});
