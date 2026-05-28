/**
 * Price Oracle API Types
 * Defines interfaces for price data, responses, and cache metadata.
 */

export type SupportedAsset = 'XLM' | 'USDC' | 'BTC' | 'ETH';

export interface PriceData {
  [asset: string]: number;
}

export interface PriceResponse {
  prices: PriceData;
  timestamp: string;
  source: string;
  cached?: boolean;
  cacheAge?: number;
}

export interface PriceErrorResponse {
  error: string;
  code: string;
  timestamp: string;
}

export interface UpstreamPriceSource {
  prices: PriceData;
  timestamp: string;
}

export interface CacheStatus {
  value: PriceResponse;
  status: 'HIT' | 'STALE' | 'MISS';
}

/**
 * Validation result for asset queries
 */
export interface ValidationResult {
  valid: boolean;
  assets: SupportedAsset[];
  errors: string[];
}
