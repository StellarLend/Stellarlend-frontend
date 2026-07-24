import { describe, expect, it } from "vitest";

import {
  HttpError,
  NetworkError,
  RetryExhaustedError,
  TimeoutError,
  UpstreamHttpError,
} from "./errors";

describe("HttpError hierarchy", () => {
  it("constructs HttpError with its supplied fields", () => {
    const cause = new Error("invalid response");
    const error = new HttpError(
      "PARSE_ERROR",
      "Failed to parse response",
      502,
      cause,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("HttpError");
    expect(error.message).toBe("Failed to parse response");
    expect(error.code).toBe("PARSE_ERROR");
    expect(error.status).toBe(502);
    expect(error.cause).toBe(cause);
  });

  it("constructs TimeoutError with timeout details and the HttpError prototype chain", () => {
    const error = new TimeoutError("https://rpc.example.com", 5_000);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("TimeoutError");
    expect(error.message).toBe(
      "Request to https://rpc.example.com timed out after 5000ms",
    );
    expect(error.code).toBe("TIMEOUT");
    expect(error.status).toBeUndefined();
    expect(error.cause).toBeUndefined();
  });

  it("constructs NetworkError with its cause and the HttpError prototype chain", () => {
    const cause = new TypeError("fetch failed");
    const error = new NetworkError("https://rpc.example.com", cause);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("NetworkError");
    expect(error.message).toBe(
      "Network error fetching https://rpc.example.com",
    );
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.status).toBeUndefined();
    expect(error.cause).toBe(cause);
  });

  it("constructs UpstreamHttpError with its status and the HttpError prototype chain", () => {
    const error = new UpstreamHttpError("https://rpc.example.com", 503);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("UpstreamHttpError");
    expect(error.message).toBe("Upstream https://rpc.example.com returned 503");
    expect(error.code).toBe("HTTP_ERROR");
    expect(error.status).toBe(503);
    expect(error.cause).toBeUndefined();
  });

  it("constructs RetryExhaustedError from the last HttpError and preserves the hierarchy", () => {
    const lastError = new UpstreamHttpError("https://rpc.example.com", 503);
    const error = new RetryExhaustedError(
      "https://rpc.example.com",
      3,
      lastError,
    );

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("RetryExhaustedError");
    expect(error.message).toBe(
      "All 3 attempts failed for https://rpc.example.com: Upstream https://rpc.example.com returned 503",
    );
    expect(error.code).toBe("RETRY_EXHAUSTED");
    expect(error.status).toBe(503);
    expect(error.cause).toBe(lastError);
  });
});
