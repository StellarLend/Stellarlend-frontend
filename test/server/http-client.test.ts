import { describe, it, expect, vi, afterEach } from 'vitest';
import { httpFetch } from '@/lib/http/client';
import { UpstreamError } from '@/lib/http/errors';

// Use fake timers to control AbortController timeouts
// We instead mock global fetch directly.

afterEach(() => {
  vi.restoreAllMocks();
});

describe('httpFetch', () => {
  it('returns parsed JSON on a successful response', async () => {
    const payload = { status: 'ok' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    }));

    const result = await httpFetch<typeof payload>('https://example.com/api');
    expect(result).toEqual(payload);
  });

  it('throws UpstreamError(HTTP_ERROR) on non-ok response without retries', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));

    await expect(httpFetch('https://example.com/api', { maxRetries: 0 }))
      .rejects.toMatchObject({ code: 'HTTP_ERROR', status: 404 });
  });

  it('retries on 500 for GET and throws RETRY_EXHAUSTED', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fakeFetch);

    await expect(httpFetch('https://example.com/api', { maxRetries: 2 }))
      .rejects.toMatchObject({ code: 'RETRY_EXHAUSTED' });

    // initial attempt + 2 retries = 3 calls
    expect(fakeFetch).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry POST requests', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fakeFetch);

    await expect(httpFetch('https://example.com/api', { method: 'POST', maxRetries: 2 }))
      .rejects.toMatchObject({ code: 'HTTP_ERROR' });

    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('throws UpstreamError(TIMEOUT) when fetch is aborted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(
      Object.assign(new Error('aborted'), { name: 'AbortError' })
    ));

    await expect(httpFetch('https://example.com/api', { maxRetries: 0 }))
      .rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('throws UpstreamError(NETWORK_ERROR) on generic fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(httpFetch('https://example.com/api', { maxRetries: 0 }))
      .rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('throws UpstreamError(PARSE_ERROR) when response JSON is invalid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new SyntaxError('Unexpected token'); },
    }));

    await expect(httpFetch('https://example.com/api', { maxRetries: 0 }))
      .rejects.toMatchObject({ code: 'PARSE_ERROR' });
  });
});
