import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';
import { rateLimit, clearRateLimitCache } from '../rate-limit';
import {
  accountBucketRateLimit,
  clearAccountBucketCache,
} from './account-bucket';

const REPO_ROOT = resolve(__dirname, '..', '..');
const DOC_PATH = resolve(REPO_ROOT, 'docs', 'rate-limiting.md');
const CONFIG_PATH = resolve(REPO_ROOT, 'lib', 'config.ts');
const MIDDLEWARE_PATH = resolve(REPO_ROOT, 'middleware.ts');
const ACCOUNT_BUCKET_PATH = resolve(__dirname, 'account-bucket.ts');

function readDoc(): string {
  expect(existsSync(DOC_PATH)).toBe(true);
  return readFileSync(DOC_PATH, 'utf8');
}

describe('rate-limiting doc sync', () => {
  afterEach(() => {
    clearRateLimitCache();
    clearAccountBucketCache();
  });

  it('references the actual exported limiter symbols', () => {
    const doc = readDoc();

    // The doc must explain both limiters and link to their source modules.
    expect(doc).toMatch(/lib\/rate-limit\.ts/);
    expect(doc).toMatch(/lib\/rate-limit\/account-bucket\.ts/);

    // The symbols the doc claims to describe must actually exist.
    expect(typeof rateLimit).toBe('function');
    expect(typeof accountBucketRateLimit).toBe('function');
    expect(typeof clearRateLimitCache).toBe('function');
    expect(typeof clearAccountBucketCache).toBe('function');
  });

  it('lists the environment variables consumed by lib/config.ts', () => {
    const doc = readDoc();
    const configSource = readFileSync(CONFIG_PATH, 'utf8');

    const envVars = [
      'RATE_LIMIT_MAX',
      'RATE_LIMIT_WINDOW',
      'TX_ACCOUNT_RATE_LIMIT_MAX',
      'TX_ACCOUNT_RATE_LIMIT_WINDOW_MS',
      'TX_ACCOUNT_RATE_LIMIT_BURST',
    ] as const;

    for (const name of envVars) {
      expect(configSource).toContain(name);
      expect(doc).toContain(name);
    }
  });

  it('documents the middleware response headers used at runtime', () => {
    const doc = readDoc();
    const middlewareSource = readFileSync(MIDDLEWARE_PATH, 'utf8');

    for (const header of [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
    ]) {
      expect(middlewareSource).toContain(header);
      expect(doc).toContain(header);
    }
  });

  it('documents the account-bucket Result shape and retryAfter field', () => {
    const doc = readDoc();
    const bucketSource = readFileSync(ACCOUNT_BUCKET_PATH, 'utf8');

    expect(bucketSource).toContain('retryAfter');
    expect(doc).toContain('retryAfter');
  });

  it('keeps the per-account exemption in sync with the middleware', () => {
    const doc = readDoc();
    const middlewareSource = readFileSync(MIDDLEWARE_PATH, 'utf8');

    // The middleware exempts /api/health and authenticated callers; the doc
    // must mention both. If either is renamed/removed, this fails.
    expect(middlewareSource).toContain('/api/health');
    expect(doc).toContain('/api/health');

    expect(middlewareSource).toContain('session');
    expect(doc).toContain('session');
  });

  it('documents the per-account endpoints that call the bucket', () => {
    const doc = readDoc();

    // The doc claims to describe these two routes. If either is removed or
    // renamed, the doc must be updated.
    expect(doc).toContain('/api/tx/submit');
    expect(doc).toContain('/api/tx/build');
  });
});
