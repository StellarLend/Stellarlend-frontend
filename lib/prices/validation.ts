/**
 * Price Oracle Validation Utilities
 * Validates and sanitizes asset query parameters
 */

import { SUPPORTED_ASSETS, MAX_ASSETS_IN_QUERY } from './constants';
import type { ValidationResult, SupportedAsset } from './types';

/**
 * Validates and normalizes the assets query parameter
 * 
 * @param assetsParam - Raw query parameter value (e.g., "XLM,USDC,BTC")
 * @returns ValidationResult with normalized assets list and any validation errors
 * 
 * @example
 * const result = validateAssetsQuery("xlm,usdc,invalid");
 * // { valid: false, assets: ['XLM', 'USDC'], errors: ['Invalid asset: INVALID'] }
 */
export function validateAssetsQuery(assetsParam: string | null | undefined): ValidationResult {
  const errors: string[] = [];
  const assets: SupportedAsset[] = [];

  // If no assets specified, return all supported assets
  if (!assetsParam || assetsParam.trim() === '') {
    return {
      valid: true,
      assets: [...SUPPORTED_ASSETS],
      errors: [],
    };
  }

  // Split and clean the assets list
  const rawAssets = assetsParam
    .split(',')
    .map((asset) => asset.trim().toUpperCase())
    .filter(Boolean);

  // Check for too many assets in query
  if (rawAssets.length > MAX_ASSETS_IN_QUERY) {
    errors.push(`Too many assets requested. Maximum is ${MAX_ASSETS_IN_QUERY}.`);
    return { valid: false, assets: [], errors };
  }

  // Validate each asset
  const seenAssets = new Set<string>();
  for (const asset of rawAssets) {
    // Check for duplicates
    if (seenAssets.has(asset)) {
      errors.push(`Duplicate asset: ${asset}`);
      continue;
    }

    seenAssets.add(asset);

    // Check if asset is supported
    if (!SUPPORTED_ASSETS.includes(asset as SupportedAsset)) {
      errors.push(`Unsupported asset: ${asset}. Supported assets: ${SUPPORTED_ASSETS.join(', ')}`);
      continue;
    }

    assets.push(asset as SupportedAsset);
  }

  return {
    valid: errors.length === 0,
    assets,
    errors,
  };
}

/**
 * Generates a cache key from an assets list
 * Keys are normalized to ensure consistent caching regardless of parameter order
 * 
 * @param assets - Array of asset symbols
 * @returns Normalized cache key
 */
export function generateCacheKey(assets: SupportedAsset[]): string {
  // Sort assets to ensure consistent key regardless of input order
  const sortedAssets = [...assets].sort().join(',');
  return `prices:${sortedAssets || 'all'}`;
}

/**
 * Validates that an API key is not exposed in a response
 * This is a safeguard to prevent accidental key leakage
 * 
 * @param data - Object to validate
 * @returns true if no API keys found in data
 */
export function hasNoApiKeys(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) {
    return true;
  }

  const jsonString = JSON.stringify(data).toLowerCase();
  const sensitiveKeywords = ['api_key', 'apikey', 'secret', 'token', 'password', 'auth'];

  return !sensitiveKeywords.some((keyword) => jsonString.includes(keyword));
}
