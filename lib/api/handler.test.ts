import { describe, it, expect, vi, afterEach } from 'vitest';
import { UpstreamHttpError, TimeoutError } from '@/lib/http';
import { ValidationError, AuthError, UpstreamError } from './errors';
import { withHandler } from './handler';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Parse JSON from a NextResponse. */
async function json(res: Response): Promise<unknown> {
  return res.json();
}

// ─── withHandler — error mapping ─────────────────────────────────────────────

describe('withHandler', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // 1. ValidationError
  it('returns 400 with code VALIDATION_ERROR for ValidationError', async () => {
    const res = await withHandler(() => {
      throw new ValidationError('bad input');
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body).toEqual({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'bad input' },
    });
  });

  // 2. AuthError
  it('returns 401 with code AUTH_ERROR for AuthError', async () => {
    const res = await withHandler(() => {
      throw new AuthError('not authorised');
    });

    expect(res.status).toBe(401);
    const body = await json(res);
    expect(body).toEqual({
      success: false,
      error: { code: 'AUTH_ERROR', message: 'not authorised' },
    });
  });

  // 3. UpstreamError
  it('returns 502 with code UPSTREAM_ERROR for UpstreamError', async () => {
    const res = await withHandler(() => {
      throw new UpstreamError('upstream down');
    });

    expect(res.status).toBe(502);
    const body = await json(res);
    expect(body).toEqual({
      success: false,
      error: { code: 'UPSTREAM_ERROR', message: 'upstream down' },
    });
  });

  // 4. UpstreamHttpError from lib/http
  it('returns 502 with code UPSTREAM_ERROR for UpstreamHttpError', async () => {
    const res = await withHandler(() => {
      throw new UpstreamHttpError('https://horizon.example.com/', 503);
    });

    expect(res.status).toBe(502);
    const body = (await json(res)) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UPSTREAM_ERROR');
  });

  // 5. TimeoutError from lib/http
  it('returns 502 with code UPSTREAM_ERROR for TimeoutError', async () => {
    const res = await withHandler(() => {
      throw new TimeoutError('https://horizon.example.com/', 5000);
    });

    expect(res.status).toBe(502);
    const body = (await json(res)) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UPSTREAM_ERROR');
  });

  // 6. Unknown error in production — safe message, no stack trace
  it('returns 500 with safe message for unknown errors in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const res = await withHandler(() => {
      throw new Error('secret internal detail');
    });

    expect(res.status).toBe(500);
    const body = (await json(res)) as { success: boolean; error: { code: string; message: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred');
    expect(body.error.message).not.toContain('secret');
  });

  // 7. Unknown error in development — exposes error.message
  it('returns 500 with error.message for unknown errors in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const res = await withHandler(() => {
      throw new Error('dev debug details');
    });

    expect(res.status).toBe(500);
    const body = (await json(res)) as { success: boolean; error: { code: string; message: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('dev debug details');
  });

  // 8. Successful handler
  it('returns 200 with { success: true, data } on success', async () => {
    const payload = { id: 42, name: 'test' };

    const res = await withHandler(async () => payload);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toEqual({ success: true, data: payload });
  });
});

// ─── health route shape ───────────────────────────────────────────────────────

describe('GET /api/health', () => {
  // 9. Returns 200 with correct shape when stellar network is healthy
  it('returns 200 with correct health shape when network is healthy', async () => {
    // Dynamically import so mocks are applied per-test via vi.mock below.
    // We mock lib/http httpGet to resolve immediately (healthy).
    vi.mock('@/lib/http', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/lib/http')>();
      return {
        ...actual,
        httpGet: vi.fn().mockResolvedValue(undefined),
      };
    });

    // Import AFTER mocking
    const { GET } = await import('@/app/api/health/route');
    const res = await GET();

    expect(res.status).toBe(200);

    const body = (await json(res)) as {
      success: boolean;
      data: {
        status: string;
        timestamp: string;
        checks: { database: string; api: string; stellar: string };
      };
    };

    expect(body.success).toBe(true);
    expect(body.data.status).toBe('healthy');
    expect(typeof body.data.timestamp).toBe('string');
    expect(body.data.checks.database).toBe('healthy');
    expect(body.data.checks.api).toBe('healthy');
    expect(body.data.checks.stellar).toBe('healthy');

    vi.restoreAllMocks();
  });
});
