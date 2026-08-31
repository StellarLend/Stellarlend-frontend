import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { scanSource } = require('../check-client-secrets.js');

describe('client secret scanner', () => {
  it('accepts public environment configuration', () => {
    expect(scanSource("const url = process.env.NEXT_PUBLIC_API_URL;", 'client.ts')).toEqual([]);
  });

  it.each([
    'process.env.PRICE_ORACLE_API_KEY',
    'process.env[\"AUTH_SIGNING_SECRET\"]',
    "process.env['SERVER_TOKEN']",
    'process?.env?.SERVER_TOKEN',
  ])('rejects secret access form: %s', (source) => {
    expect(scanSource(source, 'client.ts')).toHaveLength(1);
  });

  it('rejects server config through static, require, and dynamic imports', () => {
    expect(scanSource("import cfg from '@/lib/server-config';", 'client.ts')).toHaveLength(1);
    expect(scanSource("const cfg = require('lib/server-config');", 'client.ts')).toHaveLength(1);
    expect(scanSource("const cfg = import('lib/server-config');", 'client.ts')).toHaveLength(1);
  });

  it('does not reject identifiers that merely contain a secret name', () => {
    expect(scanSource('const SERVER_TOKENIZER = true; const PRICE_ORACLE_API_KEY_NAME = "public";', 'client.ts')).toEqual([]);
  });
});
