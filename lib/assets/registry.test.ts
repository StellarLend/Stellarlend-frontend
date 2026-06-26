import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAssetRegistry, getAssetMetadata, getAllAssets, validateRegistry } from '@/lib/assets';
import { ASSET_SYMBOLS, type AssetSymbol } from '@/types/enums';

describe('Asset Registry', () => {
  describe('validateRegistry', () => {
    it('should validate a correct registry', () => {
      const validRegistry = {
        assets: [
          {
            symbol: 'XLM',
            name: 'Stellar Lumens',
            decimals: 7,
            stellarIssuer: 'native',
            logoUrl: 'https://example.com/xlm.png',
            description: 'The native asset',
          },
          {
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            stellarIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4SHABUQWERA7EBQWFQ6E3EMI5HCTV3P',
            logoUrl: 'https://example.com/usdc.png',
            description: 'USD Coin',
          },
          {
            symbol: 'BTC',
            name: 'Bitcoin',
            decimals: 8,
            stellarIssuer: 'GATEMHCCKCY67ZUCKTROYN24ZYT5GK4EQZ65JJLDHKHRUZI3EUEKMTCH',
            logoUrl: 'https://example.com/btc.png',
            description: 'Bitcoin',
          },
          {
            symbol: 'ETH',
            name: 'Ethereum',
            decimals: 18,
            stellarIssuer: 'GBBD47UZQ5Dtjvuo6SNVYATZT5TMSFYRT3UOIWVVVW7GDEHFX2PZGZD2',
            logoUrl: 'https://example.com/eth.png',
            description: 'Ethereum',
          },
        ],
      };

      const result = validateRegistry(validRegistry);
      expect(result.valid).toBe(true);
      expect(result.assets).toHaveLength(4);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing assets array', () => {
      const invalid = {};
      const result = validateRegistry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Registry.assets must be an array');
    });

    it('should reject non-object registry', () => {
      const result = validateRegistry('not an object');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Registry must be a JSON object');
    });

    it('should reject invalid asset symbol', () => {
      const invalid = {
        assets: [
          {
            symbol: 'INVALID',
            name: 'Invalid Asset',
            decimals: 8,
            stellarIssuer: 'test',
            logoUrl: 'https://example.com/test.png',
            description: 'Invalid',
          },
        ],
      };

      const result = validateRegistry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('not a valid AssetSymbol'))).toBe(true);
    });

    it('should reject invalid decimals', () => {
      const invalid = {
        assets: [
          {
            symbol: 'XLM',
            name: 'Stellar Lumens',
            decimals: 25, // out of range
            stellarIssuer: 'native',
            logoUrl: 'https://example.com/xlm.png',
            description: 'Invalid decimals',
          },
        ],
      };

      const result = validateRegistry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('between 0 and 19'))).toBe(true);
    });

    it('should reject invalid URL', () => {
      const invalid = {
        assets: [
          {
            symbol: 'XLM',
            name: 'Stellar Lumens',
            decimals: 7,
            stellarIssuer: 'native',
            logoUrl: 'not-a-url',
            description: 'Invalid URL',
          },
        ],
      };

      const result = validateRegistry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('not a valid URL'))).toBe(true);
    });

    it('should reject duplicate symbols', () => {
      const invalid = {
        assets: [
          {
            symbol: 'XLM',
            name: 'Stellar Lumens',
            decimals: 7,
            stellarIssuer: 'native',
            logoUrl: 'https://example.com/xlm.png',
            description: 'First',
          },
          {
            symbol: 'XLM',
            name: 'Another XLM',
            decimals: 7,
            stellarIssuer: 'native',
            logoUrl: 'https://example.com/xlm2.png',
            description: 'Duplicate',
          },
        ],
      };

      const result = validateRegistry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('duplicated'))).toBe(true);
    });

    it('should reject missing required assets', () => {
      const invalid = {
        assets: [
          {
            symbol: 'XLM',
            name: 'Stellar Lumens',
            decimals: 7,
            stellarIssuer: 'native',
            logoUrl: 'https://example.com/xlm.png',
            description: 'Only XLM',
          },
        ],
      };

      const result = validateRegistry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Missing required asset'))).toBe(true);
    });

    it('should reject missing required fields', () => {
      const invalid = {
        assets: [
          {
            symbol: 'XLM',
            // missing name, decimals, etc.
          },
        ],
      };

      const result = validateRegistry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getAssetRegistry', () => {
    it('should load and cache the registry', () => {
      const registry1 = getAssetRegistry();
      const registry2 = getAssetRegistry();

      expect(registry1).toBe(registry2); // Same instance (cached)
      expect(registry1.assets).toBeDefined();
      expect(Object.keys(registry1.assets)).toEqual(ASSET_SYMBOLS);
    });

    it('should have all supported assets', () => {
      const registry = getAssetRegistry();
      for (const symbol of ASSET_SYMBOLS) {
        expect(registry.assets[symbol]).toBeDefined();
      }
    });

    it('should have correct metadata for each asset', () => {
      const registry = getAssetRegistry();

      const xlm = registry.assets['XLM'];
      expect(xlm.symbol).toBe('XLM');
      expect(xlm.name).toBe('Stellar Lumens');
      expect(xlm.decimals).toBe(7);
      expect(xlm.stellarIssuer).toBe('native');
      expect(xlm.logoUrl).toBeDefined();
      expect(xlm.description).toBeDefined();

      const usdc = registry.assets['USDC'];
      expect(usdc.symbol).toBe('USDC');
      expect(usdc.decimals).toBe(6);
      expect(usdc.stellarIssuer).toMatch(/^G[A-Z0-9]{55}$/); // Stellar public key format

      const btc = registry.assets['BTC'];
      expect(btc.decimals).toBe(8);

      const eth = registry.assets['ETH'];
      expect(eth.decimals).toBe(18);
    });
  });

  describe('getAssetMetadata', () => {
    it('should retrieve metadata by symbol', () => {
      const xlm = getAssetMetadata('XLM');
      expect(xlm).toBeDefined();
      expect(xlm?.symbol).toBe('XLM');
      expect(xlm?.name).toBe('Stellar Lumens');
    });

    it('should return all valid asset metadata', () => {
      for (const symbol of ASSET_SYMBOLS) {
        const metadata = getAssetMetadata(symbol);
        expect(metadata).toBeDefined();
        expect(metadata?.symbol).toBe(symbol);
      }
    });
  });

  describe('getAllAssets', () => {
    it('should return all assets in order', () => {
      const assets = getAllAssets();
      expect(assets).toHaveLength(ASSET_SYMBOLS.length);

      const symbols = assets.map((a) => a.symbol);
      expect(symbols).toContain('XLM');
      expect(symbols).toContain('USDC');
      expect(symbols).toContain('BTC');
      expect(symbols).toContain('ETH');
    });

    it('should maintain asset order matching ASSET_SYMBOLS', () => {
      const assets = getAllAssets();
      const expectedOrder = ASSET_SYMBOLS.map((s) => s);
      const actualOrder = assets.map((a) => a.symbol);
      expect(actualOrder).toEqual(expectedOrder);
    });
  });
});
