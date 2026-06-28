import { describe, expect, it, vi, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '@/middleware';
import { withRequestLogging } from '@/lib/api/handler';
import { httpGet } from '@/lib/http/client';
import { normalizeRequestId, REQUEST_ID_HEADER } from '@/lib/request-id';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60_000 })),
}));

vi.mock('@/lib/chaos/inject', () => ({
  chaosInject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/telemetry/sentry', () => ({
  captureServerError: vi.fn(),
}));

const VALID_REQUEST_ID = '01HZ0000000000000000000000';

function apiRequest(headers?: HeadersInit) {
  return new NextRequest('http://localhost/api/test?foo=bar', {
    method: 'GET',
    headers,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('x-request-id propagation', () => {
  it('honors an incoming valid x-request-id in middleware, logs, responses, and upstream calls', async () => {
    const middlewareResponse = middleware(apiRequest({ [REQUEST_ID_HEADER]: VALID_REQUEST_ID }));
    expect(middlewareResponse.headers.get(REQUEST_ID_HEADER)).toBe(VALID_REQUEST_ID);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const handler = withRequestLogging('/api/test', async () => {
      await httpGet('https://upstream.example/api', { retries: 1 });
      return NextResponse.json({ ok: true });
    });

    const response = await handler(apiRequest({ [REQUEST_ID_HEADER]: VALID_REQUEST_ID }));

    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(VALID_REQUEST_ID);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const upstreamHeaders = fetchSpy.mock.calls[0][1]?.headers as Headers;
    expect(upstreamHeaders.get(REQUEST_ID_HEADER)).toBe(VALID_REQUEST_ID);

    const logEntry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(logEntry.context.requestId).toBe(VALID_REQUEST_ID);
    expect(logEntry.context.request.requestId).toBe(VALID_REQUEST_ID);
    expect(logEntry.context.request.headers[REQUEST_ID_HEADER]).toBe(VALID_REQUEST_ID);
  });

  it('generates a ULID when x-request-id is missing', async () => {
    const middlewareResponse = middleware(apiRequest());
    const generatedRequestId = middlewareResponse.headers.get(REQUEST_ID_HEADER);

    expect(generatedRequestId).toBeTruthy();
    expect(normalizeRequestId(generatedRequestId)).toBe(generatedRequestId);

    const handler = withRequestLogging('/api/test', async () => NextResponse.json({ ok: true }));
    const response = await handler(apiRequest());
    const handlerRequestId = response.headers.get(REQUEST_ID_HEADER);

    expect(handlerRequestId).toBeTruthy();
    expect(normalizeRequestId(handlerRequestId)).toBe(handlerRequestId);
  });

  it('replaces malformed x-request-id values instead of forwarding them', async () => {
    const malformed = 'bad request-id';
    const middlewareResponse = middleware(apiRequest({ [REQUEST_ID_HEADER]: malformed }));
    const sanitizedMiddlewareId = middlewareResponse.headers.get(REQUEST_ID_HEADER);

    expect(sanitizedMiddlewareId).not.toBe(malformed);
    expect(normalizeRequestId(sanitizedMiddlewareId)).toBe(sanitizedMiddlewareId);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const handler = withRequestLogging('/api/test', async () => {
      await httpGet('https://upstream.example/api', { retries: 1 });
      return NextResponse.json({ ok: true });
    });

    const response = await handler(apiRequest({ [REQUEST_ID_HEADER]: 'not-a-ulid' }));
    const sanitizedHandlerId = response.headers.get(REQUEST_ID_HEADER);
    const upstreamHeaders = fetchSpy.mock.calls[0][1]?.headers as Headers;

    expect(sanitizedHandlerId).not.toBe('not-a-ulid');
    expect(normalizeRequestId(sanitizedHandlerId)).toBe(sanitizedHandlerId);
    expect(upstreamHeaders.get(REQUEST_ID_HEADER)).toBe(sanitizedHandlerId);
  });
});
