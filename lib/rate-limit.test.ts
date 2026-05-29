import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rateLimit, clearRateLimitCache } from './rate-limit';

describe('rateLimit utility', () => {
  const identifier = 'test-ip';
  const limit = 2;
  const windowMs = 1000; // 1 second

  beforeEach(() => {
    clearRateLimitCache();
    vi.useFakeTimers();
  });

  it('should allow requests within the limit', () => {
    const res1 = rateLimit(identifier, limit, windowMs);
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(1);

    const res2 = rateLimit(identifier, limit, windowMs);
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(0);
  });

  it('should block requests exceeding the limit', () => {
    rateLimit(identifier, limit, windowMs);
    rateLimit(identifier, limit, windowMs);
    
    const res3 = rateLimit(identifier, limit, windowMs);
    expect(res3.success).toBe(false);
    expect(res3.remaining).toBe(0);
  });

  it('should reset the limit after the window expires', () => {
    rateLimit(identifier, limit, windowMs);
    rateLimit(identifier, limit, windowMs);
    
    // Advance time past the window
    vi.advanceTimersByTime(windowMs + 100);
    
    const res = rateLimit(identifier, limit, windowMs);
    expect(res.success).toBe(true);
    expect(res.remaining).toBe(1); // 1 used, 1 remaining
  });

  it('should return a valid reset timestamp', () => {
    const startTime = Date.now();
    const res = rateLimit(identifier, limit, windowMs);
    
    expect(res.reset).toBeGreaterThanOrEqual(startTime + windowMs);
  });
});