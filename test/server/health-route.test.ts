import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/http', () => ({
  httpGet: vi.fn().mockResolvedValue({}),
  UpstreamHttpError: class extends Error {},
  TimeoutError: class extends Error {},
}));

import { GET } from '@/app/api/health/route';
import { NextRequest } from 'next/server';

afterEach(() => { vi.restoreAllMocks(); });

describe('GET /api/health', () => {
  it('returns 200 with healthy status', async () => {
    const response = await GET(new NextRequest('http://localhost/api/health'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.checks.api).toBe('healthy');
  });

  it('returns degraded status when stellar is unreachable', async () => {
    const { httpGet, TimeoutError } = await import('@/lib/http');
    (httpGet as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TimeoutError('timeout'));

    const response = await GET(new NextRequest('http://localhost/api/health'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('degraded');
    expect(body.checks.stellar).toBe('degraded');
  });
});
