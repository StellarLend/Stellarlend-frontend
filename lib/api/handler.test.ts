import { promisify } from 'node:util';
import { brotliDecompress, gunzip } from 'node:zlib';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  RESPONSE_COMPRESSION_MIN_BYTES,
  RESPONSE_COMPRESSION_OPT_OUT_HEADER,
  applyResponseCompression,
  withRequestLogging,
} from '@/lib/api/handler';

const gunzipAsync = promisify(gunzip);
const brotliDecompressAsync = promisify(brotliDecompress);

async function responseBuffer(response: Response) {
  return Buffer.from(await response.arrayBuffer());
}

describe('withRequestLogging', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs completed requests with route and status', async () => {
    const handler = withRequestLogging('/api/test', async (req: NextRequest) => {
      expect(req.method).toBe('GET');
      return NextResponse.json({ ok: true }, { status: 201 });
    });

    const request = new NextRequest('http://localhost/api/test?foo=bar', {
      method: 'GET',
      headers: { authorization: 'Bearer test-token' },
    });

    const response = await handler(request);

    expect(response.status).toBe(201);
    expect(logSpy).toHaveBeenCalledTimes(1);

    const logEntry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(logEntry.level).toBe('info');
    expect(logEntry.route).toBe('/api/test');
    expect(logEntry.status ?? logEntry.context?.status).toBe(201);
    expect(logEntry.context?.request?.method).toBe('GET');
    expect(logEntry.context?.request?.headers?.authorization).toBe('[REDACTED]');
  });

  it('logs errors and returns a 500 response when the handler throws', async () => {
    const handler = withRequestLogging('/api/test-error', async () => {
      throw new Error('boom');
    });

    const request = new NextRequest('http://localhost/api/test-error', { method: 'POST' });
    const response = await handler(request);

    expect(response.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const logEntry = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(logEntry.level).toBe('error');
    expect(logEntry.route).toBe('/api/test-error');
    expect(logEntry.context?.request?.method).toBe('POST');
    expect(logEntry.context?.error?.message).toBe('boom');
  });

  it('brotli-compresses large JSON responses when the client supports br', async () => {
    const payload = { transactions: Array.from({ length: 200 }, (_, index) => ({ id: `txn-${index}`, memo: 'mobile-json'.repeat(8) })) };
    const handler = withRequestLogging('/api/transactions', async () => NextResponse.json(payload));
    const request = new NextRequest('http://localhost/api/transactions', {
      method: 'GET',
      headers: { 'Accept-Encoding': 'gzip, br' },
    });

    const response = await handler(request);

    expect(response.headers.get('Content-Encoding')).toBe('br');
    expect(response.headers.get('Vary')).toContain('Accept-Encoding');
    expect(response.headers.has('Content-Length')).toBe(false);

    const decompressed = await brotliDecompressAsync(await responseBuffer(response));
    expect(JSON.parse(decompressed.toString('utf8'))).toEqual(payload);
  });
});

describe('applyResponseCompression', () => {
  it('leaves responses below the threshold uncompressed while preserving Vary', async () => {
    const request = new NextRequest('http://localhost/api/transactions', {
      method: 'GET',
      headers: { 'Accept-Encoding': 'gzip' },
    });
    const response = NextResponse.json({ ok: true });

    const compressed = await applyResponseCompression(request, response);

    expect(compressed.headers.get('Content-Encoding')).toBeNull();
    expect(compressed.headers.get('Vary')).toContain('Accept-Encoding');
    expect(await compressed.json()).toEqual({ ok: true });
  });

  it('honors the request opt-out header for performance-sensitive callers', async () => {
    const request = new NextRequest('http://localhost/api/transactions', {
      method: 'GET',
      headers: {
        'Accept-Encoding': 'br, gzip',
        [RESPONSE_COMPRESSION_OPT_OUT_HEADER]: 'off',
      },
    });
    const response = NextResponse.json({ data: 'x'.repeat(RESPONSE_COMPRESSION_MIN_BYTES + 1) });

    const compressed = await applyResponseCompression(request, response);

    expect(compressed.headers.get('Content-Encoding')).toBeNull();
    expect(await compressed.json()).toEqual({ data: 'x'.repeat(RESPONSE_COMPRESSION_MIN_BYTES + 1) });
  });

  it('gzip-compresses content-length delimited streams without buffering the whole response first', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Buffer.from('streamed-'));
        controller.enqueue(Buffer.from('transaction-data'.repeat(200)));
        controller.close();
      },
    });
    const request = new NextRequest('http://localhost/api/transactions', {
      method: 'GET',
      headers: { 'Accept-Encoding': 'gzip' },
    });
    const response = new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(RESPONSE_COMPRESSION_MIN_BYTES + 100),
      },
    });

    const compressed = await applyResponseCompression(request, response);

    expect(compressed.headers.get('Content-Encoding')).toBe('gzip');
    expect(compressed.headers.get('Vary')).toContain('Accept-Encoding');
    expect(compressed.headers.has('Content-Length')).toBe(false);

    const decompressed = await gunzipAsync(await responseBuffer(compressed));
    expect(decompressed.toString('utf8')).toBe(`streamed-${'transaction-data'.repeat(200)}`);
  });

  it('does not compress CSV export responses', async () => {
    const request = new NextRequest('http://localhost/api/transactions/export', {
      method: 'GET',
      headers: { 'Accept-Encoding': 'br, gzip' },
    });
    const response = new NextResponse(`id,amount\ntxn-1,10\n${'txn-2,20\n'.repeat(200)}`, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    });

    const compressed = await applyResponseCompression(request, response);

    expect(compressed.headers.get('Content-Encoding')).toBeNull();
    expect(compressed.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(await compressed.text()).toContain('txn-1,10');
  });
});
