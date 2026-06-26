import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

/**
 * Minimal config for server-side unit tests (lib/**, app/api/**).
 * Intentionally excludes the Storybook plugin so that no browser/SWC
 * binaries are required, keeping CI fast and dependency-light.
 *
 * Usage:
 *   npx vitest run --config vitest.server.config.ts
 *   npx vitest run --config vitest.server.config.ts lib/api/handler.test.ts
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(dirname, '.'),
    },
  },
  test: {
    name: 'server',
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'lib/**/*.test.ts',
      'app/api/**/*.test.ts',
      'src/jobs/**/*.test.ts',
      'types/enums.test.ts',
      '__tests__/**/*.test.ts',
    ],
    env: {
      NEXT_PUBLIC_APP_NAME: 'Stellarlend',
      NEXT_PUBLIC_APP_VERSION: '1.0.0',
      NEXT_PUBLIC_APP_ENV: 'development',
      NEXT_PUBLIC_API_BASE_URL: 'http://localhost:3001',
      NEXT_PUBLIC_STELLAR_NETWORK: 'testnet',
      NEXT_PUBLIC_STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
      NEXT_PUBLIC_SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
      API_RATE_LIMIT_MAX: '100',
      API_RATE_LIMIT_WINDOW_MS: '60000',
      TX_ACCOUNT_RATE_LIMIT_MAX: '30',
      TX_ACCOUNT_RATE_LIMIT_WINDOW_MS: '60000',
      TX_ACCOUNT_RATE_LIMIT_BURST: '60',
    },
  },
});
