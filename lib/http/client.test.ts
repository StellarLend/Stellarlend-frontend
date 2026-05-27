import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { httpGet, httpPost } from './client';
import {
  TimeoutError,
  NetworkError,
  UpstreamHttpError,
  RetryExhaustedError,
} from './errors';

vi.mock('@/lib/config', () => ({
  default: {
    api: { baseUrl: 'http://localhost:3001', timeout: 10000 },
    app: { name: 'Stellarlend', version: '1.0.0', environment: 'development' },
    stellar: {
      network: 'testnet',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    },
    analytics: {},
  },
}));

const TEST_URL = 'https://example.com/api';

function mockFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(handler as typeof fetch);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('httpGet', () => {
  it('returns parsed JSON on success', async () => {
    mockFetch(async () => jsonResponse({ ok: true }));

    const promise = httpGet<{ ok: boolean }>(TEST_URL);
    // Attach rejection handler before advancing timers to prevent unhandled-rejection warnings
    const assertion = expect(promise).resolves.toEqual({ ok: true });
    await vi.runAllTimersAsync();
    await assertion;
  });

  it('throws TimeoutError when request exceeds timeoutMs', async () => {
    mockFetch(
      (_url, init) =>
        new Promise<Response>((_, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          if (signal) {
            signal.addEventListener('abort', () =>
              reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
            );
          }
        }),
    );

    const promise = httpGet(TEST_URL, { timeoutMs: 100, retries: 1 });
    const assertion = expect(promise).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(200);
    await assertion;
  });

  it('throws RetryExhaustedError (caused by NetworkError) on fetch failure', async () => {
    mockFetch(async () => { throw new Error('Network down'); });

    const promise = httpGet(TEST_URL, { retries: 1, backoffMs: 10 });
    const assertion = expect(promise).rejects.toBeInstanceOf(RetryExhaustedError);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it('NetworkError is the cause inside RetryExhaustedError', async () => {
    mockFetch(async () => { throw new Error('Network down'); });

    const promise = httpGet(TEST_URL, { retries: 1, backoffMs: 10 });
    const assertion = promise.catch((err) => {
      expect(err).toBeInstanceOf(RetryExhaustedError);
      expect(err.cause).toBeInstanceOf(NetworkError);
    });
    await vi.runAllTimersAsync();
    await assertion;
  });

  it('throws UpstreamHttpError immediately on 4xx without retry', async () => {
    const spy = mockFetch(async () => jsonResponse({ error: 'forbidden' }, 403));

    const promise = httpGet(TEST_URL, { retries: 3 });
    const assertion = expect(promise).rejects.toBeInstanceOf(UpstreamHttpError);
    await vi.runAllTimersAsync();
    await assertion;
    // Called exactly once — no retries on client errors
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('retries on 5xx and throws RetryExhaustedError after all attempts', async () => {
    const spy = mockFetch(async () => jsonResponse({ error: 'server error' }, 500));

    const promise = httpGet(TEST_URL, { retries: 3, backoffMs: 10 });
    const assertion = expect(promise).rejects.toBeInstanceOf(RetryExhaustedError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('succeeds on retry after transient 5xx', async () => {
    let callCount = 0;
    mockFetch(async () => {
      callCount++;
      return callCount < 3
        ? jsonResponse({ error: 'server error' }, 500)
        : jsonResponse({ recovered: true });
    });

    const promise = httpGet<{ recovered: boolean }>(TEST_URL, { retries: 3, backoffMs: 10 });
    const assertion = expect(promise).resolves.toEqual({ recovered: true });
    await vi.runAllTimersAsync();
    await assertion;
    expect(callCount).toBe(3);
  });

  it('uses exponential backoff between retries', async () => {
    const callTimes: number[] = [];

    mockFetch(async () => {
      callTimes.push(Date.now());
      return jsonResponse({}, 503);
    });

    const promise = httpGet(TEST_URL, { retries: 3, backoffMs: 100 });
    const assertion = expect(promise).rejects.toBeInstanceOf(RetryExhaustedError);
    await vi.runAllTimersAsync();
    await assertion;

    // Second attempt waits ~100ms, third waits ~200ms (exponential: 100 * 2^0, 100 * 2^1)
    expect(callTimes[1] - callTimes[0]).toBeGreaterThanOrEqual(100);
    expect(callTimes[2] - callTimes[1]).toBeGreaterThanOrEqual(200);
  });
});

describe('httpPost', () => {
  it('sends JSON body with correct headers and returns response', async () => {
    const spy = mockFetch(async () => jsonResponse({ created: true }));

    const promise = httpPost<{ created: boolean }>(TEST_URL, { name: 'test' });
    const assertion = expect(promise).resolves.toEqual({ created: true });
    await vi.runAllTimersAsync();
    await assertion;

    const [, init] = spy.mock.calls[0];
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).body).toBe(JSON.stringify({ name: 'test' }));
  });

  it('does not retry on 5xx (not idempotent)', async () => {
    const spy = mockFetch(async () => jsonResponse({}, 500));

    const promise = httpPost(TEST_URL, {});
    const assertion = expect(promise).rejects.toBeInstanceOf(UpstreamHttpError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('TimeoutError', () => {
  it('has code TIMEOUT and correct message', () => {
    const err = new TimeoutError('https://example.com', 5000);
    expect(err.code).toBe('TIMEOUT');
    expect(err.message).toContain('5000ms');
  });
});

describe('UpstreamHttpError', () => {
  it('exposes the HTTP status code', () => {
    const err = new UpstreamHttpError('https://example.com', 503);
    expect(err.status).toBe(503);
    expect(err.code).toBe('HTTP_ERROR');
  });
});

describe('RetryExhaustedError', () => {
  it('includes attempts count in message', () => {
    const cause = new UpstreamHttpError('https://example.com', 503);
    const err = new RetryExhaustedError('https://example.com', 3, cause);
    expect(err.message).toContain('3');
    expect(err.code).toBe('RETRY_EXHAUSTED');
  });
});
