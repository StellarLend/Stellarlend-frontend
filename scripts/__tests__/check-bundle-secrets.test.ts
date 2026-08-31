import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { scanBundles, scanFile } from '../check-bundle-secrets';
import { SECRET_PATTERNS } from '../../lib/security/secret-patterns';

describe('bundle secret scanner', () => {
  it('fails closed when the build output is missing', () => {
    const result = scanBundles(path.join(os.tmpdir(), 'stellarlend-missing-static-output'));
    expect(result.matches).toEqual([]);
    expect(result.filesScanned).toBe(0);
    expect(result.errors).toEqual(['.next/static directory not found. Run "npm run build" first.']);
  });

  it('reports unreadable files instead of silently skipping them', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stellarlend-bundle-'));
    const file = path.join(directory, 'chunk.js');
    fs.writeFileSync(file, 'export const value = 1;');
    const original = fs.readFileSync;
    vi.spyOn(fs, 'readFileSync').mockImplementation(((filePath: fs.PathOrFileDescriptor, options?: any) => {
      if (String(filePath) === file) throw new Error('permission denied');
      return original(filePath, options);
    }) as typeof fs.readFileSync);

    const result = scanFile(file, SECRET_PATTERNS);
    expect(result.matches).toEqual([]);
    expect(result.error).toContain('Unable to read bundle file');
    vi.restoreAllMocks();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('scans an empty bundle successfully without producing a false positive', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stellarlend-bundle-'));
    const file = path.join(directory, 'empty.js');
    fs.writeFileSync(file, '');
    const result = scanFile(file, SECRET_PATTERNS);
    expect(result.matches).toEqual([]);
    expect(result.error).toBeUndefined();
    fs.rmSync(directory, { recursive: true, force: true });
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanFile } from '../check-bundle-secrets';
import {
  AWS_ACCESS_KEY_PATTERN,
  AWS_SECRET_KEY_PATTERN,
  SECRET_PATTERNS,
  SERVER_ENV_PATTERN,
  STELLAR_SECRET_KEY_PATTERN,
} from '../../lib/security/secret-patterns';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

import { readFileSync } from 'fs';

const mockReadFileSync = vi.mocked(readFileSync);

describe('scanFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects a critical AWS Access Key ID in file content', () => {
    mockReadFileSync.mockReturnValue("const key = 'AKIAIOSFODNN7EXAMPLE';");
    const matches = scanFile('/fake/file.js', SECRET_PATTERNS);

    expect(matches).toHaveLength(1);
    expect(matches[0].pattern).toBe('AWS Access Key ID');
    expect(matches[0].match).toBe('AKIAIOSFODNN7EXAMPLE');
    expect(matches[0].severity).toBe('critical');
  });

  it('excludes 40-char hex strings as AWS Secret Access Key false positives', () => {
    mockReadFileSync.mockReturnValue(
      "const hash = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';",
    );
    const matches = scanFile('/fake/file.js', [AWS_SECRET_KEY_PATTERN]);

    expect(matches).toHaveLength(0);
  });

  it('detects a real AWS Secret Access Key (mixed chars, not purely hex)', () => {
    mockReadFileSync.mockReturnValue(
      "const secret = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';",
    );
    const matches = scanFile('/fake/file.js', [AWS_SECRET_KEY_PATTERN]);

    expect(matches).toHaveLength(1);
    expect(matches[0].pattern).toBe('AWS Secret Access Key');
    expect(matches[0].match).toBe('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
    expect(matches[0].severity).toBe('critical');
  });

  it('reports correct line and column numbers in a multi-line file', () => {
    const content = [
      'line1',
      'line2',
      "const key = 'AKIAIOSFODNN7EXAMPLE';",
      'line4',
    ].join('\n');
    mockReadFileSync.mockReturnValue(content);
    const matches = scanFile('/fake/file.js', [AWS_ACCESS_KEY_PATTERN]);

    expect(matches).toHaveLength(1);
    expect(matches[0].line).toBe(3);
    expect(matches[0].column).toBe(14);
    expect(matches[0].match).toBe('AKIAIOSFODNN7EXAMPLE');
  });

  it('returns empty array and does not throw when the file cannot be read', () => {
    mockReadFileSync.mockImplementation(() => { throw new Error('EACCES: permission denied'); });
    expect(() => scanFile('/fake/unreadable.js', SECRET_PATTERNS)).not.toThrow();
    expect(scanFile('/fake/unreadable.js', SECRET_PATTERNS)).toEqual([]);
  });

  it('detects a leaked server env var name in a bundle', () => {
    mockReadFileSync.mockReturnValue('var t="AUTH_SIGNING_SECRET",r=process.env[t]');
    const matches = scanFile('/fake/chunk.js', [SERVER_ENV_PATTERN]);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].severity).toBe('critical');
  });

  it('detects a Stellar secret key', () => {
    const stellarKey = 'S' + 'A'.repeat(55);
    mockReadFileSync.mockReturnValue(`const sk = "${stellarKey}"`);
    const matches = scanFile('/fake/wallet.js', [STELLAR_SECRET_KEY_PATTERN]);

    expect(matches).toHaveLength(1);
    expect(matches[0].pattern).toBe('Stellar Secret Key');
    expect(matches[0].severity).toBe('critical');
  });

  it('returns no matches for a clean file', () => {
    mockReadFileSync.mockReturnValue('console.log("hello world");');
    expect(scanFile('/fake/clean.js', SECRET_PATTERNS)).toHaveLength(0);
  });
});
