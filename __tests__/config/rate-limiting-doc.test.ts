import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Keeps docs/rate-limiting.md aligned with the exported limiter surface
 * (GrantFox #685). Renaming or removing an export without updating the doc
 * fails this suite.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const REPO_ROOT = resolve(__dirname, '..', '..');

const DOC_PATH = resolve(REPO_ROOT, 'docs', 'rate-limiting.md');
const BACKEND_DOC = resolve(REPO_ROOT, 'docs', 'backend-architecture.md');
const RATE_LIMIT_SRC = resolve(REPO_ROOT, 'lib', 'rate-limit.ts');
const ACCOUNT_BUCKET_SRC = resolve(REPO_ROOT, 'lib', 'rate-limit', 'account-bucket.ts');
const MIDDLEWARE_SRC = resolve(REPO_ROOT, 'middleware.ts');

function read(path: string): string {
  expect(existsSync(path), `missing ${path}`).toBe(true);
  return readFileSync(path, 'utf8');
}

/** Exported declaration and named re-export names from a TS module. */
function exportedNames(source: string): string[] {
  const names = new Set<string>();
  const declarationRe =
    /export\s+(?:(?:declare|abstract)\s+)*(?:async\s+)?(?:function|const|let|var|interface|type|class|enum)\s+([A-Za-z_$][\w$]*)/g;
  let m: RegExpExecArray | null;
  while ((m = declarationRe.exec(source)) !== null) {
    names.add(m[1]);
  }

  const namedExportRe = /export\s*{([^}]+)}/g;
  while ((m = namedExportRe.exec(source)) !== null) {
    for (const specifier of m[1].split(',')) {
      const normalized = specifier.trim().replace(/^type\s+/, '');
      const exportedName = normalized.split(/\s+as\s+/i).at(-1)?.trim();
      if (exportedName) names.add(exportedName);
    }
  }
  return [...names].sort();
}

describe('docs/rate-limiting.md stays in sync with limiter exports', () => {
  it('detects classes, enums, and named re-exports', () => {
    const source = `
      export class Limiter {}
      export enum LimitMode { Fixed }
      const internalLimit = 1;
      export { internalLimit, Limiter as PublicLimiter };
    `;

    expect(exportedNames(source)).toEqual([
      'LimitMode',
      'Limiter',
      'PublicLimiter',
      'internalLimit',
    ]);
  });

  it('exists and is non-empty', () => {
    const doc = read(DOC_PATH);
    expect(doc.length).toBeGreaterThan(400);
  });

  it('names every export from lib/rate-limit.ts', () => {
    const doc = read(DOC_PATH);
    const exports = exportedNames(read(RATE_LIMIT_SRC));
    expect(exports.length).toBeGreaterThan(0);
    for (const name of exports) {
      expect(doc, `rate-limiting.md missing export "${name}" from lib/rate-limit.ts`).toContain(
        name,
      );
    }
  });

  it('names every export from lib/rate-limit/account-bucket.ts', () => {
    const doc = read(DOC_PATH);
    const exports = exportedNames(read(ACCOUNT_BUCKET_SRC));
    expect(exports.length).toBeGreaterThan(0);
    for (const name of exports) {
      expect(
        doc,
        `rate-limiting.md missing export "${name}" from account-bucket.ts`,
      ).toContain(name);
    }
  });

  it('documents middleware enforcement, headers, and 429 body keys present in middleware.ts', () => {
    const doc = read(DOC_PATH);
    const mw = read(MIDDLEWARE_SRC);

    expect(doc).toContain('middleware.ts');
    expect(doc).toContain('X-RateLimit-Limit');
    expect(doc).toContain('X-RateLimit-Remaining');
    expect(doc).toContain('X-RateLimit-Reset');
    expect(doc).toContain('Retry-After');
    expect(doc).toContain('Too Many Requests');

    // Source still sets the headers the doc describes.
    expect(mw).toContain('X-RateLimit-Limit');
    expect(mw).toContain('Retry-After');
    expect(mw).toContain('Too Many Requests');
  });

  it('is cross-linked from docs/backend-architecture.md', () => {
    const backend = read(BACKEND_DOC);
    expect(backend).toMatch(/rate-limiting\.md/);
    expect(backend).toContain('rateLimit');
    expect(backend).toContain('accountBucketRateLimit');
  });
});
