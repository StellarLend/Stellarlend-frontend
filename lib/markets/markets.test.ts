import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../../app/api/markets/route';
import { globalCache } from '../cache';

describe('GET /api/markets', () => {
  beforeEach(() => {
    globalCache.clear();
  });

  afterEach(() => {
    globalCache.clear();
  });

  it('returns all assets on first request as MISS with correct cache headers', async () => {
    const req = new NextRequest('http://localhost/api/markets');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('MISS');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=30, stale-while-revalidate=60');

    const body = await res.json();
    expect(body.markets).toHaveLength(4);
    expect(body.timestamp).toBeDefined();
    expect(body.source).toBe('Soroban RPC stub (server relay)');
  });

  it('returns cached data on subsequent request as HIT', async () => {
    const req1 = new NextRequest('http://localhost/api/markets');
    await GET(req1);

    const req2 = new NextRequest('http://localhost/api/markets');
    const res = await GET(req2);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('HIT');
  });

  it('filters to requested asset and returns correct shape', async () => {
    const req = new NextRequest('http://localhost/api/markets?asset=XLM');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.markets).toHaveLength(1);

    const xlm = body.markets[0];
    expect(xlm.asset).toBe('XLM');
    expect(typeof xlm.supplyApr).toBe('number');
    expect(typeof xlm.borrowApr).toBe('number');
    expect(xlm.utilization).toBeGreaterThanOrEqual(0);
    expect(xlm.utilization).toBeLessThanOrEqual(1);
    expect(typeof xlm.totalSupply).toBe('number');
    expect(typeof xlm.totalBorrow).toBe('number');
  });

  it('filters to multiple assets and caches under order-invariant key', async () => {
    const req1 = new NextRequest('http://localhost/api/markets?asset=XLM,USDC');
    const res1 = await GET(req1);
    expect(res1.headers.get('X-Cache')).toBe('MISS');
    const body1 = await res1.json();
    expect(body1.markets).toHaveLength(2);

    // Reversed order should HIT the same cache key
    const req2 = new NextRequest('http://localhost/api/markets?asset=USDC,XLM');
    const res2 = await GET(req2);
    expect(res2.headers.get('X-Cache')).toBe('HIT');
  });

  it('returns 400 for an unknown asset symbol', async () => {
    const req = new NextRequest('http://localhost/api/markets?asset=FAKE');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/FAKE/);
    expect(body.error).toMatch(/Supported/);
  });

  it('returns 400 for a mix of valid and invalid asset symbols', async () => {
    const req = new NextRequest('http://localhost/api/markets?asset=XLM,FAKE');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/FAKE/);
  });

  it('bypasses cache and returns X-Cache: BYPASS when Authorization header is present', async () => {
    // Prime cache first
    await GET(new NextRequest('http://localhost/api/markets'));

    const req = new NextRequest('http://localhost/api/markets', {
      headers: { Authorization: 'Bearer test-token' },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('BYPASS');
    expect(res.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
  });

  it('bypasses cache when session cookie is present', async () => {
    const req = new NextRequest('http://localhost/api/markets', {
      headers: { Cookie: 'session=active-session-id' },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('BYPASS');
  });

  it('bypasses cache when x-user-id header is present', async () => {
    const req = new NextRequest('http://localhost/api/markets', {
      headers: { 'x-user-id': 'user-123' },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('BYPASS');
  });

  it('returns 500 and logs on unexpected error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const badReq = {
      get url(): never {
        throw new Error('Simulated URL parse failure');
      },
    } as unknown as NextRequest;

    const res = await GET(badReq);
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toBe('Failed to fetch market data');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
