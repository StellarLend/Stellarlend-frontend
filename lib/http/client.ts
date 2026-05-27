import config from '@/lib/config';
import { UpstreamError } from './errors';

export interface FetchOptions extends Omit<RequestInit, 'signal'> {
  /** Max retries for idempotent GET requests (default: 3). Set to 0 to disable. */
  maxRetries?: number;
  /** Override the timeout in ms (defaults to config.api.timeout). */
  timeoutMs?: number;
}

const DEFAULT_MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 200;

function isRetryable(method: string, status: number): boolean {
  const idempotent = !method || method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD';
  return idempotent && (status === 429 || status >= 500);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Shared typed fetch client that applies timeouts and retries with exponential
 * backoff for idempotent requests. Honors config.api.timeout by default.
 */
export async function httpFetch<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    timeoutMs = config.api.timeout,
    method = 'GET',
    ...fetchInit
  } = options;

  let attempt = 0;

  while (true) {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, { method, ...fetchInit, signal: controller.signal });
    } catch (err: unknown) {
      clearTimeout(timerId);
      if (err instanceof Error && err.name === 'AbortError') {
        if (attempt < maxRetries && isRetryable(method, 0)) {
          await sleep(BASE_BACKOFF_MS * 2 ** attempt);
          attempt++;
          continue;
        }
        throw new UpstreamError('TIMEOUT', `Request to ${url} timed out after ${timeoutMs}ms`, undefined, err);
      }
      throw new UpstreamError('NETWORK_ERROR', `Network error fetching ${url}: ${String(err)}`, undefined, err);
    } finally {
      clearTimeout(timerId);
    }

    if (!response.ok) {
      if (attempt < maxRetries && isRetryable(method, response.status)) {
        await sleep(BASE_BACKOFF_MS * 2 ** attempt);
        attempt++;
        continue;
      }
      throw new UpstreamError(
        attempt > 0 ? 'RETRY_EXHAUSTED' : 'HTTP_ERROR',
        `Upstream responded ${response.status} for ${url}`,
        response.status
      );
    }

    try {
      return (await response.json()) as T;
    } catch (err) {
      throw new UpstreamError('PARSE_ERROR', `Failed to parse response from ${url}`, response.status, err);
    }
  }
}
