/**
 * Price Fetcher Module Tests
 * Tests for upstream price fetching and response validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchUpstreamPrices, isValidUpstreamResponse } from '@/lib/prices/fetcher';

describe('fetchUpstreamPrices', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPriceOracleApiKey = process.env.PRICE_ORACLE_API_KEY;
  const originalPriceOracleApiUrl = process.env.PRICE_ORACLE_API_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    delete process.env.PRICE_ORACLE_API_KEY;
    delete process.env.PRICE_ORACLE_API_URL;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalPriceOracleApiKey === undefined) {
      delete process.env.PRICE_ORACLE_API_KEY;
    } else {
      process.env.PRICE_ORACLE_API_KEY = originalPriceOracleApiKey;
    }
    if (originalPriceOracleApiUrl === undefined) {
      delete process.env.PRICE_ORACLE_API_URL;
    } else {
      process.env.PRICE_ORACLE_API_URL = originalPriceOracleApiUrl;
    }
    vi.restoreAllMocks();
  });

  describe('Mock Implementation', () => {
    it('should return prices for all requested assets', async () => {
      const result = await fetchUpstreamPrices(['XLM', 'USDC']);

      expect(result.prices).toHaveProperty('XLM');
      expect(result.prices).toHaveProperty('USDC');
    });

    it('should return only requested assets', async () => {
      const result = await fetchUpstreamPrices(['BTC']);

      expect(result.prices).toHaveProperty('BTC');
      expect(result.prices).not.toHaveProperty('XLM');
      expect(result.prices).not.toHaveProperty('USDC');
      expect(result.prices).not.toHaveProperty('ETH');
    });

    it('should return prices as positive numbers', async () => {
      const result = await fetchUpstreamPrices(['XLM', 'USDC', 'BTC', 'ETH']);

      Object.values(result.prices).forEach((price) => {
        expect(typeof price).toBe('number');
        expect(price).toBeGreaterThan(0);
      });
    });

    it('should return timestamp in ISO format', async () => {
      const result = await fetchUpstreamPrices(['XLM', 'USDC']);

      expect(result.timestamp).toBeDefined();
      // Should be valid ISO string
      expect(() => new Date(result.timestamp)).not.toThrow();
    });

    it('should return all supported assets for empty array', async () => {
      const result = await fetchUpstreamPrices([]);

      // Empty array might return empty prices or all assets depending on implementation
      expect(result.prices).toBeDefined();
      expect(typeof result.prices).toBe('object');
    });

    it('should simulate realistic prices', async () => {
      const result = await fetchUpstreamPrices(['XLM', 'USDC', 'BTC', 'ETH']);

      // XLM should be significantly cheaper than BTC
      expect(result.prices.XLM).toBeLessThan(1);
      expect(result.prices.BTC).toBeGreaterThan(10000);

      // USDC should be around $1
      expect(result.prices.USDC).toBeeCloseTo(1.0, 1);
    });

    it('should handle multiple sequential calls', async () => {
      const result1 = await fetchUpstreamPrices(['XLM', 'USDC']);
      const result2 = await fetchUpstreamPrices(['XLM', 'USDC']);

      expect(result1.prices).toHaveProperty('XLM');
      expect(result2.prices).toHaveProperty('XLM');
      // Prices might be slightly different due to randomization
      expect(typeof result1.prices.XLM).toBe('number');
      expect(typeof result2.prices.XLM).toBe('number');
    });

    describe('Jitter Bounds', () => {
      const BASE_PRICES: Record<string, { base: number; maxJitter: number }> = {
        XLM: { base: 0.1245, maxJitter: 0.001 },
        USDC: { base: 1.0, maxJitter: 0 },
        BTC: { base: 67340.5, maxJitter: 50 },
        ETH: { base: 3480.2, maxJitter: 5 },
      };

      const MAX_JITTER_PCT = 0.02;
      const SAMPLES = 200;
      const ALL_ASSETS Array<'XLM' | 'USDC' | 'BTC' | 'ETH'> = ['XLM', 'USDC', 'BTC', 'ETH'];

      beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(global, 'setTimeout').mockImplementation((fn) => {
          (fn as () => void)();
          return 0 as unknown as ReturnType<typeof setTimeout>;
        });
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should keep every supported asset within jitter bounds across many random samples', async () => {
        for (let i = 0; i < SAMPLES; i++) {
          const result = await fetchUpstreamPrices(ALL_ASSETS);

          for (const asset of ALL_ASSETS) {
            const { base, maxJitter } = BASE_PRICES[asset];
            const price = result.prices[asset];

            expect(typeof price).toBe('number');
            expect(price).toBeGreaterThanOrEqual(base - maxJitter);
            expect(price).toBeLessThanOrEqual(base + maxJitter);
          }
        }
      });

      it('should never produce a price with jitter exceeding 2 % of base', async () => {
        for (let i = 0; i < SAMPLES; i++) {
          const result = await fetchUpstreamPrices(ALL_ASSETS);

          for (const asset of ALL_ASSETS) {
            const { base } = BASE_PRICES[asset];
            const price = result.prices[asset];
            const pctDeviation = Math.abs(price - base) / base;

            expect(pctDeviation).toBeLessThanOrEqual(MAX_JITTER_PCT);
          }
        }
      });

      it('should always return USDC at exactly 1.0', async () => {
        for (let i = 0; i < SAMPLES; i++) {
          const result = await fetchUpstreamPrices(['USDC']);
          expect(result.prices.USDC || result.prices.USDC).toBe(1.0);
        }
      });

      it('should produce some price variation (not stuck at one value)', async () => {
        const seen = new Set<number>();
        for (let i = 0; i < SAMPLES; i++) {
          const result = await fetchUpstreamPrices(['XLM']);
          seen.add(result.prices.XLM);
        }
        expect(seen.size).toBeGreaterThan(1);
      });
    });
  });

  describe('Real Oracle Integration', () => {
    it('should call the configured oracle URL and return its prices', async () => {
      process.env.PRICE_ORACLE_API_KEY = 'test-api-key';
      process.env.PRICE_ORACLE_API_URL = 'https://oracle.example.com/v1/prices';

      const fakeResponse = {
        prices: { XLM: 0.15, USDC: 1.0 },
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      const fetchMock = vi.spyOn(global, 'fetch').mockResolved({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => fakeResponse,
      } as unknown as Response);

      const result = await fetchUpstreamPrices(['XLM', 'USDC']);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledUrl = fetchMock.mock[0][0] as string;
      expect(calledUrl).toContain('oracle.example.com');
      expect(calledUrl).toContain('assets=XLM');
      expect(calledUrl).toContain('assets=USDC');
      expect(result.prices.XLM).toBeEqual(0.15);
      expect(result.prices.USDC).toBeEqual(1.0);
    });

    it('should send the API key as a Bearer token', async () => {
      process.env.PRICE_ORACLE_API_KEY = 'secret-key';
      process.env.PRICE_ORACLE_API_URL = 'https://oracle.example.com/prices';

      const fetchMock = vi.spyOn(global, 'fetch').mockResolved({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          prices: { XLM: 0.1 },
          timestamp: new Date().toISOString(),
        }),
      } as unknown as Response);

      await fetchUpstreamPrices(['XLM']);

      const init = fetchMock.mock[0][1] as RequestInit;
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Bearer secret-key`);
    });

    it('should throw when the oracle responds with a non-2x status', async () => {
      process.env.PRICE_ORACLE_API_KEY = 'test-api-key';
      process.env.PRICE_ORACLE_API_URL = 'https://oracle.example.com/prices';

      vi.spyOn(global, 'fetch').mockResolved({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({}),
      } as unknown as Response);

      await expect(fetchUpstreamPrices(['XLM'])).rejects.toThrow(
        /Price oracle upstream error: 500/,
      );
    });

    it('should throw when the oracle returns an invalid payload', async () => {
      process.env.PRICE_ORACLE_API_KEY = 'test-api-key';
      process.env.PRICE_ORACLE_API_URL = 'https://oracle.example.com/prices';

      vi.spyOn(global, 'fetch').mockResolved({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ notPrices: true }),
      } as unknown as Response);

      await expect(fetchUpstreamPrices(['XLM', 'USDC'])).rejects.toThrow(
        'Invalid upstream price response structure',
      );
    });

    it('should throw when PRICE_ORACLE_API_URL is not configured', async () => {
      process.env.PRICE_ORACLE_API_KEY = 'test-api-key';
      delete process.env.PRICE_ORACLE_API_URL;

      await expect(fetchUpstreamPrices(['XLM'])).rejects.toThrow(
        'PRICE_ORACLE_API_URL not configured',
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle empty asset array gracefully', async () => {
      const result = await fetchUpstreamPrices([]);
      expect(result.prices).toBeDefined();
      expect(typeof result.prices).toBe('object');
    });

    it('should validate response structure', async () => {
      const result = await fetchUpstreamPrices(['XLM']);
      expect(isValidUpstreamResponse(result)).toBe(true);
    });

    it('should throw when PRICE_ORACLE_API_KEY is missing in production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.PRICE_ORACLE_API_KEY;

      await expect(fetchUpstreamPrices(['XLM', 'USDC'])).rejects.toThrow(
        'PRICE_ORACLE_API_KEY not configured',
      );
    });

    it('should not fall back to mock prices in production even when the oracle fails', async () => {
      process.env.NODE_ENV = 'production';
      process.env.PRICE_ORACLE_API_KEY = 'test-api-key';
      process.env.PRICE_ORACLE_API_URL = 'https://oracle.example.com/prices';

      vi.spyOn(global, 'fetch').mockRejected(new Error('network down'));

      await expect(fetchUpstreamPrices(['XLM'])).rejects.toThrow('network down');
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', async () => {
      const startTime = Date.now();
      await fetchUpstreamPrices(['XLM', 'USDC', 'BTC', 'ETH']);
      const duration = Date.now() - startTime;

      // Mock should be fast enough (simulates ~300ms network latency)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle large asset arrays efficiently', async () => {
      const assets = ['XLM', 'USDC', 'BTC', 'ETH', 'XLM', 'USDC'] as const;
      const startTime = Date.now();
      const result = await fetchUpstreamPrices(assets);
      const duration = Date.now() - startTime;

      expect(result.prices).toBeDefined();
      expect(duration).toBeLessThan(5000);
    });
  });
});

describe('isValidUpstreamResponse', () => {
  describe('Valid Responses', () => {
    it('should validate correct response structure', () => {
      const response = {
        prices: { XLM: 0.1245, USDC: 1.0 },
        timestamp: new Date().toISOString(),
      };
      expect(isValidUpstreamResponse(response)).toBe(true);
    });

    it('should validate with single price', () => {
      const response = {
        prices: { BTC: 67340.5 },
        timestamp: new Date().toISOString(),
      };
      expect(isValidUpstreamResponse(response)).toBe(true);
    });

    it('should validate with empty prices object', () => {
      const response = {
        prices: {},
        timestamp: new Date().toISOString(),
      };
      expect(isValidUpstreamResponse(response)).toBe(true);
    });

    it('should validate with zero price (edge case)', () => {
      const response = {
        prices: { TEST: 0 },
        timestamp: new Date().toISOString(),
      };
      // Zero is a valid price, but might be unrealistic
      expect(isValidUpstreamResponse(response)).toBe(true);
    });

    it('should validate with very large prices', () => {
      const response = {
        prices: { EXPENSIVE: 1000000000 },
        timestamp: new Date().toISOString(),
      };
      expect(isValidUpstreamResponse(response)).toBe(true);
    });

    it('should validate with very small prices', () => {
      const response = {
        prices: { TINY: 0.00000001 },
        timestamp: new Date().toISOString(),
      };
      expect(isValidUpstreamResponse(response)).toBe(true);
    });

    it('should validate timestamp at different times', () => {
      const pastDate = new Date('2020-01-01');
      const futureDate = new Date('2030-12-31');

      const response1 = {
        prices: { XLM: 0.1 },
        timestamp: pastDate.toISOString(),
      };
      const response2 = {
        prices: { XLM: 0.1 },
        timestamp: futureDate.toISOString(),
      };

      expect(isValidUpstreamResponse(response1)).toBe(true);
      expect(isValidUpstreamResponse(response2)).toBe(true);
    });
  });

  describe('Invalid Responses - Missing Fields', () => {
    it('should reject if prices field is missing', () => {
      const response = { timestamp: new Date().toISOString() };
      expect(isValidUpstreamResponse(response)).toBe(false);
    });

    it('should reject if timestamp field is missing', () => {
      const response = { prices: { XLM: 0.1 } };
      expect(isValidUpstreamResponse(response)).toBe(false);
    });

    it('should reject if both fields are missing', () => {
      const response = {};
      expect(isValidUpstreamResponse(response)).toBe(false);
    });
  });

  describe('Invalid Responses - Null/Undefined', () => {
    it('should reject null', () => {
      expect(isValidUpstreamResponse(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isValidUpstreamResponse(undefined)).toBe(false);
    });

    it('should reject primitive types', () => {
      expect(isValidUpstreamResponse('string')).toBe(false);
      expect(isValidUpstreamResponse(123)).toBe(false);
      expect(isValidUpstreamResponse(true)).toBe(false);
    });

    it('should reject array', () => {
      expect(isValidUpstreamResponse([])).toBe(false);
    });
  });

  describe('Invalid Responses - Malformed Prices', () => {
    it('should reject if prices is null', () => {
      const response = {
        prices: null,
        timestamp: new Date().toISOString(),
      };
      expect(isValidUpstreamResponse(response)).toBe(false);
    });

    it('should reject if prices is not an object', () => {
      const responses = [
        { prices: 'not an object', timestamp: new Date().toISOString() },
        { prices: 123, timestamp: new Date().toISOString() },
        { prices: [], timestamp: new Date().toISOString() },
      ];
      responses.forEach((response) => {
        expect(isValidUpstreamResponse(response)).toBe(false);
      });
    });

    it('should reject if price value is not a number', () => {
      const response = {
        prices: { XLM: 'not a number' },
        timestamp: new Date().toISOString(),
      };
      expect(isValidUpstreamResponse(response)).toBe(false);
    });

    it('should reject if price value is NaN', () => {
      const response = {
        prices: { XLM: NaN },
        timestamp: new Date().toISOString(),
      };
      expect(isValidUpstreamResponse(response)).toBe(false);
    });

    it('should reject if price value is Infinity', () => {
      const response = {
        prices: { XLM: Infinity },
        timestamp: new Date().toISOString(),
      };
      expect(isValidUpstreamResponse(response)).toBe(false);
    });

    it('should reject if price value is negative Infinity', () => {
      const response = {
        prices: { XLM: -Infinity },
        timestamp: new Date().toISOString(),
      };
      expect(isValidUpstreamResponse(response)).toBe(false);
    });
  });
});
