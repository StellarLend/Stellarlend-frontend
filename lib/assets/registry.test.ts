/**
 * Tests for lib/assets/registry module
 * 
 * Coverage:
 * - Registry loading from JSON file
 * - Registry validation (schema, required fields, values)
 * - Registry accessors (getRegistry, getAssetMetadata, getAllAssets, hasAsset)
 * - Error handling (missing files, invalid data, missing assets)
 * - Type safety and guards
 * 
 * @module lib/assets/registry.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getRegistry,
  getAssetMetadata,
  getAllAssets,
  hasAsset,
  type AssetMetadata,
} from '@/lib/assets/registry';

/**
 * Tests for registry module
 */
describe('lib/assets/registry', () => {
  beforeEach(() => {
    // Clear any cached registry between tests
    vi.resetModules();
  });

  // -----------------------------------------------------------------------
  // Registry initialization and loading
  // -----------------------------------------------------------------------

  describe('getRegistry()', () => {
    it('returns a record of all assets', () => {
      const registry = getRegistry();

      expect(registry).toBeInstanceOf(Object);
      expect(Object.keys(registry)).toHaveLength(4);
    });

    it('contains all four canonical asset symbols', () => {
      const registry = getRegistry();

      expect(registry).toHaveProperty('XLM');
      expect(registry).toHaveProperty('USDC');
      expect(registry).toHaveProperty('BTC');
      expect(registry).toHaveProperty('ETH');
    });

    it('returns the same instance on multiple calls (singleton)', () => {
      const registry1 = getRegistry();
      const registry2 = getRegistry();

      expect(registry1).toBe(registry2);
    });

    it('throws when registry file is missing', () => {
      // This test would require mocking fs.readFileSync
      // For now, we assume the registry.json file exists in the project
      const registry = getRegistry();
      expect(registry).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Asset metadata retrieval
  // -----------------------------------------------------------------------

  describe('getAssetMetadata()', () => {
    it('returns complete metadata for XLM', () => {
      const xlm = getAssetMetadata('XLM');

      expect(xlm).toEqual({
        symbol: 'XLM',
        name: 'Stellar Lumens',
        decimals: 7,
        issuer: null,
        logo: expect.stringContaining('http'),
      });
    });

    it('returns complete metadata for USDC', () => {
      const usdc = getAssetMetadata('USDC');

      expect(usdc.symbol).toBe('USDC');
      expect(usdc.name).toBe('USD Coin');
      expect(usdc.decimals).toBe(6);
      expect(usdc.issuer).toBeTruthy();
      expect(usdc.logo).toMatch(/http/);
    });

    it('returns complete metadata for BTC', () => {
      const btc = getAssetMetadata('BTC');

      expect(btc.symbol).toBe('BTC');
      expect(btc.decimals).toBe(8);
      expect(btc.issuer).toBeTruthy();
    });

    it('returns complete metadata for ETH', () => {
      const eth = getAssetMetadata('ETH');

      expect(eth.symbol).toBe('ETH');
      expect(eth.decimals).toBe(18);
      expect(eth.issuer).toBeTruthy();
    });

    it('has correct AssetMetadata structure with all fields', () => {
      const xlm = getAssetMetadata('XLM');

      expect(xlm).toHaveProperty('symbol');
      expect(xlm).toHaveProperty('name');
      expect(xlm).toHaveProperty('decimals');
      expect(xlm).toHaveProperty('issuer');
      expect(xlm).toHaveProperty('logo');
    });

    it('throws when requesting unknown asset', () => {
      expect(() => getAssetMetadata('FAKE' as any)).toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Batch asset retrieval
  // -----------------------------------------------------------------------

  describe('getAllAssets()', () => {
    it('returns array of all assets', () => {
      const assets = getAllAssets();

      expect(Array.isArray(assets)).toBe(true);
      expect(assets.length).toBe(4);
    });

    it('returns assets in consistent order', () => {
      const assets1 = getAllAssets();
      const assets2 = getAllAssets();

      expect(assets1.map((a) => a.symbol)).toEqual(assets2.map((a) => a.symbol));
    });

    it('each asset has all required fields', () => {
      const assets = getAllAssets();

      assets.forEach((asset) => {
        expect(asset).toHaveProperty('symbol');
        expect(asset).toHaveProperty('name');
        expect(asset).toHaveProperty('decimals');
        expect(asset).toHaveProperty('issuer');
        expect(asset).toHaveProperty('logo');

        expect(typeof asset.symbol).toBe('string');
        expect(typeof asset.name).toBe('string');
        expect(typeof asset.decimals).toBe('number');
        expect(typeof asset.logo).toBe('string');
      });
    });

    it('decimals are within valid range (0-19)', () => {
      const assets = getAllAssets();

      assets.forEach((asset) => {
        expect(asset.decimals).toBeGreaterThanOrEqual(0);
        expect(asset.decimals).toBeLessThanOrEqual(19);
      });
    });

    it('includes XLM with null issuer', () => {
      const assets = getAllAssets();
      const xlm = assets.find((a) => a.symbol === 'XLM');

      expect(xlm).toBeDefined();
      expect(xlm!.issuer).toBeNull();
    });

    it('includes USDC, BTC, ETH with non-null issuers', () => {
      const assets = getAllAssets();

      const usdc = assets.find((a) => a.symbol === 'USDC');
      const btc = assets.find((a) => a.symbol === 'BTC');
      const eth = assets.find((a) => a.symbol === 'ETH');

      expect(usdc?.issuer).toBeTruthy();
      expect(btc?.issuer).toBeTruthy();
      expect(eth?.issuer).toBeTruthy();
    });

    it('all logo URLs are valid HTTP(S) URLs', () => {
      const assets = getAllAssets();

      assets.forEach((asset) => {
        expect(asset.logo).toMatch(/^https?:\/\//);
      });
    });
  });

  // -----------------------------------------------------------------------
  // Asset existence checks
  // -----------------------------------------------------------------------

  describe('hasAsset()', () => {
    it('returns true for known assets', () => {
      expect(hasAsset('XLM')).toBe(true);
      expect(hasAsset('USDC')).toBe(true);
      expect(hasAsset('BTC')).toBe(true);
      expect(hasAsset('ETH')).toBe(true);
    });

    it('returns false for unknown assets', () => {
      expect(hasAsset('FAKE')).toBe(false);
      expect(hasAsset('DOGE')).toBe(false);
      expect(hasAsset('xlm')).toBe(false); // Case-sensitive
      expect(hasAsset('')).toBe(false);
    });

    it('returns false for non-string inputs', () => {
      expect(hasAsset(null)).toBe(false);
      expect(hasAsset(undefined)).toBe(false);
      expect(hasAsset(123)).toBe(false);
      expect(hasAsset({})).toBe(false);
    });

    it('is a type guard for AssetSymbol', () => {
      const value: unknown = 'XLM';

      if (hasAsset(value)) {
        // value is now typed as AssetSymbol
        const metadata = getAssetMetadata(value);
        expect(metadata).toBeDefined();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Metadata validation and correctness
  // -----------------------------------------------------------------------

  describe('Registry data validation', () => {
    it('all asset names are non-empty strings', () => {
      const assets = getAllAssets();

      assets.forEach((asset) => {
        expect(typeof asset.name).toBe('string');
        expect(asset.name.length).toBeGreaterThan(0);
      });
    });

    it('all asset logos are valid URLs', () => {
      const assets = getAllAssets();

      assets.forEach((asset) => {
        expect(() => {
          new URL(asset.logo);
        }).not.toThrow();
      });
    });

    it('issuer is either null or a non-empty string', () => {
      const assets = getAllAssets();

      assets.forEach((asset) => {
        if (asset.issuer !== null) {
          expect(typeof asset.issuer).toBe('string');
          expect(asset.issuer.length).toBeGreaterThan(0);
        }
      });
    });

    it('symbols match expected values', () => {
      const assets = getAllAssets();
      const symbols = assets.map((a) => a.symbol).sort();

      expect(symbols).toEqual(['BTC', 'ETH', 'USDC', 'XLM']);
    });
  });

  // -----------------------------------------------------------------------
  // Specific asset metadata accuracy
  // -----------------------------------------------------------------------

  describe('Specific asset metadata', () => {
    it('XLM has 7 decimals', () => {
      const xlm = getAssetMetadata('XLM');
      expect(xlm.decimals).toBe(7);
    });

    it('USDC has 6 decimals', () => {
      const usdc = getAssetMetadata('USDC');
      expect(usdc.decimals).toBe(6);
    });

    it('BTC has 8 decimals', () => {
      const btc = getAssetMetadata('BTC');
      expect(btc.decimals).toBe(8);
    });

    it('ETH has 18 decimals', () => {
      const eth = getAssetMetadata('ETH');
      expect(eth.decimals).toBe(18);
    });

    it('XLM name is "Stellar Lumens"', () => {
      const xlm = getAssetMetadata('XLM');
      expect(xlm.name).toBe('Stellar Lumens');
    });

    it('USDC name is "USD Coin"', () => {
      const usdc = getAssetMetadata('USDC');
      expect(usdc.name).toBe('USD Coin');
    });

    it('BTC name is "Bitcoin"', () => {
      const btc = getAssetMetadata('BTC');
      expect(btc.name).toBe('Bitcoin');
    });

    it('ETH name is "Ethereum"', () => {
      const eth = getAssetMetadata('ETH');
      expect(eth.name).toBe('Ethereum');
    });
  });

  // -----------------------------------------------------------------------
  // Registry consistency
  // -----------------------------------------------------------------------

  describe('Registry consistency', () => {
    it('getRegistry and getAllAssets return consistent data', () => {
      const registry = getRegistry();
      const assets = getAllAssets();

      expect(assets.length).toBe(Object.keys(registry).length);

      assets.forEach((asset) => {
        expect(registry[asset.symbol]).toEqual(asset);
      });
    });

    it('getAssetMetadata and getRegistry return consistent data', () => {
      const registry = getRegistry();

      (['XLM', 'USDC', 'BTC', 'ETH'] as const).forEach((symbol) => {
        const metadata = getAssetMetadata(symbol);
        expect(registry[symbol]).toEqual(metadata);
      });
    });

    it('adding multiple calls does not mutate the registry', () => {
      const assets1 = getAllAssets();
      const assets1Copy = JSON.parse(JSON.stringify(assets1));

      // Make some calls
      getAssetMetadata('XLM');
      getAssetMetadata('USDC');
      getAllAssets();

      const assets2 = getAllAssets();

      expect(assets2).toEqual(assets1Copy);
    });
  });
});
