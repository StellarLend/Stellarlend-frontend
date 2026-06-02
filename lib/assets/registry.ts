import { z } from 'zod';
import registryData from './registry.json';

// Schema for asset metadata validation
const AssetMetadataSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  decimals: z.number().int().min(0).max(19),
  issuer: z.string().min(1),
  logoUrl: z.string().url(),
});

const RegistrySchema = z.object({
  assets: z.array(AssetMetadataSchema),
});

export type AssetMetadata = z.infer<typeof AssetMetadataSchema>;
export type Registry = z.infer<typeof RegistrySchema>;

// Global registry instance
let registryInstance: Registry | null = null;
let registryError: Error | null = null;

/**
 * Load and validate the asset registry at initialization
 * This is called once at boot time to ensure the registry is valid
 */
function initializeRegistry(): void {
  if (registryInstance !== null || registryError !== null) {
    return; // Already initialized
  }

  try {
    // Load and validate the registry JSON
    const rawRegistry = registryData;
    
    // Validate against schema
    const validated = RegistrySchema.parse(rawRegistry);
    registryInstance = validated;
  } catch (error) {
    registryError = error instanceof Error 
      ? error 
      : new Error(`Failed to load asset registry: ${String(error)}`);
    
    // Log error but don't throw during initialization
    console.error('[AssetRegistry] Initialization error:', registryError.message);
  }
}

/**
 * Get the complete asset registry
 * @throws Error if registry failed to load or is invalid
 */
export function getRegistry(): Registry {
  initializeRegistry();
  
  if (registryError) {
    throw registryError;
  }
  
  if (!registryInstance) {
    throw new Error('Asset registry failed to initialize');
  }
  
  return registryInstance;
}

/**
 * Get a specific asset by symbol
 * @param symbol - The asset symbol (e.g., 'XLM', 'USDC')
 * @returns The asset metadata, or null if not found
 */
export function getAsset(symbol: string): AssetMetadata | null {
  const registry = getRegistry();
  return registry.assets.find(asset => asset.symbol === symbol) || null;
}

/**
 * Get all asset symbols
 */
export function getAssetSymbols(): string[] {
  const registry = getRegistry();
  return registry.assets.map(asset => asset.symbol);
}

/**
 * Check if a symbol is a valid asset
 */
export function isValidAsset(symbol: string): boolean {
  const registry = getRegistry();
  return registry.assets.some(asset => asset.symbol === symbol);
}

/**
 * Get assets by filter (for API responses)
 * @param symbols - Optional list of symbols to filter by
 * @returns Filtered assets
 */
export function getAssets(symbols?: string[]): AssetMetadata[] {
  const registry = getRegistry();
  
  if (!symbols || symbols.length === 0) {
    return registry.assets;
  }
  
  return registry.assets.filter(asset => symbols.includes(asset.symbol));
}

// Initialize on module load
initializeRegistry();
