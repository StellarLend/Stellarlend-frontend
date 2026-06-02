import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET } from '@/app/api/health/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/http', () => ({
  httpFetch: vi.fn().mockResolvedValue({}),
  isUpstreamError: (e: unknown) => e instanceof Error && 'code' in e,
}));

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
    const { httpFetch } = await import('@/lib/http');
    (httpFetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('timeout'));

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('degraded');
    expect(body.checks.stellar).toBe('degraded');
  });
});
