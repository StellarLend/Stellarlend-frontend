import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeoutError } from '@/lib/http/errors';

vi.mock('server-only', () => ({}));

const mockHttpGet = vi.fn().mockResolvedValue({});

vi.mock('@/lib/http', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/http')>();
  return {
    ...actual,
    httpGet: mockHttpGet,
  };
});

beforeEach(() => {
  mockHttpGet.mockReset();
  mockHttpGet.mockResolvedValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/health', () => {
  it('returns 200 with healthy status', async () => {
    const response = await GET(new Request('http://localhost/api/health') as any);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.checks.api).toBe('healthy');
  });

  it('returns degraded status when stellar is unreachable', async () => {
    const { httpGet } = await import('@/lib/http');
    (httpGet as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TimeoutError('url', 5000));

    const response = await GET(new Request('http://localhost/api/health') as any);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('degraded');
    expect(body.checks.stellar).toBe('degraded');
  });

  it('returns ETag and Cache-Control headers', async () => {
    const { GET } = await import('@/app/api/health/route');
    const response = await GET();
    expect(response.headers.get('ETag')).toBeTruthy();
    expect(response.headers.get('Cache-Control')).toContain('public');
    expect(response.headers.get('Vary')).toBeTruthy();
  });

  it('returns 304 when If-None-Match matches', async () => {
    const { GET } = await import('@/app/api/health/route');
    const firstResponse = await GET();
    const etag = firstResponse.headers.get('ETag');

    const request = new Request('http://localhost/api/health', {
      headers: { 'If-None-Match': etag! },
    });
    const secondResponse = await GET(request as any);
    expect(secondResponse.status).toBe(304);
  });
});
