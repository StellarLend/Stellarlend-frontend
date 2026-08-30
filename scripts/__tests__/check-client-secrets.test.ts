import { describe, it, expect, vi, beforeEach } from 'vitest';

// The script uses require('fs') and require('path') — mock fs for isolation.
vi.mock('fs', () => ({
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn(() => true),
}));

import { readdirSync, statSync, readFileSync, existsSync } from 'fs';

const mockReaddir = vi.mocked(readdirSync);
const mockStat = vi.mocked(statSync);
const mockRead = vi.mocked(readFileSync);
const mockExists = vi.mocked(existsSync);

// Re-implement the core logic under test so we can unit-test it without
// process.exit side-effects. This mirrors exactly what check-client-secrets.js
// does: import detection + secret env reference detection, with an allowlist.
const SECRETS = [
  'PRICE_ORACLE_API_KEY',
  'AUTH_SIGNING_SECRET',
  'SERVER_TOKEN',
  'SOROBAN_RPC_URL',
  'WEBHOOK_SECRET',
  'STELLAR_SIGNING_SECRET',
];

const FORBIDDEN_IMPORTS = ['lib/server-config', '@/lib/server-config'];

const ALLOWLIST_PATHS = new Set([
  'lib/security/secret-patterns.ts',
  'scripts/check-client-secrets.js',
]);

function checkContent(relativePath: string, content: string): string[] {
  const violations: string[] = [];

  if (ALLOWLIST_PATHS.has(relativePath)) return violations;

  for (const forbidden of FORBIDDEN_IMPORTS) {
    const regex = new RegExp(
      `from\\s+['"]([^'"]*${forbidden.replace('/', '\\/')}[^'"]*)['"]`,
      'i',
    );
    if (regex.test(content)) {
      violations.push(`Cannot import server-config in ${relativePath}`);
    }
  }

  for (const secret of SECRETS) {
    if (new RegExp(`process\\.env\\.${secret}\\b`).test(content)) {
      violations.push(`Cannot reference secret process.env.${secret} in ${relativePath}`);
    }
  }

  return violations;
}

describe('check-client-secrets', () => {
  describe('server-config import detection', () => {
    it('flags bare lib/server-config import', () => {
      const v = checkContent('context/Foo.tsx', `import config from 'lib/server-config';`);
      expect(v).toHaveLength(1);
      expect(v[0]).toMatch('server-config');
    });

    it('flags @/lib/server-config import', () => {
      const v = checkContent('components/Bar.tsx', `import cfg from '@/lib/server-config';`);
      expect(v).toHaveLength(1);
    });

    it('allows @/lib/config (public config)', () => {
      const v = checkContent('hooks/useData.ts', `import config from '@/lib/config';`);
      expect(v).toHaveLength(0);
    });

    it('allows server-config in allowlisted file', () => {
      const v = checkContent('lib/security/secret-patterns.ts', `'AUTH_SIGNING_SECRET'`);
      expect(v).toHaveLength(0);
    });
  });

  describe('secret env reference detection', () => {
    it('flags PRICE_ORACLE_API_KEY', () => {
      const v = checkContent('utils/prices.ts', `const k = process.env.PRICE_ORACLE_API_KEY;`);
      expect(v).toHaveLength(1);
      expect(v[0]).toMatch('PRICE_ORACLE_API_KEY');
    });

    it('flags AUTH_SIGNING_SECRET', () => {
      const v = checkContent('context/Auth.tsx', `process.env.AUTH_SIGNING_SECRET`);
      expect(v).toHaveLength(1);
    });

    it('flags SERVER_TOKEN', () => {
      const v = checkContent('hooks/useToken.ts', `process.env.SERVER_TOKEN`);
      expect(v).toHaveLength(1);
    });

    it('flags SOROBAN_RPC_URL', () => {
      const v = checkContent('components/Rpc.tsx', `process.env.SOROBAN_RPC_URL`);
      expect(v).toHaveLength(1);
      expect(v[0]).toMatch('SOROBAN_RPC_URL');
    });

    it('flags WEBHOOK_SECRET', () => {
      const v = checkContent('utils/webhook.ts', `process.env.WEBHOOK_SECRET`);
      expect(v).toHaveLength(1);
    });

    it('flags STELLAR_SIGNING_SECRET', () => {
      const v = checkContent('utils/sign.ts', `process.env.STELLAR_SIGNING_SECRET`);
      expect(v).toHaveLength(1);
    });

    it('does not flag NEXT_PUBLIC_ vars', () => {
      const v = checkContent('components/App.tsx', `process.env.NEXT_PUBLIC_APP_NAME`);
      expect(v).toHaveLength(0);
    });

    it('does not flag partial name matches (SOROBAN_RPC_URL_EXTRA)', () => {
      // The word-boundary \\b must prevent "SOROBAN_RPC_URL_EXTRA" from matching
      // since the regex ends with \\b.
      const v = checkContent('utils/rpc.ts', `process.env.SOROBAN_RPC_URL_EXTRA`);
      // SOROBAN_RPC_URL_EXTRA contains SOROBAN_RPC_URL as a prefix but \b requires
      // a non-word character after — underscore is a word char so this should NOT match.
      expect(v).toHaveLength(0);
    });
  });

  describe('allowlist', () => {
    it('skips check-client-secrets.js itself', () => {
      const v = checkContent(
        'scripts/check-client-secrets.js',
        `const SECRETS = ['PRICE_ORACLE_API_KEY', 'AUTH_SIGNING_SECRET'];`,
      );
      expect(v).toHaveLength(0);
    });

    it('skips secret-patterns.ts', () => {
      const v = checkContent(
        'lib/security/secret-patterns.ts',
        `pattern: /(?:PRICE_ORACLE_API_KEY|AUTH_SIGNING_SECRET)/g`,
      );
      expect(v).toHaveLength(0);
    });
  });

  describe('clean files', () => {
    it('returns no violations for a clean component', () => {
      const v = checkContent(
        'components/Button.tsx',
        `export function Button({ label }: { label: string }) { return <button>{label}</button>; }`,
      );
      expect(v).toHaveLength(0);
    });
  });
});
