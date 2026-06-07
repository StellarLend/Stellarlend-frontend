import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/health/route';

if (!process.env.NEXT_PUBLIC_APP_ENV) {
  process.env.NEXT_PUBLIC_APP_ENV = 'test';
}

vi.mock('@/lib/health/checks', () => ({
  checkHorizon: vi.fn().mockResolvedValue('healthy'),
  checkSorobanRpc: vi.fn().mockResolvedValue('healthy'),
  checkApi: vi.fn().mockResolvedValue('healthy'),
  checkDatabase: vi.fn().mockResolvedValue('healthy'),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/health', () => {
  it('returns 200 with healthy status', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.checks.api).toBe('healthy');
  });

  it('returns degraded status when stellar is unreachable', async () => {
    const checks = await import('@/lib/health/checks');
    const mockedCheckHorizon = vi.mocked(checks.checkHorizon);
    mockedCheckHorizon.mockResolvedValueOnce('degraded');

    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.status).toBe('degraded');
    expect(body.checks.stellar).toBe('degraded');
  });
});
