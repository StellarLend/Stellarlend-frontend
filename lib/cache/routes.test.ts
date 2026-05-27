import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as pricesGET } from '../../app/api/prices/route';
import { GET as positionsGET } from '../../app/api/positions/route';
import { globalCache } from './index';

describe('API Caching Routes Integration', () => {
  beforeEach(() => {
    globalCache.clear();
  });

  afterEach(() => {
    globalCache.clear();
  });

  describe('GET /api/prices', () => {
    it('should fetch prices on initial request as a MISS and set public Cache-Control', async () => {
      const req = new NextRequest('http://localhost/api/prices');
      const response = await pricesGET(req);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Cache')).toBe('MISS');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=5, stale-while-revalidate=10');
      
      const body = await response.json();
      expect(body.prices).toBeDefined();
      expect(body.prices.XLM).toBeDefined();
    });

    it('should return cached prices on subsequent request as a HIT', async () => {
      const req1 = new NextRequest('http://localhost/api/prices');
      await pricesGET(req1);
      
      const req2 = new NextRequest('http://localhost/api/prices');
      const response = await pricesGET(req2);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Cache')).toBe('HIT');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=5, stale-while-revalidate=10');
    });

    it('should support asset filtering and cache separate asset keys', async () => {
      // Request only XLM
      const reqXlm1 = new NextRequest('http://localhost/api/prices?assets=XLM');
      const resXlm1 = await pricesGET(reqXlm1);
      expect(resXlm1.headers.get('X-Cache')).toBe('MISS');
      
      const bodyXlm1 = await resXlm1.json();
      expect(bodyXlm1.prices.XLM).toBeDefined();
      expect(bodyXlm1.prices.BTC).toBeUndefined();

      // Request XLM again -> HIT
      const reqXlm2 = new NextRequest('http://localhost/api/prices?assets=XLM');
      const resXlm2 = await pricesGET(reqXlm2);
      expect(resXlm2.headers.get('X-Cache')).toBe('HIT');

      // Request BTC -> MISS (separate cache key)
      const reqBtc = new NextRequest('http://localhost/api/prices?assets=BTC');
      const resBtc = await pricesGET(reqBtc);
      expect(resBtc.headers.get('X-Cache')).toBe('MISS');
      
      const bodyBtc = await resBtc.json();
      expect(bodyBtc.prices.BTC).toBeDefined();
      expect(bodyBtc.prices.XLM).toBeUndefined();
    });

    it('should bypass cache when Authorization header is present', async () => {
      // Set value in cache first
      const reqNormal = new NextRequest('http://localhost/api/prices');
      await pricesGET(reqNormal);

      // Now request with Authorization
      const reqAuth = new NextRequest('http://localhost/api/prices', {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });
      const response = await pricesGET(reqAuth);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Cache')).toBe('BYPASS');
      expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
    });

    it('should bypass cache when session cookie is present', async () => {
      const reqCookie = new NextRequest('http://localhost/api/prices', {
        headers: {
          'Cookie': 'session=active-session-id',
        },
      });
      const response = await pricesGET(reqCookie);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Cache')).toBe('BYPASS');
      expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
    });

    it('should handle errors gracefully and return status 500', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockReq = {
        get url() {
          throw new Error('Simulated URL parsing error');
        }
      } as any;

      const response = await pricesGET(mockReq);
      expect(response.status).toBe(500);
      
      const body = await response.json();
      expect(body.error).toBe('Failed to fetch prices');
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('GET /api/positions', () => {
    it('should fetch public positions as a MISS', async () => {
      const req = new NextRequest('http://localhost/api/positions');
      const response = await positionsGET(req);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Cache')).toBe('MISS');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=10, stale-while-revalidate=20');
      
      const body = await response.json();
      expect(body.positions).toBeDefined();
      expect(body.userId).toBe('anonymous');
      expect(body.mode).toBe('public');
    });

    it('should return cached positions as a HIT', async () => {
      const req1 = new NextRequest('http://localhost/api/positions');
      await positionsGET(req1);
      
      const req2 = new NextRequest('http://localhost/api/positions');
      const response = await positionsGET(req2);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Cache')).toBe('HIT');
    });

    it('should bypass cache when x-user-id header is present', async () => {
      const req = new NextRequest('http://localhost/api/positions', {
        headers: {
          'x-user-id': 'user-123',
        },
      });
      const response = await positionsGET(req);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Cache')).toBe('BYPASS');
      expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
      
      const body = await response.json();
      expect(body.userId).toBe('user-123');
      expect(body.mode).toBe('authenticated');
    });

    it('should bypass cache when userId query parameter is present', async () => {
      const req = new NextRequest('http://localhost/api/positions?userId=user-456');
      const response = await positionsGET(req);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Cache')).toBe('BYPASS');
      
      const body = await response.json();
      expect(body.userId).toBe('user-456');
      expect(body.mode).toBe('authenticated');
    });

    it('should handle errors gracefully and return status 500', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockReq = {
        get headers() {
          throw new Error('Simulated headers error');
        }
      } as any;

      const response = await positionsGET(mockReq);
      expect(response.status).toBe(500);
      
      const body = await response.json();
      expect(body.error).toBe('Failed to fetch positions');
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
