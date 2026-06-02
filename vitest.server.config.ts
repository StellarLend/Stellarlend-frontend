// @ts-nocheck - vitest config requires types that aren't currently installed
// @ts-ignore - node:path types not available without @types/node
import path from 'node:path';
// @ts-ignore - node:url types not available without @types/node
import { fileURLToPath } from 'node:url';
// @ts-ignore - vitest/config types not available
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
    ],
  },
});
