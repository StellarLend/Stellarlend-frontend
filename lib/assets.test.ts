import { describe, it, expect } from 'vitest';
import { ASSETS } from './assets';
import { getAsset } from './assets/registry';

describe('Assets Configuration', () => {
  it('should have precision values that match registry decimals for all assets', () => {
    ASSETS.forEach(asset => {
      const registryAsset = getAsset(asset.symbol);
      expect(registryAsset).toBeDefined();
      if (registryAsset) {
        expect(asset.precision).toBe(registryAsset.decimals);
      }
    });
  });
});
