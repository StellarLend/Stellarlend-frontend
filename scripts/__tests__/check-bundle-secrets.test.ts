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
  });
});
