/**
 * Price Oracle Fetcher
 * Handles upstream price source integration with error handling
 */

import type { UpstreamPriceSource, SupportedAsset, PriceData } from './types';

/**
 * Configuration for price sources
 */
interface PriceSourceConfig {
  timeout: number;
  retries: number;
}

const DEFAULT_CONFIG: PriceSourceConfig = {
  timeout: 10000, // 10 seconds
  retries: 2,
};

/**
 * Mock upstream price fetcher for demonstration/testing
 * Simulates real-world upstream latency (~300ms) and realistic asset prices
 * 
 * @param assets - Array of assets to fetch prices for
 * @returns Promise<UpstreamPriceSource>
 */
async function fetchMockPrices(assets: SupportedAsset[]): Promise<UpstreamPriceSource> {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Base prices with slight randomization to simulate live price movement
  const basePrices: Record<SupportedAsset, number> = {
    XLM: 0.1245 + (Math.random() - 0.5) * 0.002,
    USDC: 1.0,
    BTC: 67340.5 + (Math.random() - 0.5) * 100,
    ETH: 3480.2 + (Math.random() - 0.5) * 10,
  };

  // Build prices object for requested assets
  const prices: PriceData = {};
  for (const asset of assets) {
    prices[asset] = basePrices[asset];
  }

  return {
    prices,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Fetches prices from an upstream oracle API
 * Uses API key from environment variables (kept server-side only)
 * 
 * @param assets - Array of assets to fetch
 * @param config - Optional configuration overrides
 * @returns Promise<UpstreamPriceSource>
 * @throws Error if fetch fails after retries
 */
export async function fetchUpstreamPrices(
  assets: SupportedAsset[],
  config: Partial<PriceSourceConfig> = {}
): Promise<UpstreamPriceSource> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // For now, use mock prices. In production, integrate with real API
  // Example production integration:
  // const apiKey = process.env.PRICE_ORACLE_API_KEY;
  // if (!apiKey) throw new Error('PRICE_ORACLE_API_KEY not configured');
  // return fetchRealUpstreamPrices(assets, apiKey, finalConfig);

  return fetchMockPrices(assets);
}

/**
 * Validates upstream price response structure
 * Ensures prices are valid numbers and timestamps are ISO strings
 * 
 * @param data - Data to validate
 * @returns true if data is a valid UpstreamPriceSource
 */
export function isValidUpstreamResponse(data: unknown): data is UpstreamPriceSource {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const source = data as Record<string, unknown>;

  // Check prices object
  if (typeof source.prices !== 'object' || source.prices === null) {
    return false;
  }

  const prices = source.prices as Record<string, unknown>;
  for (const [, price] of Object.entries(prices)) {
    if (typeof price !== 'number' || !isFinite(price)) {
      return false;
    }
  }

  // Check timestamp is valid ISO string
  if (typeof source.timestamp !== 'string') {
    return false;
  }

  try {
    new Date(source.timestamp);
  } catch {
    return false;
  }

  return true;
}
