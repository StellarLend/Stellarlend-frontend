import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ASSET_SYMBOLS, isAssetSymbol } from '@/types/enums';

/**
 * GrantFox #951 — seed/mock transaction assets must stay on the canonical
 * ASSET_SYMBOLS vocabulary (STRK removed; use USDC/ETH instead).
 */

const REPO_ROOT = resolve(__dirname, '..', '..');

function extractMockAssetLiterals(source: string): string[] {
  // Matches asset: 'FOO' / asset: "FOO" inside mock seed arrays.
  const re = /asset:\s*['"]([A-Z0-9]+)['"]/g;
  const assets: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    assets.push(m[1]);
  }
  return assets;
}

describe('mock transaction assets use canonical ASSET_SYMBOLS only', () => {
  it('lib/transactions/repository.ts MOCK_TRANSACTIONS has no STRK / only ASSET_SYMBOLS', () => {
    const src = readFileSync(resolve(REPO_ROOT, 'lib/transactions/repository.ts'), 'utf8');
    const assets = extractMockAssetLiterals(src);
    expect(assets.length).toBeGreaterThan(0);
    expect(assets).not.toContain('STRK');
    for (const asset of assets) {
      expect(isAssetSymbol(asset), `invalid mock asset "${asset}"`).toBe(true);
    }
  });

  it('lib/transactions/store.ts MOCK_TRANSACTIONS has no STRK / only ASSET_SYMBOLS', () => {
    const src = readFileSync(resolve(REPO_ROOT, 'lib/transactions/store.ts'), 'utf8');
    const assets = extractMockAssetLiterals(src);
    expect(assets.length).toBeGreaterThan(0);
    expect(assets).not.toContain('STRK');
    for (const asset of assets) {
      expect(
        ASSET_SYMBOLS.includes(asset as (typeof ASSET_SYMBOLS)[number]),
        `invalid mock asset "${asset}"`,
      ).toBe(true);
    }
  });
});
