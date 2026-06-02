/**
 * Asset Registry Module
 * 
 * Provides centralized management of canonical asset metadata (symbols, names, decimals, issuers, logos).
 * Registry is loaded and validated at module initialization time (boot).
 * 
 * @module lib/assets/registry
 */

import { isAssetSymbol } from '@/types/enums';
import type { AssetSymbol } from '@/types/enums';
import fs from 'fs';
import path from 'path';

/**
 * Asset metadata as defined in the registry.
 */
export interface AssetMetadata {
  /** Asset symbol (XLM, USDC, BTC, ETH) */
  symbol: AssetSymbol;
  /** Human-readable asset name */
  name: string;
  /** Number of decimal places */
  decimals: number;
  /** Stellar issuer account ID, or null for native XLM */
  issuer: string | null;
  /** URL to asset logo image */
  logo: string;
}

/**
 * Registry file structure
 */
interface RegistryFile {
  version: string;
  assets: Record<string, Omit<AssetMetadata, 'symbol'>>;
}

/**
 * Loads and validates the asset registry from JSON file.
 * Throws if validation fails.
 */
function loadRegistry(): Record<AssetSymbol, AssetMetadata> {
  const registryPath = path.join(
    process.cwd(),
    'lib',
    'assets',
    'registry.json'
  );

  let registryData: RegistryFile;

  try {
    const rawContent = fs.readFileSync(registryPath, 'utf-8');
    registryData = JSON.parse(rawContent);
  } catch (error) {
    throw new Error(
      `Failed to load asset registry from ${registryPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Validate structure
  if (!registryData.assets || typeof registryData.assets !== 'object') {
    throw new Error('Asset registry must have an "assets" property');
  }

  const registry: Record<string, AssetMetadata> = {};

  for (const [symbol, metadata] of Object.entries(registryData.assets)) {
    // Validate symbol is a known asset
    if (!isAssetSymbol(symbol)) {
      throw new Error(
        `Unknown asset symbol in registry: ${symbol}. Valid symbols: XLM, USDC, BTC, ETH`
      );
    }

    // Validate required fields
    if (!metadata.name || typeof metadata.name !== 'string') {
      throw new Error(`Asset ${symbol}: missing or invalid "name"`);
    }

    if (
      typeof metadata.decimals !== 'number' ||
      metadata.decimals < 0 ||
      metadata.decimals > 19
    ) {
      throw new Error(
        `Asset ${symbol}: "decimals" must be a number between 0 and 19`
      );
    }

    if (
      metadata.issuer !== null &&
      (typeof metadata.issuer !== 'string' || metadata.issuer.length === 0)
    ) {
      throw new Error(
        `Asset ${symbol}: "issuer" must be null or a non-empty string`
      );
    }

    if (!metadata.logo || typeof metadata.logo !== 'string') {
      throw new Error(`Asset ${symbol}: missing or invalid "logo"`);
    }

    registry[symbol] = {
      symbol: symbol as AssetSymbol,
      name: metadata.name,
      decimals: metadata.decimals,
      issuer: metadata.issuer,
      logo: metadata.logo,
    };
  }

  // Verify all known assets are present
  const knownAssets: AssetSymbol[] = ['XLM', 'USDC', 'BTC', 'ETH'];
  for (const asset of knownAssets) {
    if (!registry[asset]) {
      throw new Error(`Asset registry is missing required asset: ${asset}`);
    }
  }

  return registry as Record<AssetSymbol, AssetMetadata>;
}

/** Singleton registry instance, loaded at boot */
let registryInstance: Record<AssetSymbol, AssetMetadata> | null = null;
let loadError: Error | null = null;

/**
 * Gets the initialized asset registry.
 * 
 * @returns The asset registry
 * @throws If registry failed to load during initialization
 */
export function getRegistry(): Record<AssetSymbol, AssetMetadata> {
  // Lazy initialization on first access
  if (registryInstance === null) {
    if (loadError) {
      throw loadError;
    }

    try {
      registryInstance = loadRegistry();
    } catch (error) {
      loadError = error instanceof Error ? error : new Error(String(error));
      throw loadError;
    }
  }

  return registryInstance;
}

/**
 * Gets metadata for a specific asset.
 * 
 * @param symbol - Asset symbol
 * @returns Asset metadata
 * @throws If registry failed to load or asset not found
 */
export function getAssetMetadata(symbol: AssetSymbol): AssetMetadata {
  const registry = getRegistry();
  const metadata = registry[symbol];

  if (!metadata) {
    throw new Error(`Asset not found in registry: ${symbol}`);
  }

  return metadata;
}

/**
 * Gets all assets from the registry as an array.
 * 
 * @returns Array of asset metadata
 * @throws If registry failed to load
 */
export function getAllAssets(): AssetMetadata[] {
  const registry = getRegistry();
  return Object.values(registry);
}

/**
 * Checks if an asset exists in the registry.
 * 
 * @param symbol - Asset symbol
 * @returns true if asset exists, false otherwise
 */
export function hasAsset(symbol: unknown): symbol is AssetSymbol {
  try {
    if (!isAssetSymbol(symbol)) {
      return false;
    }
    const registry = getRegistry();
    return symbol in registry;
  } catch {
    return false;
  }
}
