export type HttpErrorCode =
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'HTTP_ERROR'
  | 'PARSE_ERROR'
  | 'RETRY_EXHAUSTED';

export class HttpError extends Error {
  constructor(
    public readonly code: HttpErrorCode,
    message: string,
    public readonly status?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class TimeoutError extends HttpError {
  constructor(url: string, timeoutMs: number) {
    super('TIMEOUT', `Request to ${url} timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

export class NetworkError extends HttpError {
  constructor(url: string, cause: unknown) {
    super('NETWORK_ERROR', `Network error fetching ${url}`, undefined, cause);
    this.name = 'NetworkError';
  }
}

export class UpstreamHttpError extends HttpError {
  constructor(url: string, status: number) {
    super('HTTP_ERROR', `Upstream ${url} returned ${status}`, status);
    this.name = 'UpstreamHttpError';
  }
}

export class RetryExhaustedError extends HttpError {
  constructor(url: string, attempts: number, lastError: HttpError) {
    super(
      'RETRY_EXHAUSTED',
      `All ${attempts} attempts failed for ${url}: ${lastError.message}`,
      lastError.status,
      lastError,
    );
    this.name = 'RetryExhaustedError';
  }
}

export { HttpError as UpstreamError };
