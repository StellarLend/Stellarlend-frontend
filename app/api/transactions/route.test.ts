import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

vi.mock('@/lib/auth', () => ({
  getUser: vi.fn().mockResolvedValue({ name: 'Test User' }),
}));

function makeRequest(query: Record<string, string> = {}, headers: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/transactions');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url, { headers });
}

describe('GET /api/transactions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with JSON array', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('includes ETag header on 200 response', async () => {
    const res = await GET(makeRequest());
    expect(res.headers.get('ETag')).toMatch(/^"[0-9a-f]{32}"$/);
  });

  it('sets private Cache-Control (user-specific data)', async () => {
    const res = await GET(makeRequest());
    const cc = res.headers.get('Cache-Control');
    expect(cc).toContain('private');
    expect(cc).not.toContain('public');
  });

  it('includes Authorization in Vary header', async () => {
    const res = await GET(makeRequest());
    expect(res.headers.get('Vary')).toContain('Authorization');
  });

  it('returns 304 when If-None-Match matches current ETag', async () => {
    const first = await GET(makeRequest());
    const etag = first.headers.get('ETag')!;

    const second = await GET(makeRequest({}, { 'if-none-match': etag }));
    expect(second.status).toBe(304);
  });

  it('304 body is empty', async () => {
    const first = await GET(makeRequest());
    const etag = first.headers.get('ETag')!;

    const second = await GET(makeRequest({}, { 'if-none-match': etag }));
    expect(await second.text()).toBe('');
  });

  it('returns 200 when If-None-Match does not match (data changed)', async () => {
    const res = await GET(makeRequest({}, { 'if-none-match': '"outdated-etag"' }));
    expect(res.status).toBe(200);
  });

  it('ETags differ when filters produce different result sets', async () => {
    const all = await GET(makeRequest());
    const filtered = await GET(makeRequest({ status: 'Completed' }));
    expect(all.headers.get('ETag')).not.toBe(filtered.headers.get('ETag'));
  });

  it('filters by status query param', async () => {
    const res = await GET(makeRequest({ status: 'Completed' }));
    const body = await res.json();
    expect(body.every((t: { status: string }) => t.status === 'Completed')).toBe(true);
  });

  it('filters by search query param', async () => {
    const res = await GET(makeRequest({ search: 'XLM' }));
    const body = await res.json();
    expect(body.every((t: { asset: string }) => t.asset === 'XLM')).toBe(true);
  });

  it('returns 401 when user is not authenticated', async () => {
    const { getUser } = await import('@/lib/auth');
    vi.mocked(getUser).mockResolvedValueOnce(null as never);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('304 uses private Cache-Control for user data', async () => {
    const first = await GET(makeRequest());
    const etag = first.headers.get('ETag')!;

    const second = await GET(makeRequest({}, { 'if-none-match': etag }));
    expect(second.headers.get('Cache-Control')).toContain('private');
  });
});
