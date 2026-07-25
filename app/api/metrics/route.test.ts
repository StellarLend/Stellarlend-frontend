import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { metrics } from '@/lib/metrics/registry';
import { recordDeletion } from '@/lib/metrics';

vi.mock('@/lib/server-config', () => ({
  default: { server: { token: 'secret-token' } },
}));

function authedRequest() {
  return new Request('http://localhost/api/metrics', {
    headers: { Authorization: 'Bearer secret-token' },
  });
}

describe('GET /api/metrics', () => {
  it('returns 401 without bearer token', async () => {
    const req = new Request('http://localhost/api/metrics');
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('returns metrics when authorized', async () => {
    const res = await GET(authedRequest() as any);
    expect(res.status).toBe(200);
    const ct = res.headers.get('Content-Type') || res.headers.get('content-type');
    expect(ct).toMatch(/text\/plain/);
    const body = await res.text();
    expect(body).toMatch(/# HELP http_requests_total/);
    expect(body).toMatch(/# HELP scheduler_is_leader/);
    expect(body).toMatch(/scheduler_is_leader 0/);
  });

  it('reflects recordDeletion calls in /api/metrics output', async () => {
    // Reset the counter by re-creating it through a fresh inc baseline read,
    // then record a known deletion and assert it appears in the scrape output.
    const before = metrics.deletionsTotal.collect();
    const prevMatch = before.match(/retention_deletions_total\{table="audit_events"\}\s+(\d+)/);
    const prevCount = prevMatch ? Number(prevMatch[1]) : 0;

    recordDeletion('audit_events', 7);

    const res = await GET(authedRequest() as any);
    expect(res.status).toBe(200);
    const body = await res.text();

    expect(body).toMatch(/# HELP retention_deletions_total/);
    expect(body).toMatch(/# TYPE retention_deletions_total counter/);

    const match = body.match(/retention_deletions_total\{table="audit_events"\}\s+(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(prevCount + 7);
  });
});
