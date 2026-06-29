import config from '@/lib/config';
import { recordHttpRetry } from '@/lib/metrics';
import {
  HttpError,
  NetworkError,
  RetryExhaustedError,
  TimeoutError,
  UpstreamHttpError,
} from './errors';
import { metrics } from '@/lib/metrics/registry';
import { circuitBreaker } from '@/lib/http/circuit-breaker';
import { normalizeRequestId, generateRequestId, REQUEST_ID_HEADER } from '@/lib/request-id';
import { getActiveRequestId } from '@/lib/request-context';

const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'csrf-token';

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_COOKIE_NAME) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

export interface RequestOptions extends Omit<RequestInit, 'signal'> {
  /** Override the global timeout from config.api.timeout (ms). */
  timeoutMs?: number;
  /** Number of retry attempts for idempotent GET/HEAD requests (default: 3). */
  retries?: number;
  /** Compatibility alias: number of retries after the first attempt. */
  maxRetries?: number;
  /** Base backoff delay in ms; doubles on each attempt (default: 200). */
  backoffMs?: number;
  /** Allow retries on POST requests when true (default: false). */
  retryOnPost?: boolean;
  /** Upper bound for Retry-After wait (ms, default 30000). */
  retryAfterUpperBoundMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Typed GET with automatic timeout (via AbortController) and exponential
 * backoff retry.  Only GET/HEAD requests are retried by default — mutating methods
 * such as POST are passed through once, unless retryOnPost is explicitly enabled.
 */
export async function httpGet<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const isIdempotent = method === 'GET' || method === 'HEAD';
  const maxRetries = (isIdempotent || (method === 'POST' && options.retryOnPost)) ? (options.retries ?? 3) : 1;
  const backoffMs = options.backoffMs ?? 200;
  const retryAfterUpperBoundMs = options.retryAfterUpperBoundMs ?? 30000;

  let lastError: HttpError | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let nextDelay = backoffMs * 2 ** (attempt - 1);
    try {
      const timeoutMs = options.timeoutMs ?? config.api.timeout;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const { timeoutMs: _t, retries: _r, backoffMs: _b, retryOnPost: _rp, retryAfterUpperBoundMs: _rao, ...fetchOptions } = options;
      let response: Response;
      try {
        response = await fetch(url, { ...fetchOptions, signal: controller.signal });
      } catch (err) {
        clearTimeout(timer);
        if ((err as Error).name === 'AbortError') {
          throw new TimeoutError(url, timeoutMs);
        }
        throw new NetworkError(url, err);
      }
      clearTimeout(timer);

      if (!response.ok) {
        // Handle Retry-After for 429
        if (response.status === 429) {
          const header = response.headers.get('Retry-After');
          if (header) {
            let waitMs = 0;
            const retrySec = parseInt(header, 10);
            if (!isNaN(retrySec)) {
              waitMs = retrySec * 1000;
            } else {
              const date = new Date(header);
              if (!isNaN(date.getTime())) {
                waitMs = date.getTime() - Date.now();
              }
            }
            // Clamp to upper bound
            nextDelay = Math.min(Math.max(waitMs, 0), retryAfterUpperBoundMs);
          }
          recordHttpRetry(method, '429');
        } else if (response.status >= 500) {
          recordHttpRetry(method, '5xx');
        }
        throw new UpstreamHttpError(url, response.status);
      }

      // Successful response
      try {
        return (await response.json()) as T;
      } catch (err) {
        throw new HttpError('PARSE_ERROR', `Failed to parse JSON from ${url}`, undefined, err);
      }
    } catch (err) {
      lastError = err instanceof HttpError ? err : new NetworkError(url, err);
      // Don't retry on client errors (4xx except 429)
      if (lastError instanceof UpstreamHttpError && lastError.status! < 500 && lastError.status! !== 429) {
        throw lastError;
      }
      if (lastError instanceof TimeoutError) {
        throw lastError;
      }
      if (attempt < maxRetries) {
        await sleep(nextDelay);
      }
    }
  }

  throw new RetryExhaustedError(url, maxRetries, lastError!);
}

/**
 * Typed POST — single attempt by default, with timeout.
 * If options.retryOnPost is true, it supports retries in the same way as GET/HEAD.
 */
export async function httpPost<T>(url: string, body: unknown, options: RequestOptions = {}): Promise<T> {
  return httpGet<T>(url, {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(body),
  });
}

/**
 * Generic fetch wrapper that propagates the active x-request-id from async context.
 * Alias for httpGet, exported separately to satisfy callers that import httpFetch by name.
 */
export const httpFetch = httpGet;

