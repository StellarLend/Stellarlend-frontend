import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET } from '@/app/api/health/route';
import { TimeoutError } from '@/lib/http/errors';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/http', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/http')>();
  return {
    ...actual,
    httpGet: vi.fn().mockResolvedValue({}),
  };
});

afterEach(() => { vi.restoreAllMocks(); });

describe('GET /api/health', () => {
  it('returns 200 with healthy status', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.checks.api).toBe('healthy');
  });

  it('returns degraded status when stellar is unreachable', async () => {
    const { httpGet } = await import('@/lib/http');
    (httpGet as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TimeoutError('url', 5000));

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('degraded');
    expect(body.checks.stellar).toBe('degraded');
  });
});
