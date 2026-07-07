/**
 * Domain-specific error classes for API route handlers.
 * Each class carries a `statusCode` so handlers can map errors to HTTP status
 * codes without coupling routing logic to business logic.
 */

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

export type ValidationFieldErrors = Record<string, string[]>;

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string | null;
    details?: ValidationFieldErrors;
  };
}

export class ValidationError extends Error {
  readonly statusCode = 400;

  constructor(
    message: string,
    readonly details?: ValidationFieldErrors,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class AuthError extends Error {
  readonly statusCode = 401;

  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class UpstreamError extends Error {
  readonly statusCode = 502;

  constructor(message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

export function getApiErrorStatus(error: unknown): number {
  if (
    error instanceof ValidationError ||
    error instanceof AuthError ||
    error instanceof UpstreamError
  ) {
    return error.statusCode;
  }

  return 500;
}

export function toApiErrorEnvelope(
  error: unknown,
  options: { requestId?: string | null } = {},
): ApiErrorEnvelope {
  const requestId = options.requestId ?? null;

  if (error instanceof ValidationError) {
    return {
      error: {
        code: "VALIDATION_ERROR",
        message: error.message,
        requestId,
        ...(error.details ? { details: error.details } : {}),
      },
    };
  }

  if (error instanceof AuthError) {
    return {
      error: {
        code: "AUTHENTICATION_ERROR",
        message: error.message,
        requestId,
      },
    };
  }

  if (error instanceof UpstreamError) {
    return {
      error: {
        code: "UPSTREAM_ERROR",
        message: error.message,
        requestId,
      },
    };
  }

  return {
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      requestId,
    },
  };
}
