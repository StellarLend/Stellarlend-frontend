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
