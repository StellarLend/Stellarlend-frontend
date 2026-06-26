import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  accountBucketRateLimit,
  clearAccountBucketCache,
  AccountBucketOptions,
} from './account-bucket';

describe('accountBucketRateLimit', () => {
  const options: AccountBucketOptions = {
    limit: 2,
    windowMs: 4000,
    burst: 4,
  };

  beforeEach(() => {
    clearAccountBucketCache();
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows up to burst capacity immediately', () => {
    const result1 = accountBucketRateLimit('GABC123', options);
    const result2 = accountBucketRateLimit('GABC123', options);
    const result3 = accountBucketRateLimit('GABC123', options);
    const result4 = accountBucketRateLimit('GABC123', options);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result3.success).toBe(true);
    expect(result4.success).toBe(true);
    expect(result4.remaining).toBe(0);
  });

  it('rejects requests after burst is exhausted and returns Retry-After', () => {
    accountBucketRateLimit('GABC123', options);
    accountBucketRateLimit('GABC123', options);
    accountBucketRateLimit('GABC123', options);
    accountBucketRateLimit('GABC123', options);

    const result = accountBucketRateLimit('GABC123', options);

    expect(result.success).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.reset).toBeGreaterThan(0);
    expect(result.remaining).toBe(0);
    expect(result.limit).toBe(options.limit);
  });

  it('refills tokens over time and allows a new request after wait', () => {
    accountBucketRateLimit('GABC123', options);
    accountBucketRateLimit('GABC123', options);
    accountBucketRateLimit('GABC123', options);
    accountBucketRateLimit('GABC123', options);

    const blocked = accountBucketRateLimit('GABC123', options);
    expect(blocked.success).toBe(false);

    vi.advanceTimersByTime(2000);
    const result = accountBucketRateLimit('GABC123', options);

    expect(result.success).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });
});
