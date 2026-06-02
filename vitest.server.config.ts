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
    include: [
      'lib/**/*.test.ts',
      'app/api/**/*.test.ts',
      'types/enums.test.ts',
      '__tests__/**/*.test.ts',
    ],
  },
});
