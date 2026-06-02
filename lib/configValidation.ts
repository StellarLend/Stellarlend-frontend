import { z } from 'zod';

const appEnv = process.env.NEXT_PUBLIC_APP_ENV;
const isProd = appEnv === 'production';

// Define the schema for required environment variables.
// In production, we require explicit values. In development/staging, we allow defaults.
export const envSchema = z.object({
  NEXT_PUBLIC_APP_NAME: isProd
    ? z.string().min(1, { message: 'APP_NAME is required' })
    : z.string().min(1, { message: 'APP_NAME is required' }).default('Stellarlend'),
  NEXT_PUBLIC_APP_VERSION: isProd
    ? z.string().min(1, { message: 'APP_VERSION is required' })
    : z.string().min(1, { message: 'APP_VERSION is required' }).default('1.0.0'),
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  NEXT_PUBLIC_API_BASE_URL: isProd
    ? z.string().url({ message: 'API_BASE_URL must be a valid URL' })
    : z.string().url({ message: 'API_BASE_URL must be a valid URL' }).default('http://localhost:3001'),
  NEXT_PUBLIC_STELLAR_NETWORK: isProd
    ? z.string().min(1, { message: 'STELLAR_NETWORK is required' })
    : z.string().min(1, { message: 'STELLAR_NETWORK is required' }).default('testnet'),
  NEXT_PUBLIC_STELLAR_HORIZON_URL: isProd
    ? z.string().url({ message: 'STELLAR_HORIZON_URL must be a valid URL' })
    : z.string().url({ message: 'STELLAR_HORIZON_URL must be a valid URL' }).default('https://horizon-testnet.stellar.org'),
  NEXT_PUBLIC_SOROBAN_RPC_URL: isProd
    ? z.string().url({ message: 'SOROBAN_RPC_URL must be a valid URL' })
    : z.string().url({ message: 'SOROBAN_RPC_URL must be a valid URL' }).default('https://soroban-testnet.stellar.org'),
  // Optional analytics ids
  NEXT_PUBLIC_GA_TRACKING_ID: z.string().optional(),
  NEXT_PUBLIC_MIXPANEL_TOKEN: z.string().optional(),
});

// Parse and validate the environment at import time. Throws on error.
export const validatedEnv = envSchema.parse(process.env);

export type ValidatedEnv = typeof validatedEnv;
