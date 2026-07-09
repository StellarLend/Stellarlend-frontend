import { describe, it, expect } from "vitest";
import { ValidationError, AuthError, UpstreamError } from "./errors";

// ---------------------------------------------------------------------------
// ValidationError
// ---------------------------------------------------------------------------
describe("ValidationError", () => {
  it("has the correct name", () => {
    const err = new ValidationError("missing field");
    expect(err.name).toBe("ValidationError");
  });

  it("sets statusCode to 400", () => {
    const err = new ValidationError("bad input");
    expect(err.statusCode).toBe(400);
  });

  it("stores the message provided at construction time", () => {
    const err = new ValidationError("email is required");
    expect(err.message).toBe("email is required");
  });

  it("is an instance of Error", () => {
    const err = new ValidationError("fail");
    expect(err).toBeInstanceOf(Error);
  });

  it("is an instance of ValidationError", () => {
    const err = new ValidationError("fail");
    expect(err).toBeInstanceOf(ValidationError);
  });

  it("preserves the stack trace", () => {
    const err = new ValidationError("stack test");
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("ValidationError");
  });

  it("handles an empty message", () => {
    const err = new ValidationError("");
    expect(err.message).toBe("");
  });

  it("handles special characters in the message", () => {
    const msg = '<>"\'`&\\/\n\t';
    const err = new ValidationError(msg);
    expect(err.message).toBe(msg);
  });

  it("handles a long message", () => {
    const msg = "x".repeat(10_000);
    const err = new ValidationError(msg);
    expect(err.message).toBe(msg);
    expect(err.message.length).toBe(10_000);
  });
});

// ---------------------------------------------------------------------------
// AuthError
// ---------------------------------------------------------------------------
describe("AuthError", () => {
  it("has the correct name", () => {
    const err = new AuthError("unauthorized");
    expect(err.name).toBe("AuthError");
  });

  it("sets statusCode to 401", () => {
    const err = new AuthError("no token");
    expect(err.statusCode).toBe(401);
  });

  it("stores the message provided at construction time", () => {
    const err = new AuthError("session expired");
    expect(err.message).toBe("session expired");
  });

  it("is an instance of Error", () => {
    const err = new AuthError("fail");
    expect(err).toBeInstanceOf(Error);
  });

  it("is an instance of AuthError", () => {
    const err = new AuthError("fail");
    expect(err).toBeInstanceOf(AuthError);
  });

  it("preserves the stack trace", () => {
    const err = new AuthError("stack test");
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("AuthError");
  });

  it("handles an empty message", () => {
    const err = new AuthError("");
    expect(err.message).toBe("");
  });

  it("handles special characters in the message", () => {
    const msg = '{"error":"invalid token"}';
    const err = new AuthError(msg);
    expect(err.message).toBe(msg);
  });

  it("handles a long message", () => {
    const msg = "x".repeat(5_000);
    const err = new AuthError(msg);
    expect(err.message.length).toBe(5_000);
  });
});

// ---------------------------------------------------------------------------
// UpstreamError
// ---------------------------------------------------------------------------
describe("UpstreamError", () => {
  it("has the correct name", () => {
    const err = new UpstreamError("downstream timeout");
    expect(err.name).toBe("UpstreamError");
  });

  it("sets statusCode to 502", () => {
    const err = new UpstreamError("bad gateway");
    expect(err.statusCode).toBe(502);
  });

  it("stores the message provided at construction time", () => {
    const err = new UpstreamError("stellar RPC unreachable");
    expect(err.message).toBe("stellar RPC unreachable");
  });

  it("is an instance of Error", () => {
    const err = new UpstreamError("fail");
    expect(err).toBeInstanceOf(Error);
  });

  it("is an instance of UpstreamError", () => {
    const err = new UpstreamError("fail");
    expect(err).toBeInstanceOf(UpstreamError);
  });

  it("preserves the stack trace", () => {
    const err = new UpstreamError("stack test");
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("UpstreamError");
  });

  it("handles an empty message", () => {
    const err = new UpstreamError("");
    expect(err.message).toBe("");
  });

  it("handles special characters in the message", () => {
    const msg = "HTTP 502: upstream timeout (retry: 3/3)";
    const err = new UpstreamError(msg);
    expect(err.message).toBe(msg);
  });
});

// ---------------------------------------------------------------------------
// Cross-error type discrimination
// ---------------------------------------------------------------------------
describe("error type discrimination", () => {
  it("validation errors are not auth errors", () => {
    const err = new ValidationError("v");
    expect(err).not.toBeInstanceOf(AuthError);
  });

  it("auth errors are not upstream errors", () => {
    const err = new AuthError("a");
    expect(err).not.toBeInstanceOf(UpstreamError);
  });

  it("upstream errors are not validation errors", () => {
    const err = new UpstreamError("u");
    expect(err).not.toBeInstanceOf(ValidationError);
  });

  it("each error type carries a unique status code", () => {
    const codes = [
      new ValidationError("").statusCode,
      new AuthError("").statusCode,
      new UpstreamError("").statusCode,
    ];
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(3);
  });

  it("statusCode is read-only (enforced at type level)", () => {
    const err = new ValidationError("some error");
    // TypeScript enforces `readonly` — the value must remain 400.
    expect(err.statusCode).toBe(400);
  });
});
