import { type AssetSymbol, ASSET_SYMBOLS, isAssetSymbol } from '@/types/enums';
import registryData from './registry.json';

/**
 * Asset metadata from the canonical registry.
 * Each asset includes decimals, Stellar issuer account, and logo URL.
 */
export interface AssetMetadata {
  symbol: AssetSymbol;
  name: string;
  decimals: number;
  stellarIssuer: string;
  logoUrl: string;
  description: string;
}

export interface AssetRegistry {
  assets: Record<AssetSymbol, AssetMetadata>;
  version: string;
  lastUpdated: string;
}

/**
 * Load and validate the canonical asset registry.
 * Runs at server boot to ensure data integrity.
 */
function loadRegistry(): AssetRegistry {
  const validated = validateRegistry(registryData);
  if (!validated.valid) {
    throw new Error(`Asset registry validation failed: ${validated.errors.join('; ')}`);
  }

  // Build a keyed map for efficient lookups
  const assetMap: Record<AssetSymbol, AssetMetadata> = {};
  for (const asset of validated.assets) {
    assetMap[asset.symbol] = asset;
  }

  return {
    assets: assetMap,
    version: registryData.version || '1.0.0',
    lastUpdated: registryData.lastUpdated || new Date().toISOString(),
  };
}

/**
 * Validates registry JSON structure and content.
 */
function validateRegistry(data: unknown): { valid: boolean; assets?: AssetMetadata[]; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Registry must be a JSON object');
    return { valid: false, errors };
  }

  const registry = data as Record<string, unknown>;

  if (!Array.isArray(registry.assets)) {
    errors.push('Registry.assets must be an array');
    return { valid: false, errors };
  }

  const assets: AssetMetadata[] = [];
  const seenSymbols = new Set<string>();

  for (let i = 0; i < registry.assets.length; i++) {
    const asset = registry.assets[i];

    if (!asset || typeof asset !== 'object') {
      errors.push(`Asset[${i}] must be an object`);
      continue;
    }

    const assetObj = asset as Record<string, unknown>;

    // Validate symbol
    if (!assetObj.symbol || typeof assetObj.symbol !== 'string') {
      errors.push(`Asset[${i}].symbol is required and must be a string`);
      continue;
    }

    if (!isAssetSymbol(assetObj.symbol)) {
      errors.push(`Asset[${i}].symbol "${assetObj.symbol}" is not a valid AssetSymbol. Supported: ${ASSET_SYMBOLS.join(', ')}`);
      continue;
    }

    if (seenSymbols.has(assetObj.symbol)) {
      errors.push(`Asset[${i}].symbol "${assetObj.symbol}" is duplicated`);
      continue;
    }
    seenSymbols.add(assetObj.symbol);

    // Validate name
    if (!assetObj.name || typeof assetObj.name !== 'string') {
      errors.push(`Asset[${i}].name is required and must be a string`);
      continue;
    }

    // Validate decimals
    if (typeof assetObj.decimals !== 'number' || assetObj.decimals < 0 || assetObj.decimals > 19) {
      errors.push(`Asset[${i}].decimals must be a number between 0 and 19`);
      continue;
    }

    // Validate stellarIssuer
    if (!assetObj.stellarIssuer || typeof assetObj.stellarIssuer !== 'string') {
      errors.push(`Asset[${i}].stellarIssuer is required and must be a string`);
      continue;
    }

    // Validate logoUrl
    if (!assetObj.logoUrl || typeof assetObj.logoUrl !== 'string') {
      errors.push(`Asset[${i}].logoUrl is required and must be a string`);
      continue;
    }

    try {
      new URL(assetObj.logoUrl);
    } catch {
      errors.push(`Asset[${i}].logoUrl "${assetObj.logoUrl}" is not a valid URL`);
      continue;
    }

    // Validate description
    if (!assetObj.description || typeof assetObj.description !== 'string') {
      errors.push(`Asset[${i}].description is required and must be a string`);
      continue;
    }

    assets.push({
      symbol: assetObj.symbol as AssetSymbol,
      name: assetObj.name as string,
      decimals: assetObj.decimals as number,
      stellarIssuer: assetObj.stellarIssuer as string,
      logoUrl: assetObj.logoUrl as string,
      description: assetObj.description as string,
    });
  }

  // Verify all supported assets are in the registry
  for (const symbol of ASSET_SYMBOLS) {
    if (!seenSymbols.has(symbol)) {
      errors.push(`Missing required asset: ${symbol}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, assets };
}

// Load registry at module initialization
let _registry: AssetRegistry | null = null;

/**
 * Get the canonical asset registry.
 * Safe to call multiple times; returns cached instance after first load.
 */
export function getAssetRegistry(): AssetRegistry {
  if (!_registry) {
    _registry = loadRegistry();
  }
  return _registry;
}

/**
 * Get metadata for a specific asset.
 */
export function getAssetMetadata(symbol: AssetSymbol): AssetMetadata | null {
  const registry = getAssetRegistry();
  return registry.assets[symbol] || null;
}

/**
 * Get all supported assets from the registry.
 */
export function getAllAssets(): AssetMetadata[] {
  const registry = getAssetRegistry();
  return ASSET_SYMBOLS.map((symbol) => registry.assets[symbol]);
}

/**
 * Export registry validation for testing.
 */
export { validateRegistry };
