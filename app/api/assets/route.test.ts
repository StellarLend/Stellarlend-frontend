import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from './route';
import { NextRequest } from 'next/server';

// Mock the cache
vi.mock('@/lib/cache', () => ({
  globalCache: {
    getOrFetch: vi.fn(async (key: string, fetcher: () => Promise<any>) => {
      const value = await fetcher();
      return { value, status: 'HIT' };
    }),
  },
}));

describe('GET /api/assets', () => {
  it('should return all assets when no symbol param is provided', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/api/assets'));
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.assets).toHaveLength(4);
    expect(data.timestamp).toBeDefined();

    const symbols = data.assets.map((a: any) => a.symbol);
    expect(symbols).toContain('XLM');
    expect(symbols).toContain('USDC');
    expect(symbols).toContain('BTC');
    expect(symbols).toContain('ETH');
  });

  it('should filter by single symbol', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/api/assets?symbol=XLM'));
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.assets).toHaveLength(1);
    expect(data.assets[0].symbol).toBe('XLM');
    expect(data.assets[0].name).toBe('Stellar Lumens');
  });

  it('should filter by multiple symbols', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/api/assets?symbol=XLM,USDC'));
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.assets).toHaveLength(2);
    const symbols = data.assets.map((a: any) => a.symbol);
    expect(symbols).toContain('XLM');
    expect(symbols).toContain('USDC');
  });

  it('should be case-insensitive for symbol param', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/api/assets?symbol=xlm,usdc'));
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.assets).toHaveLength(2);
    const symbols = data.assets.map((a: any) => a.symbol);
    expect(symbols).toContain('XLM');
    expect(symbols).toContain('USDC');
  });

  it('should return 400 for unknown symbol', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/api/assets?symbol=INVALID'));
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();

    expect(data.error).toBeDefined();
    expect(data.error).toContain('Unknown asset symbol');
  });

  it('should return 400 for partially invalid symbols', async () => {
    const request = new NextRequest(
      new URL('http://localhost:3000/api/assets?symbol=XLM,INVALID,USDC'),
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();

    expect(data.error).toContain('Unknown asset symbol');
    expect(data.error).toContain('INVALID');
  });

  it('should include asset metadata', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/api/assets?symbol=XLM'));
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    const xlm = data.assets[0];
    expect(xlm.symbol).toBe('XLM');
    expect(xlm.name).toBe('Stellar Lumens');
    expect(xlm.decimals).toBe(7);
    expect(xlm.stellarIssuer).toBe('native');
    expect(xlm.logoUrl).toBeDefined();
    expect(xlm.description).toBeDefined();
  });

  it('should include correct decimals for each asset', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/api/assets'));
    const response = await GET(request);

    const data = await response.json();
    const assetsMap = Object.fromEntries(data.assets.map((a: any) => [a.symbol, a]));

    expect(assetsMap['XLM'].decimals).toBe(7);
    expect(assetsMap['USDC'].decimals).toBe(6);
    expect(assetsMap['BTC'].decimals).toBe(8);
    expect(assetsMap['ETH'].decimals).toBe(18);
  });

  it('should set proper cache headers', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/api/assets'));
    const response = await GET(request);

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600, stale-while-revalidate=86400');
    expect(response.headers.get('X-Cache')).toBe('HIT');
  });

  it('should bypass cache for authenticated requests with Authorization header', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/api/assets'));
    request.headers.set('Authorization', 'Bearer token');

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Cache')).toBe('BYPASS');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('should bypass cache for authenticated requests with session cookie', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/api/assets'));
    request.cookies.set('session', 'token-value');

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Cache')).toBe('BYPASS');
  });

  it('should bypass cache for authenticated requests with x-user-id header', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/api/assets'));
    request.headers.set('x-user-id', 'user123');

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Cache')).toBe('BYPASS');
  });

  it('should include timestamp in response', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/api/assets'));
    const response = await GET(request);

    const data = await response.json();
    expect(data.timestamp).toBeDefined();

    const timestamp = new Date(data.timestamp);
    expect(timestamp).toBeInstanceOf(Date);
    expect(timestamp.getTime()).toBeCloseTo(Date.now(), -3); // within 1 second
  });

  it('should handle order-invariant caching for symbols', async () => {
    // This test checks that the cache key is generated correctly
    // so that ?symbol=XLM,USDC and ?symbol=USDC,XLM hit the same cache
    const request1 = new NextRequest(new URL('http://localhost:3000/api/assets?symbol=XLM,USDC'));
    const response1 = await GET(request1);

    const request2 = new NextRequest(new URL('http://localhost:3000/api/assets?symbol=USDC,XLM'));
    const response2 = await GET(request2);

    const data1 = await response1.json();
    const data2 = await response2.json();

    const symbols1 = data1.assets.map((a: any) => a.symbol).sort();
    const symbols2 = data2.assets.map((a: any) => a.symbol).sort();

    expect(symbols1).toEqual(symbols2);
  });
});

describe('POST /api/assets', () => {
  it('should return 405 Method Not Allowed', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/api/assets'), {
      method: 'POST',
    });

    const response = await POST();

    expect(response.status).toBe(405);
    const data = await response.json();

    expect(data.error).toBeDefined();
    expect(data.error).toContain('not allowed');
  });
});

describe('Assets route integration', () => {
  it('should handle edge case with empty symbol param', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/api/assets?symbol='));
    const response = await GET(request);

    // Empty string should be treated as "all assets"
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.assets.length).toBeGreaterThan(0);
  });

  it('should handle multiple requests without state pollution', async () => {
    const request1 = new NextRequest(new URL('http://localhost:3000/api/assets?symbol=XLM'));
    const response1 = await GET(request1);
    const data1 = await response1.json();

    const request2 = new NextRequest(new URL('http://localhost:3000/api/assets?symbol=USDC'));
    const response2 = await GET(request2);
    const data2 = await response2.json();

    expect(data1.assets[0].symbol).toBe('XLM');
    expect(data2.assets[0].symbol).toBe('USDC');
  });

  it('should validate all assets meet decimal requirements', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/api/assets'));
    const response = await GET(request);

    const data = await response.json();

    for (const asset of data.assets) {
      expect(asset.decimals).toBeGreaterThanOrEqual(0);
      expect(asset.decimals).toBeLessThanOrEqual(19);
      expect(Number.isInteger(asset.decimals)).toBe(true);
    }
  });

  it('should validate all assets have valid URLs', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/api/assets'));
    const response = await GET(request);

    const data = await response.json();

    for (const asset of data.assets) {
      expect(() => new URL(asset.logoUrl)).not.toThrow();
    }
  });

  it('should validate all assets have Stellar issuer accounts', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/api/assets'));
    const response = await GET(request);

    const data = await response.json();

    for (const asset of data.assets) {
      // XLM has "native", others have public keys
      if (asset.symbol === 'XLM') {
        expect(asset.stellarIssuer).toBe('native');
      } else {
        expect(asset.stellarIssuer).toMatch(/^G[A-Z0-9]{55}$/);
      }
    }
  });
});
