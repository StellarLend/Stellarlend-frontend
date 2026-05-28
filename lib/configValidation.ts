import { z } from 'zod';

// Define the schema for required environment variables
export const envSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1, { message: 'APP_NAME is required' }),
  NEXT_PUBLIC_APP_VERSION: z.string().min(1, { message: 'APP_VERSION is required' }),
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production'], { required_error: 'APP_ENV is required' }),
  NEXT_PUBLIC_API_BASE_URL: z.string().url({ message: 'API_BASE_URL must be a valid URL' }),
  NEXT_PUBLIC_STELLAR_NETWORK: z.string().min(1, { message: 'STELLAR_NETWORK is required' }),
  NEXT_PUBLIC_STELLAR_HORIZON_URL: z.string().url({ message: 'STELLAR_HORIZON_URL must be a valid URL' }),
  NEXT_PUBLIC_SOROBAN_RPC_URL: z.string().url({ message: 'SOROBAN_RPC_URL must be a valid URL' }),
  // Optional analytics ids
  NEXT_PUBLIC_GA_TRACKING_ID: z.string().optional(),
  NEXT_PUBLIC_MIXPANEL_TOKEN: z.string().optional(),
});

// Parse and validate the environment at import time. Throws on error.
export const validatedEnv = envSchema.parse(process.env);

export type ValidatedEnv = typeof validatedEnv;
