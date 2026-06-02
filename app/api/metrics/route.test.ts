import { describe, it, expect, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/server-config', () => ({
  default: { server: { token: 'secret-token' } },
}));

describe('GET /api/metrics', () => {
  it('returns 401 without bearer token', async () => {
    const req = new Request('http://localhost/api/metrics');
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('returns metrics when authorized', async () => {
    const req = new Request('http://localhost/api/metrics', { headers: { Authorization: 'Bearer secret-token' } });
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const ct = res.headers.get('Content-Type') || res.headers.get('content-type');
    expect(ct).toMatch(/text\/plain/);
    const body = await res.text();
    expect(body).toMatch(/# HELP http_requests_total/);
  });
});
