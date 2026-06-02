import { z } from 'zod';

const appEnv = process.env.NEXT_PUBLIC_APP_ENV;
const isProd = appEnv === 'production';

// Define the schema for required environment variables.
// In production, we require explicit values. In development/staging, we allow defaults.
export const envSchema = z.object({
  NEXT_PUBLIC_APP_NAME: isProd
    ? z.string().min(1, { message: 'APP_NAME is required' })
    : z.string().min(1).default('Stellarlend'),
  NEXT_PUBLIC_APP_VERSION: isProd
    ? z.string().min(1, { message: 'APP_VERSION is required' })
    : z.string().min(1).default('1.0.0'),
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production'], { required_error: 'APP_ENV is required' }),
  NEXT_PUBLIC_API_BASE_URL: isProd
    ? z.string().url({ message: 'API_BASE_URL must be a valid URL' })
    : z.string().url().default('http://localhost:3001'),
  NEXT_PUBLIC_STELLAR_NETWORK: isProd
    ? z.string().min(1, { message: 'STELLAR_NETWORK is required' })
    : z.string().min(1).default('testnet'),
  NEXT_PUBLIC_STELLAR_HORIZON_URL: isProd
    ? z.string().url({ message: 'STELLAR_HORIZON_URL must be a valid URL' })
    : z.string().url().default('https://horizon-testnet.stellar.org'),
  // API rate limit settings (server-only)
  API_RATE_LIMIT_MAX: z.preprocess(
    (value) => Number(value),
    z.number().int().positive().default(100),
  ),
  API_RATE_LIMIT_WINDOW_MS: z.preprocess(
    (value) => Number(value),
    z.number().int().positive().default(60000),
  ),
  TX_ACCOUNT_RATE_LIMIT_MAX: z.preprocess(
    (value) => Number(value),
    z.number().int().positive().default(30),
  ),
  TX_ACCOUNT_RATE_LIMIT_WINDOW_MS: z.preprocess(
    (value) => Number(value),
    z.number().int().positive().default(60000),
  ),
  TX_ACCOUNT_RATE_LIMIT_BURST: z.preprocess(
    (value) => Number(value),
    z.number().int().positive().default(60),
  ),
  // Optional analytics ids
  NEXT_PUBLIC_GA_TRACKING_ID: z.string().optional(),
  NEXT_PUBLIC_MIXPANEL_TOKEN: z.string().optional(),
});

// Parse and validate the environment at import time. Throws on error.
export const validatedEnv = envSchema.parse(process.env);

export type ValidatedEnv = typeof validatedEnv;
