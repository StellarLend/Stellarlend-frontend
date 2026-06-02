import { z } from "zod";

export const priceQuerySchema = z.object({
  asset: z
    .string()
    .min(1, "Asset is required")
    .max(64, "Asset must be 64 characters or less"),
  currency: z
    .string()
    .min(1, "Currency is required")
    .max(10, "Currency must be 10 characters or less")
    .default("USD"),
  timestamp: z.coerce
    .number()
    .int()
    .positive("Timestamp must be a positive integer")
    .optional(),
});

export const priceBatchQuerySchema = z.object({
  assets: z
    .array(z.string().min(1).max(64))
    .min(1)
    .max(100, "Maximum 100 assets per request"),
  currency: z.string().min(1).max(10).default("USD"),
});

export const priceResponseSchema = z.object({
  asset: z.string(),
  currency: z.string(),
  price: z.coerce.number().positive(),
  timestamp: z.number(),
  source: z.string().optional(),
});

export type PriceQueryInput = z.infer<typeof priceQuerySchema>;
export type PriceBatchQueryInput = z.infer<typeof priceBatchQuerySchema>;
export type PriceResponse = z.infer<typeof priceResponseSchema>;
