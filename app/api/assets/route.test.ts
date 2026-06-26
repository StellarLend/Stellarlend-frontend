import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/assets/route';
import { globalCache } from '@/lib/cache';
import { getAssetSymbols } from '@/lib/assets';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/assets');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

beforeEach(() => {
  globalCache.clear();
});

// ---------------------------------------------------------------------------
// GET – Basic functionality
// ---------------------------------------------------------------------------

describe('GET /api/assets – Basic functionality', () => {
  it('returns 200 with all assets when no filters provided', async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('assets');
    expect(body).toHaveProperty('timestamp');
    expect(Array.isArray(body.assets)).toBe(true);
    expect(body.assets.length).toBeGreaterThan(0);
  });

  it('returns asset with required fields', async () => {
    const res = await GET(makeGetRequest());
    const body = await res.json();
    const asset = body.assets[0];

    expect(asset).toHaveProperty('symbol');
    expect(asset).toHaveProperty('name');
    expect(asset).toHaveProperty('decimals');
    expect(asset).toHaveProperty('issuer');
    expect(asset).toHaveProperty('logoUrl');
  });

  it('returns valid ISO 8601 timestamp', async () => {
    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(body.timestamp).toBeDefined();
    expect(() => new Date(body.timestamp)).not.toThrow();
    // Check it's a valid ISO string
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

// ---------------------------------------------------------------------------
// GET – Symbol filtering
// ---------------------------------------------------------------------------

describe('GET /api/assets – Symbol filtering', () => {
  const allSymbols = getAssetSymbols();

  it('filters by single symbol', async () => {
    const res = await GET(makeGetRequest({ symbols: 'XLM' }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.assets).toHaveLength(1);
    expect(body.assets[0].symbol).toBe('XLM');
  });

  it('filters by multiple symbols', async () => {
    const res = await GET(makeGetRequest({ symbols: 'XLM,USDC' }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.assets).toHaveLength(2);
    expect(body.assets.map((a: { symbol: string }) => a.symbol)).toContain('XLM');
    expect(body.assets.map((a: { symbol: string }) => a.symbol)).toContain('USDC');
  });

  it('handles case-insensitive symbol input', async () => {
    const res = await GET(makeGetRequest({ symbols: 'xlm,usdc' }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.assets).toHaveLength(2);
  });

  it('handles whitespace around symbols', async () => {
    const res = await GET(makeGetRequest({ symbols: ' XLM , USDC ' }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.assets).toHaveLength(2);
  });

  it.each(allSymbols)('accepts symbol=%s', async (symbol) => {
    const res = await GET(makeGetRequest({ symbols: symbol }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.assets).toHaveLength(1);
    expect(body.assets[0].symbol).toBe(symbol);
  });
});

// ---------------------------------------------------------------------------
// GET – Validation and error handling
// ---------------------------------------------------------------------------

describe('GET /api/assets – Validation and error handling', () => {
  it('rejects empty symbols parameter with 400', async () => {
    const res = await GET(makeGetRequest({ symbols: '' }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('code', 'INVALID_QUERY');
    expect(body).toHaveProperty('timestamp');
  });

  it('rejects unknown symbol with 400', async () => {
    const res = await GET(makeGetRequest({ symbols: 'UNKNOWN' }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/Invalid asset symbols/);
    expect(body.error).toMatch(/UNKNOWN/);
  });

  it('rejects mix of valid and invalid symbols with 400', async () => {
    const res = await GET(makeGetRequest({ symbols: 'XLM,INVALID,USDC' }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/Invalid asset symbols/);
  });

  it('rejects too many symbols (>20) with 400', async () => {
    const symbols = Array(21).fill('XLM').join(',');
    const res = await GET(makeGetRequest({ symbols }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/Too many symbols/);
  });
});

// ---------------------------------------------------------------------------
// GET – Caching behavior
// ---------------------------------------------------------------------------

describe('GET /api/assets – Caching behavior', () => {
  it('returns HIT on second request (cache hit)', async () => {
    const res1 = await GET(makeGetRequest());
    expect(res1.headers.get('X-Cache')).toBe('MISS');

    const res2 = await GET(makeGetRequest());
    expect(res2.headers.get('X-Cache')).toBe('HIT');
  });

  it('returns different cache status for different symbol filters', async () => {
    const res1 = await GET(makeGetRequest({ symbols: 'XLM' }));
    expect(res1.headers.get('X-Cache')).toBe('MISS');

    const res2 = await GET(makeGetRequest({ symbols: 'USDC' }));
    expect(res2.headers.get('X-Cache')).toBe('MISS');
  });

  it('returns same cache status for identical requests', async () => {
    const res1 = await GET(makeGetRequest({ symbols: 'XLM,USDC' }));
    const res2 = await GET(makeGetRequest({ symbols: 'XLM,USDC' }));

    expect(res2.headers.get('X-Cache')).toBe('HIT');
  });

  it('sets proper Cache-Control headers', async () => {
    const res = await GET(makeGetRequest());
    const cacheControl = res.headers.get('Cache-Control');

    expect(cacheControl).toBeDefined();
    expect(cacheControl).toContain('public');
    expect(cacheControl).toContain('max-age');
    expect(cacheControl).toContain('stale-while-revalidate');
  });

  it('sets Vary header for caching', async () => {
    const res = await GET(makeGetRequest());
    const vary = res.headers.get('Vary');

    expect(vary).toBe('Accept-Encoding');
  });
});

// ---------------------------------------------------------------------------
// GET – Response validation
// ---------------------------------------------------------------------------

describe('GET /api/assets – Response validation', () => {
  it('returns assets with valid symbol format', async () => {
    const res = await GET(makeGetRequest());
    const body = await res.json();

    body.assets.forEach((asset: { symbol: string }) => {
      expect(typeof asset.symbol).toBe('string');
      expect(asset.symbol.length).toBeGreaterThan(0);
      expect(asset.symbol).toMatch(/^[A-Z]+$/);
    });
  });

  it('returns assets with valid decimals', async () => {
    const res = await GET(makeGetRequest());
    const body = await res.json();

    body.assets.forEach((asset: { decimals: number }) => {
      expect(typeof asset.decimals).toBe('number');
      expect(asset.decimals).toBeGreaterThanOrEqual(0);
      expect(asset.decimals).toBeLessThanOrEqual(19);
      expect(Number.isInteger(asset.decimals)).toBe(true);
    });
  });

  it('returns assets with valid logoUrl', async () => {
    const res = await GET(makeGetRequest());
    const body = await res.json();

    body.assets.forEach((asset: { logoUrl: string }) => {
      expect(typeof asset.logoUrl).toBe('string');
      expect(asset.logoUrl).toMatch(/^https?:\/\//);
    });
  });

  it('returns assets with non-empty issuer', async () => {
    const res = await GET(makeGetRequest());
    const body = await res.json();

    body.assets.forEach((asset: { issuer: string }) => {
      expect(typeof asset.issuer).toBe('string');
      expect(asset.issuer.length).toBeGreaterThan(0);
    });
  });

  it('returns assets with non-empty name', async () => {
    const res = await GET(makeGetRequest());
    const body = await res.json();

    body.assets.forEach((asset: { name: string }) => {
      expect(typeof asset.name).toBe('string');
      expect(asset.name.length).toBeGreaterThan(0);
    });
  });

  it('returns assets in consistent order', async () => {
    const res1 = await GET(makeGetRequest());
    const body1 = await res1.json();
    const symbols1 = body1.assets.map((a: { symbol: string }) => a.symbol);

    globalCache.clear();

    const res2 = await GET(makeGetRequest());
    const body2 = await res2.json();
    const symbols2 = body2.assets.map((a: { symbol: string }) => a.symbol);

    expect(symbols1).toEqual(symbols2);
  });
});

// ---------------------------------------------------------------------------
// GET – Error responses
// ---------------------------------------------------------------------------

describe('GET /api/assets – Error responses', () => {
  it('returns error response with all required fields', async () => {
    const res = await GET(makeGetRequest({ symbols: 'INVALID' }));
    const body = await res.json();

    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('code');
    expect(body).toHaveProperty('timestamp');
    expect(typeof body.error).toBe('string');
    expect(typeof body.code).toBe('string');
  });

  it('sets no-cache headers on error responses', async () => {
    const res = await GET(makeGetRequest({ symbols: 'INVALID' }));
    const cacheControl = res.headers.get('Cache-Control');

    expect(cacheControl).toContain('no-cache');
    expect(cacheControl).toContain('no-store');
  });
});
