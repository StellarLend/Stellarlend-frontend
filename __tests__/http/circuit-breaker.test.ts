import { vi, describe, test, expect, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));

import { CircuitBreaker, CircuitState } from '@/lib/http/circuit-breaker';

// Mock metrics to avoid side effects
vi.mock('@/lib/metrics/registry', () => ({
  metrics: {
    circuitState: {
      set: vi.fn()
    }
  }
}));

// Use fake timers for deterministic clock
vi.useFakeTimers();

describe('CircuitBreaker', () => {
  const host = 'example.com';
  const path = '/api/data';
  const healthPath = '/api/health';
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    breaker = new CircuitBreaker();
  });

  test('allows requests when healthy', () => {
    expect(breaker.shouldAllow(host, path)).toBe(true);
  });

  test('opens circuit after failure threshold', () => {
    // Configure thresholds via env defaults (0.5 failure rate, min 2 calls for test)\n    // Simulate failures
    (process.env as any).CIRCUIT_FAILURE_RATE = '0.5';
    (process.env as any).CIRCUIT_MIN_CALLS = '2';
    // First failure
    breaker.recordFailure(host);
    expect(breaker.shouldAllow(host, path)).toBe(true);
    // Second failure crosses threshold
    breaker.recordFailure(host);
    expect(breaker.shouldAllow(host, path)).toBe(false);
  });

  test('half‑open after cooldown', () => {
    (process.env as any).CIRCUIT_FAILURE_RATE = '0.5';
    (process.env as any).CIRCUIT_MIN_CALLS = '1';
    (process.env as any).CIRCUIT_COOLDOWN_MS = '1000';
    breaker.recordFailure(host);
    // Circuit should be open now
    expect(breaker.shouldAllow(host, path)).toBe(false);
    // Advance time past cooldown
    vi.advanceTimersByTime(1000);
    // Should transition to half‑open and allow request
    expect(breaker.shouldAllow(host, path)).toBe(true);
  });

  test('blocks health probe paths when circuit is open', () => {
    // Verify that /api/health paths are NOT exempt from circuit breaker protection.
    // Force the circuit open via failures.
    (process.env as any).CIRCUIT_FAILURE_RATE = '0.5';
    (process.env as any).CIRCUIT_MIN_CALLS = '2';
    breaker.recordFailure(host);
    breaker.recordFailure(host);
    // Circuit should now be OPEN — health paths must also be blocked.
    expect(breaker.shouldAllow(host, healthPath)).toBe(false);
  });
});
