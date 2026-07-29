import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanFile } from '../check-bundle-secrets';
import {
  AWS_ACCESS_KEY_PATTERN,
  AWS_SECRET_KEY_PATTERN,
  SECRET_PATTERNS,
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
});
