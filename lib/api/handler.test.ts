import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { withRequestLogging } from '@/lib/api/handler';

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
});
