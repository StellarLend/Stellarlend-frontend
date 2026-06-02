import config from '@/lib/config';
import {
  HttpError,
  NetworkError,
  RetryExhaustedError,
  TimeoutError,
  UpstreamHttpError,
} from './errors';
import { metrics } from '@/lib/metrics/registry';

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
  /** Number of retry attempts for idempotent GET requests (default: 3). */
  retries?: number;
  /** Base backoff delay in ms; doubles on each attempt (default: 200). */
  backoffMs?: number;
}

async function fetchOnce<T>(url: string, options: RequestOptions): Promise<T> {
  const start = Date.now();
  const timeoutMs = options.timeoutMs ?? config.api.timeout;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const { timeoutMs: _t, retries: _r, backoffMs: _b, ...fetchOptions } = options;
  
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(fetchOptions.headers);
  const csrfToken = getCsrfToken();
  
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && csrfToken) {
    headers.set('x-csrf-token', csrfToken);
  }

  try {
    let response: Response;
    try {
      response = await fetch(url, { ...fetchOptions, headers, signal: controller.signal });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new TimeoutError(url, timeoutMs);
      }
      throw new NetworkError(url, err);
    }

    if (!response.ok) {
      throw new UpstreamHttpError(url, response.status);
    }

    try {
      const json = (await response.json()) as T;
      try {
        const dur = (Date.now() - start) / 1000;
        const host = new URL(url).host;
        metrics.outboundRequests.inc({ method, host, status: String(response.status) });
        metrics.outboundRequestDuration.observe(dur, { method, host, status: String(response.status) });
      } catch (e) {}
      return json;
    } catch (err) {
      throw new HttpError('PARSE_ERROR', `Failed to parse JSON from ${url}`, undefined, err);
    }
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Typed GET with automatic timeout (via AbortController) and exponential
 * backoff retry.  Only GET requests are retried — mutating methods are
 * passed through once.
 */
export async function httpGet<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const maxRetries = method === 'GET' ? (options.retries ?? 3) : 1;
  const backoffMs = options.backoffMs ?? 200;

  let lastError: HttpError | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchOnce<T>(url, options);
    } catch (err) {
      lastError = err instanceof HttpError ? err : new NetworkError(url, err);

      // Don't retry on 4xx — those are client errors that won't resolve.
      if (lastError instanceof UpstreamHttpError && lastError.status! < 500) {
        throw lastError;
      }
      // Don't retry on timeout — the upstream is backed up; retrying immediately makes it worse.
      if (lastError instanceof TimeoutError) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        await sleep(backoffMs * 2 ** (attempt - 1));
      }
    }
  }

  throw new RetryExhaustedError(url, maxRetries, lastError!);
}

/**
 * Typed POST — single attempt, with timeout.
 */
export async function httpPost<T>(url: string, body: unknown, options: RequestOptions = {}): Promise<T> {
  return fetchOnce<T>(url, {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(body),
  });
}
