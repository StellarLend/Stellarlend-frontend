/**
 * Domain-specific error classes for API route handlers.
 * Each class carries a `statusCode` so the handler can map it to an HTTP status
 * without coupling routing logic to business logic.
 */

export class ValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthError extends Error {
  readonly statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class UpstreamError extends Error {
  readonly statusCode = 502;
  constructor(message: string) {
    super(message);
    this.name = 'UpstreamError';
  }
}
