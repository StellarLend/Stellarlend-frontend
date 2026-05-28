/**
 * Price Validation Utilities Tests
 * Comprehensive tests for input validation and cache key generation
 */

import { describe, it, expect } from 'vitest';
import {
  validateAssetsQuery,
  generateCacheKey,
  hasNoApiKeys,
} from '@/lib/prices/validation';
import { SUPPORTED_ASSETS, MAX_ASSETS_IN_QUERY } from '@/lib/prices/constants';

describe('validateAssetsQuery', () => {
  describe('Valid Inputs', () => {
    it('should return all supported assets for null input', () => {
      const result = validateAssetsQuery(null);
      expect(result.valid).toBe(true);
      expect(result.assets).toEqual(SUPPORTED_ASSETS);
      expect(result.errors).toHaveLength(0);
    });

    it('should return all supported assets for undefined input', () => {
      const result = validateAssetsQuery(undefined);
      expect(result.valid).toBe(true);
      expect(result.assets).toEqual(SUPPORTED_ASSETS);
      expect(result.errors).toHaveLength(0);
    });

    it('should return all supported assets for empty string', () => {
      const result = validateAssetsQuery('');
      expect(result.valid).toBe(true);
      expect(result.assets).toEqual(SUPPORTED_ASSETS);
    });

    it('should return all supported assets for whitespace-only string', () => {
      const result = validateAssetsQuery('   ');
      expect(result.valid).toBe(true);
      expect(result.assets).toEqual(SUPPORTED_ASSETS);
    });

    it('should normalize single asset', () => {
      const result = validateAssetsQuery('xlm');
      expect(result.valid).toBe(true);
      expect(result.assets).toEqual(['XLM']);
    });

    it('should normalize multiple assets', () => {
      const result = validateAssetsQuery('xlm,usdc,btc,eth');
      expect(result.valid).toBe(true);
      expect(result.assets).toEqual(['XLM', 'USDC', 'BTC', 'ETH']);
    });

    it('should handle mixed case', () => {
      const result = validateAssetsQuery('XLM,Usdc,bTc,ETH');
      expect(result.valid).toBe(true);
      expect(result.assets).toContain('XLM');
      expect(result.assets).toContain('USDC');
      expect(result.assets).toContain('BTC');
      expect(result.assets).toContain('ETH');
    });

    it('should trim whitespace from assets', () => {
      const result = validateAssetsQuery('  XLM  ,  USDC  ,  BTC  ');
      expect(result.valid).toBe(true);
      expect(result.assets).toEqual(['XLM', 'USDC', 'BTC']);
    });

    it('should filter out empty strings from split', () => {
      const result = validateAssetsQuery('XLM,,USDC,,');
      expect(result.valid).toBe(true);
      expect(result.assets).toEqual(['XLM', 'USDC']);
    });
  });

  describe('Invalid Inputs', () => {
    it('should reject unsupported asset', () => {
      const result = validateAssetsQuery('XLM,INVALID');
      expect(result.valid).toBe(false);
      expect(result.assets).toEqual(['XLM']);
      expect(result.errors).toContain('Unsupported asset: INVALID. Supported assets: XLM, USDC, BTC, ETH');
    });

    it('should reject multiple unsupported assets', () => {
      const result = validateAssetsQuery('XLM,INVALID1,INVALID2,USDC');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors.some((e) => e.includes('INVALID1'))).toBe(true);
      expect(result.errors.some((e) => e.includes('INVALID2'))).toBe(true);
    });

    it('should reject duplicate assets', () => {
      const result = validateAssetsQuery('XLM,XLM');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Duplicate asset: XLM');
    });

    it('should reject multiple duplicates', () => {
      const result = validateAssetsQuery('XLM,XLM,USDC,USDC');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('Duplicate asset: XLM');
      expect(result.errors).toContain('Duplicate asset: USDC');
    });

    it('should reject if too many assets requested', () => {
      const tooMany = Array(MAX_ASSETS_IN_QUERY + 1).fill('XLM').join(',');
      const result = validateAssetsQuery(tooMany);
      expect(result.valid).toBe(false);
      expect(result.assets).toHaveLength(0);
      expect(result.errors).toContain(`Too many assets requested. Maximum is ${MAX_ASSETS_IN_QUERY}.`);
    });

    it('should accept exactly MAX_ASSETS_IN_QUERY assets', () => {
      const assets = ['XLM', 'USDC', 'BTC', 'ETH', 'XLM'];
      const validAssets = [...new Set(assets)].slice(0, MAX_ASSETS_IN_QUERY).join(',');
      const result = validateAssetsQuery(validAssets);
      expect(result.valid).toBe(true);
      expect(result.assets.length).toBeLessThanOrEqual(MAX_ASSETS_IN_QUERY);
    });

    it('should handle combination of errors', () => {
      const result = validateAssetsQuery('XLM,XLM,INVALID,USDC');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors.some((e) => e.includes('Duplicate'))).toBe(true);
      expect(result.errors.some((e) => e.includes('Unsupported'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long string gracefully', () => {
      const longString = Array(100).fill('XLM').join(',');
      const result = validateAssetsQuery(longString);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(`Too many assets requested. Maximum is ${MAX_ASSETS_IN_QUERY}.`);
    });

    it('should handle special characters', () => {
      const result = validateAssetsQuery('XLM@,#USDC$');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle numeric strings', () => {
      const result = validateAssetsQuery('123,456');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('generateCacheKey', () => {
  it('should generate consistent key for same assets in different order', () => {
    const key1 = generateCacheKey(['XLM', 'USDC', 'BTC']);
    const key2 = generateCacheKey(['BTC', 'XLM', 'USDC']);
    const key3 = generateCacheKey(['USDC', 'BTC', 'XLM']);

    expect(key1).toBe(key2);
    expect(key2).toBe(key3);
  });

  it('should generate different keys for different asset sets', () => {
    const key1 = generateCacheKey(['XLM', 'USDC']);
    const key2 = generateCacheKey(['XLM', 'BTC']);

    expect(key1).not.toBe(key2);
  });

  it('should use "all" for empty array', () => {
    const key = generateCacheKey([]);
    expect(key).toBe('prices:all');
  });

  it('should include prefix in key', () => {
    const key = generateCacheKey(['XLM']);
    expect(key).toMatch(/^prices:/);
  });

  it('should sort assets alphabetically', () => {
    const key = generateCacheKey(['BTC', 'XLM', 'USDC', 'ETH']);
    // After sorting: BTC, ETH, USDC, XLM
    expect(key).toBe('prices:BTC,ETH,USDC,XLM');
  });

  it('should handle single asset', () => {
    const key = generateCacheKey(['XLM']);
    expect(key).toBe('prices:XLM');
  });
});

describe('hasNoApiKeys', () => {
  it('should return true for clean object', () => {
    const data = {
      prices: { XLM: 0.1245, USDC: 1.0 },
      timestamp: new Date().toISOString(),
    };
    expect(hasNoApiKeys(data)).toBe(true);
  });

  it('should return true for null', () => {
    expect(hasNoApiKeys(null)).toBe(true);
  });

  it('should return true for undefined', () => {
    expect(hasNoApiKeys(undefined)).toBe(true);
  });

  it('should return true for primitives', () => {
    expect(hasNoApiKeys('string')).toBe(true);
    expect(hasNoApiKeys(123)).toBe(true);
    expect(hasNoApiKeys(true)).toBe(true);
  });

  it('should return false if API_KEY found', () => {
    const data = { api_key: 'secret123' };
    expect(hasNoApiKeys(data)).toBe(false);
  });

  it('should return false if APIKEY found', () => {
    const data = { apikey: 'secret123' };
    expect(hasNoApiKeys(data)).toBe(false);
  });

  it('should return false if SECRET found', () => {
    const data = { secret: 'sensitive' };
    expect(hasNoApiKeys(data)).toBe(false);
  });

  it('should return false if TOKEN found', () => {
    const data = { token: 'abc123' };
    expect(hasNoApiKeys(data)).toBe(false);
  });

  it('should return false if PASSWORD found', () => {
    const data = { password: 'pass123' };
    expect(hasNoApiKeys(data)).toBe(false);
  });

  it('should return false if AUTH found', () => {
    const data = { auth: 'token' };
    expect(hasNoApiKeys(data)).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(hasNoApiKeys({ API_KEY: 'secret' })).toBe(false);
    expect(hasNoApiKeys({ Secret: 'sensitive' })).toBe(false);
    expect(hasNoApiKeys({ TOKEN: 'abc' })).toBe(false);
  });

  it('should check nested objects', () => {
    const data = {
      prices: {
        nested: {
          api_key: 'secret',
        },
      },
    };
    expect(hasNoApiKeys(data)).toBe(false);
  });

  it('should check arrays', () => {
    const data = [{ api_key: 'secret' }];
    expect(hasNoApiKeys(data)).toBe(false);
  });
});
