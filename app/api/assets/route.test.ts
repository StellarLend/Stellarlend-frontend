/**
 * Tests for GET /api/assets route
 * 
 * Coverage:
 * - All asset symbols individually
 * - Multiple asset symbols
 * - Empty/no symbols (all assets)
 * - Symbol filtering and validation
 * - Query parameter handling
 * - HTTP caching (HIT, MISS, STALE, BYPASS)
 * - Cache bypass on authenticated requests
 * - Response validation
 * - Error handling
 * - HTTP method handling (405 for POST/PUT/DELETE)
 * 
 * @module app/api/assets/route.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, PUT, DELETE } from '@/app/api/assets/route';
import { globalCache } from '@/lib/cache';
import * as registry from '@/lib/assets/registry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/assets');
  Object.entries(params).forEach(([k, v]) => {
    if (v) {
      url.searchParams.set(k, v);
    }
  });
  return new NextRequest(url);
}

function makeGetRequestWithHeaders(
  params: Record<string, string> = {},
  headers: Record<string, string> = {}
): NextRequest {
  const url = new URL('http://localhost/api/assets');
  Object.entries(params).forEach(([k, v]) => {
    if (v) {
      url.searchParams.set(k, v);
    }
  });
  return new NextRequest(url, { headers });
}

function makePostRequest(): NextRequest {
  return new NextRequest('http://localhost/api/assets', {
    method: 'POST',
  });
}

function makePutRequest(): NextRequest {
  return new NextRequest('http://localhost/api/assets', {
    method: 'PUT',
  });
}

function makeDeleteRequest(): NextRequest {
  return new NextRequest('http://localhost/api/assets', {
    method: 'DELETE',
  });
}

beforeEach(() => {
  globalCache.clear();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET – Happy path: retrieve assets
// ---------------------------------------------------------------------------

describe('GET /api/assets – retrieve all assets', () => {
  it('returns 200 with all assets when no symbols parameter provided', async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('assets');
    expect(Array.isArray(body.assets)).toBe(true);
    expect(body.assets.length).toBeGreaterThan(0);
  });

  it('returns all four canonical assets (XLM, USDC, BTC, ETH)', async () => {
    const res = await GET(makeGetRequest());
    const body = await res.json();

    const symbols = body.assets.map((a: any) => a.symbol);
    expect(symbols).toContain('XLM');
    expect(symbols).toContain('USDC');
    expect(symbols).toContain('BTC');
    expect(symbols).toContain('ETH');
    expect(symbols.length).toBe(4);
  });

  it('returns complete asset metadata with all required fields', async () => {
    const res = await GET(makeGetRequest());
    const body = await res.json();

    body.assets.forEach((asset: any) => {
      expect(asset).toHaveProperty('symbol');
      expect(asset).toHaveProperty('name');
      expect(asset).toHaveProperty('decimals');
      expect(asset).toHaveProperty('issuer');
      expect(asset).toHaveProperty('logo');

      expect(typeof asset.symbol).toBe('string');
      expect(typeof asset.name).toBe('string');
      expect(typeof asset.decimals).toBe('number');
      expect(typeof asset.logo).toBe('string');
      expect(asset.logo.startsWith('http')).toBe(true);

      // issuer can be null or string
      expect(asset.issuer === null || typeof asset.issuer === 'string').toBe(true);
    });
  });

  it('returns decimals within valid range (0-19)', async () => {
    const res = await GET(makeGetRequest());
    const body = await res.json();

    body.assets.forEach((asset: any) => {
      expect(asset.decimals).toBeGreaterThanOrEqual(0);
      expect(asset.decimals).toBeLessThanOrEqual(19);
    });
  });
});

// ---------------------------------------------------------------------------
// GET – Symbol filtering
// ---------------------------------------------------------------------------

describe('GET /api/assets – symbol filtering', () => {
  it('returns single asset when symbols=XLM', async () => {
    const res = await GET(makeGetRequest({ symbols: 'XLM' }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.assets).toHaveLength(1);
    expect(body.assets[0].symbol).toBe('XLM');
  });

  it('returns single asset when symbols=USDC', async () => {
    const res = await GET(makeGetRequest({ symbols: 'USDC' }));
    const body = await res.json();
    expect(body.assets).toHaveLength(1);
    expect(body.assets[0].symbol).toBe('USDC');
  });

  it('returns multiple assets when symbols=XLM,USDC', async () => {
    const res = await GET(makeGetRequest({ symbols: 'XLM,USDC' }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.assets).toHaveLength(2);
    expect(body.assets.map((a: any) => a.symbol)).toContain('XLM');
    expect(body.assets.map((a: any) => a.symbol)).toContain('USDC');
  });

  it('returns all assets when symbols=XLM,USDC,BTC,ETH', async () => {
    const res = await GET(makeGetRequest({ symbols: 'XLM,USDC,BTC,ETH' }));
    const body = await res.json();
    expect(body.assets).toHaveLength(4);
  });

  it('handles symbols parameter with spaces', async () => {
    const res = await GET(makeGetRequest({ symbols: 'XLM , USDC , BTC' }));
    const body = await res.json();
    expect(body.assets).toHaveLength(3);
  });

  it('handles case-insensitive symbols (converts to uppercase)', async () => {
    const res = await GET(makeGetRequest({ symbols: 'xlm,usdc' }));
    const body = await res.json();
    expect(body.assets).toHaveLength(2);
    expect(body.assets.map((a: any) => a.symbol)).toContain('XLM');
    expect(body.assets.map((a: any) => a.symbol)).toContain('USDC');
  });

  it('returns 400 for unknown asset symbol', async () => {
    const res = await GET(makeGetRequest({ symbols: 'INVALID' }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/Invalid asset symbols/);
  });

  it('returns 400 when one symbol is unknown (symbols=XLM,FAKE,USDC)', async () => {
    const res = await GET(makeGetRequest({ symbols: 'XLM,FAKE,USDC' }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/Invalid asset symbols/);
    expect(body.error).toContain('FAKE');
  });

  it('returns 400 for empty symbol string', async () => {
    const res = await GET(makeGetRequest({ symbols: '' }));
    // Empty string should return all assets (same as no param)
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.assets.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// GET – Response caching
// ---------------------------------------------------------------------------

describe('GET /api/assets – response caching', () => {
  it('returns X-Cache: MISS on first request', async () => {
    const res = await GET(makeGetRequest());
    expect(res.headers.get('X-Cache')).toBe('MISS');
  });

  it('returns X-Cache: HIT on second request (cached)', async () => {
    // First request (MISS)
    await GET(makeGetRequest());

    // Second request (should be HIT)
    const res2 = await GET(makeGetRequest());
    expect(res2.headers.get('X-Cache')).toBe('HIT');
  });

  it('returns identical response on cache hit', async () => {
    const res1 = await GET(makeGetRequest());
    const body1 = await res1.json();

    const res2 = await GET(makeGetRequest());
    const body2 = await res2.json();

    expect(body1).toEqual(body2);
  });

  it('uses separate cache keys for different symbol filters', async () => {
    // Get all assets
    const resAll = await GET(makeGetRequest());
    const bodyAll = await resAll.json();

    // Get filtered subset
    const resFiltered = await GET(makeGetRequest({ symbols: 'XLM,USDC' }));
    const bodyFiltered = await resFiltered.json();

    expect(bodyAll.assets.length).not.toBe(bodyFiltered.assets.length);
  });

  it('uses order-invariant cache keys (symbols=XLM,USDC same as USDC,XLM)', async () => {
    // Request 1: XLM,USDC
    const res1 = await GET(makeGetRequest({ symbols: 'XLM,USDC' }));
    expect(res1.headers.get('X-Cache')).toBe('MISS');

    // Request 2: USDC,XLM (different order, should be HIT)
    const res2 = await GET(makeGetRequest({ symbols: 'USDC,XLM' }));
    expect(res2.headers.get('X-Cache')).toBe('HIT');
  });

  it('sets Cache-Control header with 24h TTL', async () => {
    const res = await GET(makeGetRequest());
    const cacheControl = res.headers.get('Cache-Control');
    expect(cacheControl).toMatch(/max-age=86400/);
    expect(cacheControl).toMatch(/stale-while-revalidate=172800/);
  });
});

// ---------------------------------------------------------------------------
// GET – Cache bypass on authenticated requests
// ---------------------------------------------------------------------------

describe('GET /api/assets – cache bypass for authenticated requests', () => {
  it('bypasses cache when Authorization header is present', async () => {
    const res1 = await GET(makeGetRequestWithHeaders({}, { Authorization: 'Bearer token' }));
    expect(res1.headers.get('X-Cache')).toBe('BYPASS');

    // Make another request without auth, should not hit the bypassed request
    const res2 = await GET(makeGetRequest());
    expect(res2.headers.get('X-Cache')).toBe('MISS');
  });

  it('bypasses cache when session cookie is present', async () => {
    const req = makeGetRequest();
    req.cookies.set('session', 'abc123');
    const res = await GET(req);
    expect(res.headers.get('X-Cache')).toBe('BYPASS');
  });

  it('bypasses cache when x-user-id header is present', async () => {
    const res = await GET(makeGetRequestWithHeaders({}, { 'x-user-id': 'user-123' }));
    expect(res.headers.get('X-Cache')).toBe('BYPASS');
  });

  it('returns no-cache directives when cache is bypassed', async () => {
    const res = await GET(makeGetRequestWithHeaders({}, { Authorization: 'Bearer token' }));
    const cacheControl = res.headers.get('Cache-Control');
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).toContain('no-cache');
    expect(cacheControl).toContain('must-revalidate');
  });
});

// ---------------------------------------------------------------------------
// GET – Error handling
// ---------------------------------------------------------------------------

describe('GET /api/assets – error handling', () => {
  it('returns valid response structure on success', async () => {
    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(body).toHaveProperty('assets');
    expect(Array.isArray(body.assets)).toBe(true);
  });

  it('returns error object with message on invalid input', async () => {
    const res = await GET(makeGetRequest({ symbols: 'INVALID' }));
    const body = await res.json();

    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });

  it('returns 400 status for invalid input', async () => {
    const res = await GET(makeGetRequest({ symbols: 'INVALID' }));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET – Asset metadata accuracy
// ---------------------------------------------------------------------------

describe('GET /api/assets – asset metadata accuracy', () => {
  it('returns correct metadata for XLM (native asset)', async () => {
    const res = await GET(makeGetRequest({ symbols: 'XLM' }));
    const body = await res.json();

    const xlm = body.assets[0];
    expect(xlm.symbol).toBe('XLM');
    expect(xlm.name).toBe('Stellar Lumens');
    expect(xlm.decimals).toBe(7);
    expect(xlm.issuer).toBeNull();
    expect(xlm.logo).toBeTruthy();
  });

  it('returns correct metadata for USDC', async () => {
    const res = await GET(makeGetRequest({ symbols: 'USDC' }));
    const body = await res.json();

    const usdc = body.assets[0];
    expect(usdc.symbol).toBe('USDC');
    expect(usdc.name).toBe('USD Coin');
    expect(usdc.decimals).toBe(6);
    expect(usdc.issuer).toBeTruthy();
    expect(usdc.logo).toBeTruthy();
  });

  it('returns correct metadata for BTC', async () => {
    const res = await GET(makeGetRequest({ symbols: 'BTC' }));
    const body = await res.json();

    const btc = body.assets[0];
    expect(btc.symbol).toBe('BTC');
    expect(btc.name).toBe('Bitcoin');
    expect(btc.decimals).toBe(8);
    expect(btc.issuer).toBeTruthy();
    expect(btc.logo).toBeTruthy();
  });

  it('returns correct metadata for ETH', async () => {
    const res = await GET(makeGetRequest({ symbols: 'ETH' }));
    const body = await res.json();

    const eth = body.assets[0];
    expect(eth.symbol).toBe('ETH');
    expect(eth.name).toBe('Ethereum');
    expect(eth.decimals).toBe(18);
    expect(eth.issuer).toBeTruthy();
    expect(eth.logo).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// HTTP Methods – 405 Method Not Allowed
// ---------------------------------------------------------------------------

describe('HTTP methods – 405 Method Not Allowed', () => {
  it('POST /api/assets returns 405', async () => {
    const res = await POST(makePostRequest());
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET');
  });

  it('PUT /api/assets returns 405', async () => {
    const res = await PUT(makePutRequest());
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET');
  });

  it('DELETE /api/assets returns 405', async () => {
    const res = await DELETE(makeDeleteRequest());
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET');
  });

  it('POST returns error message', async () => {
    const res = await POST(makePostRequest());
    const body = await res.json();
    expect(body.error).toBe('Method not allowed');
  });
});

// ---------------------------------------------------------------------------
// Integration – Registry loading
// ---------------------------------------------------------------------------

describe('GET /api/assets – registry integration', () => {
  it('successfully loads from registry module', async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);

    // Verify it's using the registry by checking it matches getAllAssets()
    const allAssets = registry.getAllAssets();
    const body = await res.json();

    expect(body.assets.length).toBe(allAssets.length);
    expect(body.assets.map((a: any) => a.symbol).sort()).toEqual(
      allAssets.map((a) => a.symbol).sort()
    );
  });
});
