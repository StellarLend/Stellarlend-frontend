/**
 * Validation schemas for asset registry API endpoints
 * 
 * @module lib/validation/schemas/assets
 */

import { z } from 'zod';

/**
 * Query schema for GET /api/assets
 * Supports filtering by symbol(s) or retrieving all assets
 */
export const assetsQuerySchema = z.object({
  /** Comma-separated list of symbols to retrieve, or empty to get all */
  symbols: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim() === '') {
        return undefined;
      }
      return val.split(',').map((s) => s.trim().toUpperCase());
    }),
});

/**
 * Response schema for a single asset
 */
export const assetResponseSchema = z.object({
  symbol: z.enum(['XLM', 'USDC', 'BTC', 'ETH']),
  name: z.string(),
  decimals: z.number().int().min(0).max(19),
  issuer: z.string().nullable(),
  logo: z.string().url(),
});

/**
 * Response schema for GET /api/assets
 * Returns array of assets
 */
export const assetsResponseSchema = z.object({
  assets: z.array(assetResponseSchema),
  cached: z.boolean().optional(),
});

export type AssetsQueryInput = z.infer<typeof assetsQuerySchema>;
export type AssetResponse = z.infer<typeof assetResponseSchema>;
export type AssetsResponse = z.infer<typeof assetsResponseSchema>;
