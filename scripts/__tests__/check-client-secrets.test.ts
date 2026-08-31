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
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { checkFile } = require('../check-client-secrets.js');

describe('check-client-secrets boundary', () => {
  it('rejects bracket-style server env access in shared code', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'client-secret-'));
    const filePath = path.join(tempDir, 'shared.ts');
    fs.writeFileSync(filePath, "const token = process.env['PRICE_ORACLE_API_KEY'];\n");

    const issues = checkFile(filePath);

    expect(issues.some((issue) => issue.includes('PRICE_ORACLE_API_KEY'))).toBe(true);
  });

  it('rejects dynamic imports of server-config from shared code', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'client-secret-'));
    const filePath = path.join(tempDir, 'feature.ts');
    fs.writeFileSync(filePath, "const config = await import('@/lib/server-config');\n");

    const issues = checkFile(filePath);

    expect(issues.some((issue) => issue.includes('server-config'))).toBe(true);
  });
});
