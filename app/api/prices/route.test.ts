/**
 * Price Oracle API Route Tests
 * Comprehensive test coverage for the prices endpoint with caching, validation, and security
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { globalCache } from '@/lib/cache';
import * as pricesFetcher from '@/lib/prices/fetcher';

// Mock the prices fetcher module
vi.mock('@/lib/prices/fetcher', async () => {
  const actual = await vi.importActual('@/lib/prices/fetcher');
  return {
    ...actual,
    fetchUpstreamPrices: vi.fn(),
    isValidUpstreamResponse: vi.fn(actual.isValidUpstreamResponse),
  };
});

// Mock the global cache
vi.mock('@/lib/cache', () => ({
  globalCache: {
    getOrFetch: vi.fn(),
    clear: vi.fn(),
  },
}));

describe('Price Oracle API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalCache.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/prices - Basic Functionality', () => {
    it('should return all supported assets when no query parameter is provided', async () => {
      const mockResponse = {
        prices: {
          XLM: 0.1245,
          USDC: 1.0,
          BTC: 67340.5,
          ETH: 3480.2,
        },
        timestamp: new Date().toISOString(),
        source: 'Stellar Price Oracle Proxy',
      };

      vi.mocked(globalCache.getOrFetch).mockResolvedValue({
        value: mockResponse,
        status: 'MISS',
      });

      const request = new NextRequest('http://localhost:3000/api/prices');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.prices).toHaveProperty('XLM');
      expect(data.prices).toHaveProperty('USDC');
      expect(data.prices).toHaveProperty('BTC');
      expect(data.prices).toHaveProperty('ETH');
      expect(data.source).toBe('Stellar Price Oracle Proxy');
    });

    it('should return only requested assets when query parameter is provided', async () => {
      const mockResponse = {
        prices: {
          XLM: 0.1245,
          USDC: 1.0,
        },
        timestamp: new Date().toISOString(),
        source: 'Stellar Price Oracle Proxy',
      };

      vi.mocked(globalCache.getOrFetch).mockResolvedValue({
        value: mockResponse,
        status: 'HIT',
      });

      const request = new NextRequest('http://localhost:3000/api/prices?assets=XLM,USDC');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.prices).toEqual({ XLM: 0.1245, USDC: 1.0 });
      expect(data.cached).toBe(true);
    });

    it('should handle single asset query', async () => {
      const mockResponse = {
        prices: { BTC: 67340.5 },
        timestamp: new Date().toISOString(),
        source: 'Stellar Price Oracle Proxy',
      };

      vi.mocked(globalCache.getOrFetch).mockResolvedValue({
        value: mockResponse,
        status: 'MISS',
      });

      const request = new NextRequest('http://localhost:3000/api/prices?assets=BTC');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.prices).toEqual({ BTC: 67340.5 });
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid asset names', async () => {
      const request = new NextRequest('http://localhost:3000/api/prices?assets=XLM,INVALID,BTC');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('INVALID_ASSETS_QUERY');
      expect(data.error).toContain('Unsupported asset');
    });

    it('should reject duplicate assets', async () => {
      const request = new NextRequest('http://localhost:3000/api/prices?assets=XLM,XLM,BTC');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('INVALID_ASSETS_QUERY');
      expect(data.error).toContain('Duplicate asset');
    });

    it('should reject if too many assets are requested', async () => {
      const tooManyAssets = Array(11).fill('XLM').join(',');
      const request = new NextRequest(`http://localhost:3000/api/prices?assets=${tooManyAssets}`);
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('INVALID_ASSETS_QUERY');
      expect(data.error).toContain('Too many assets');
    });

    it('should handle empty assets parameter gracefully', async () => {
      const mockResponse = {
        prices: {
          XLM: 0.1245,
          USDC: 1.0,
          BTC: 67340.5,
          ETH: 3480.2,
        },
        timestamp: new Date().toISOString(),
        source: 'Stellar Price Oracle Proxy',
      };

      vi.mocked(globalCache.getOrFetch).mockResolvedValue({
        value: mockResponse,
        status: 'MISS',
      });

      const request = new NextRequest('http://localhost:3000/api/prices?assets=');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Object.keys(data.prices).length).toBe(4);
    });

    it('should normalize case-insensitive asset names', async () => {
      const mockResponse = {
        prices: { XLM: 0.1245, ETH: 3480.2 },
        timestamp: new Date().toISOString(),
        source: 'Stellar Price Oracle Proxy',
      };

      vi.mocked(globalCache.getOrFetch).mockResolvedValue({
        value: mockResponse,
        status: 'MISS',
      });

      const request = new NextRequest('http://localhost:3000/api/prices?assets=xlm,eth');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.prices).toHaveProperty('XLM');
      expect(data.prices).toHaveProperty('ETH');
    });

    it('should handle whitespace in asset names', async () => {
      const mockResponse = {
        prices: { XLM: 0.1245, USDC: 1.0 },
        timestamp: new Date().toISOString(),
        source: 'Stellar Price Oracle Proxy',
      };

      vi.mocked(globalCache.getOrFetch).mockResolvedValue({
        value: mockResponse,
        status: 'MISS',
      });

      const request = new NextRequest('http://localhost:3000/api/prices?assets=  XLM  ,  USDC  ');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.prices).toHaveProperty('XLM');
      expect(data.prices).toHaveProperty('USDC');
    });
  });

  describe('Caching', () => {
    it('should use cache for public requests', async () => {
      const mockResponse = {
        prices: { XLM: 0.1245 },
        timestamp: new Date().toISOString(),
        source: 'Stellar Price Oracle Proxy',
      };

      vi.mocked(globalCache.getOrFetch).mockResolvedValue({
        value: mockResponse,
        status: 'HIT',
      });

      const request = new NextRequest('http://localhost:3000/api/prices?assets=XLM');
      const response = await GET(request);

      expect(vi.mocked(globalCache.getOrFetch)).toHaveBeenCalled();
      expect(response.headers.get('X-Cache')).toBe('HIT');
    });

    it('should return proper cache headers for HIT', async () => {
      const mockResponse = {
        prices: { XLM: 0.1245 },
        timestamp: new Date().toISOString(),
        source: 'Stellar Price Oracle Proxy',
      };

      vi.mocked(globalCache.getOrFetch).mockResolvedValue({
        value: mockResponse,
        status: 'HIT',
      });

      const request = new NextRequest('http://localhost:3000/api/prices');
      const response = await GET(request);

      expect(response.headers.get('Cache-Control')).toContain('public');
      expect(response.headers.get('Cache-Control')).toContain('max-age=5');
      expect(response.headers.get('Cache-Control')).toContain('stale-while-revalidate=10');
    });

    it('should return proper cache headers for STALE', async () => {
      const mockResponse = {
        prices: { XLM: 0.1245 },
        timestamp: new Date().toISOString(),
        source: 'Stellar Price Oracle Proxy',
      };

      vi.mocked(globalCache.getOrFetch).mockResolvedValue({
        value: mockResponse,
        status: 'STALE',
      });

      const request = new NextRequest('http://localhost:3000/api/prices');
      const response = await GET(request);

      expect(response.headers.get('X-Cache')).toBe('STALE');
    });

    it('should return cached flag in response', async () => {
      const mockResponse = {
        prices: { XLM: 0.1245 },
        timestamp: new Date().toISOString(),
        source: 'Stellar Price Oracle Proxy',
      };

      vi.mocked(globalCache.getOrFetch).mockResolvedValue({
        value: mockResponse,
        status: 'HIT',
      });

      const request = new NextRequest('http://localhost:3000/api/prices');
      const response = await GET(request);
      const data = await response.json();

      expect(data.cached).toBe(true);
    });
  });

  describe('Security - Cache Bypass for Authenticated Requests', () => {
    it('should bypass cache for requests with Authorization header', async () => {
      const mockResponse = {
        prices: { XLM: 0.1245 },
        timestamp: new Date().toISOString(),
        source: 'Stellar Price Oracle Proxy',
      };

      vi.mocked(pricesFetcher.fetchUpstreamPrices).mockResolvedValue({
        prices: { XLM: 0.1245 },
        timestamp: new Date().toISOString(),
      });

      const request = new NextRequest('http://localhost:3000/api/prices', {
        headers: { Authorization: 'Bearer token123' },
      });
      const response = await GET(request);

      expect(response.headers.get('X-Cache')).toBe('BYPASS');
      expect(response.headers.get('Cache-Control')).toContain('no-store');
      expect(vi.mocked(globalCache.getOrFetch)).not.toHaveBeenCalled();
    });

    it('should bypass cache for requests with session cookie', async () => {
      vi.mocked(pricesFetcher.fetchUpstreamPrices).mockResolvedValue({
        prices: { XLM: 0.1245 },
        timestamp: new Date().toISOString(),
      });

      const request = new NextRequest('http://localhost:3000/api/prices', {
        headers: { cookie: 'session=abc123' },
      });
      const response = await GET(request);

      expect(response.headers.get('X-Cache')).toBe('BYPASS');
    });

    it('should bypass cache for requests with token cookie', async () => {
      vi.mocked(pricesFetcher.fetchUpstreamPrices).mockResolvedValue({
        prices: { XLM: 0.1245 },
        timestamp: new Date().toISOString(),
      });

      const request = new NextRequest('http://localhost:3000/api/prices', {
        headers: { cookie: 'token=xyz789' },
      });
      const response = await GET(request);

      expect(response.headers.get('X-Cache')).toBe('BYPASS');
    });

    it('should bypass cache for requests with x-user-id header', async () => {
      vi.mocked(pricesFetcher.fetchUpstreamPrices).mockResolvedValue({
        prices: { XLM: 0.1245 },
        timestamp: new Date().toISOString(),
      });

      const request = new NextRequest('http://localhost:3000/api/prices', {
        headers: { 'x-user-id': 'user123' },
      });
      const response = await GET(request);

      expect(response.headers.get('X-Cache')).toBe('BYPASS');
    });
  });

  describe('Error Handling', () => {
    it('should handle upstream fetch errors gracefully', async () => {
      vi.mocked(globalCache.getOrFetch).mockRejectedValue(new Error('Upstream API error'));

      const request = new NextRequest('http://localhost:3000/api/prices');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.code).toBe('PRICE_FETCH_ERROR');
      expect(data.error).toContain('Upstream API error');
    });

    it('should return 500 for generic errors', async () => {
      vi.mocked(globalCache.getOrFetch).mockRejectedValue(new Error('Unexpected error'));

      const request = new NextRequest('http://localhost:3000/api/prices');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.code).toBe('PRICE_FETCH_ERROR');
    });

    it('should include timestamp in error responses', async () => {
      vi.mocked(globalCache.getOrFetch).mockRejectedValue(new Error('Test error'));

      const request = new NextRequest('http://localhost:3000/api/prices');
      const response = await GET(request);
      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      expect(new Date(data.timestamp)).toBeInstanceOf(Date);
    });

    it('should not cache error responses', async () => {
      vi.mocked(globalCache.getOrFetch).mockRejectedValue(new Error('Test error'));

      const request = new NextRequest('http://localhost:3000/api/prices');
      const response = await GET(request);

      expect(response.headers.get('Cache-Control')).toContain('no-cache');
      expect(response.headers.get('Cache-Control')).toContain('no-store');
    });
  });

  describe('Response Format', () => {
    it('should include all required fields in success response', async () => {
      const mockResponse = {
        prices: { XLM: 0.1245 },
        timestamp: new Date().toISOString(),
        source: 'Stellar Price Oracle Proxy',
      };

      vi.mocked(globalCache.getOrFetch).mockResolvedValue({
        value: mockResponse,
        status: 'MISS',
      });

      const request = new NextRequest('http://localhost:3000/api/prices');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('prices');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('source');
      expect(data).toHaveProperty('cached');
    });

    it('should have valid prices as positive numbers', async () => {
      const mockResponse = {
        prices: { XLM: 0.1245, BTC: 67340.5 },
        timestamp: new Date().toISOString(),
        source: 'Stellar Price Oracle Proxy',
      };

      vi.mocked(globalCache.getOrFetch).mockResolvedValue({
        value: mockResponse,
        status: 'MISS',
      });

      const request = new NextRequest('http://localhost:3000/api/prices?assets=XLM,BTC');
      const response = await GET(request);
      const data = await response.json();

      expect(data.prices.XLM).toBeGreaterThan(0);
      expect(data.prices.BTC).toBeGreaterThan(0);
    });
  });

  describe('HTTP Headers', () => {
    it('should include Vary header for content negotiation', async () => {
      const mockResponse = {
        prices: { XLM: 0.1245 },
        timestamp: new Date().toISOString(),
        source: 'Stellar Price Oracle Proxy',
      };

      vi.mocked(globalCache.getOrFetch).mockResolvedValue({
        value: mockResponse,
        status: 'HIT',
      });

      const request = new NextRequest('http://localhost:3000/api/prices');
      const response = await GET(request);

      expect(response.headers.get('Vary')).toBe('Accept-Encoding');
    });

    it('should set Pragma no-cache header for auth bypass', async () => {
      vi.mocked(pricesFetcher.fetchUpstreamPrices).mockResolvedValue({
        prices: { XLM: 0.1245 },
        timestamp: new Date().toISOString(),
      });

      const request = new NextRequest('http://localhost:3000/api/prices', {
        headers: { Authorization: 'Bearer token' },
      });
      const response = await GET(request);

      expect(response.headers.get('Pragma')).toBe('no-cache');
    });

    it('should set Expires header to 0 for auth bypass', async () => {
      vi.mocked(pricesFetcher.fetchUpstreamPrices).mockResolvedValue({
        prices: { XLM: 0.1245 },
        timestamp: new Date().toISOString(),
      });

      const request = new NextRequest('http://localhost:3000/api/prices', {
        headers: { Authorization: 'Bearer token' },
      });
      const response = await GET(request);

      expect(response.headers.get('Expires')).toBe('0');
    });
  });

  describe('Asset Parameter Order Independence', () => {
    it('should produce same results regardless of asset query order', async () => {
      const mockResponse = {
        prices: { XLM: 0.1245, USDC: 1.0, BTC: 67340.5 },
        timestamp: new Date().toISOString(),
        source: 'Stellar Price Oracle Proxy',
      };

      vi.mocked(globalCache.getOrFetch)
        .mockResolvedValueOnce({ value: mockResponse, status: 'MISS' })
        .mockResolvedValueOnce({ value: mockResponse, status: 'HIT' });

      const request1 = new NextRequest('http://localhost:3000/api/prices?assets=XLM,USDC,BTC');
      const request2 = new NextRequest('http://localhost:3000/api/prices?assets=BTC,XLM,USDC');

      const response1 = await GET(request1);
      const response2 = await GET(request2);

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(data1.prices).toEqual(data2.prices);
    });
  });
});
