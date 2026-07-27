import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HorizonSelector } from '@/lib/http/horizon-selector';
import { AllEndpointsUnhealthyError } from '@/lib/http/errors';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function makeSelector(
  urls: string[],
  opts?: { failureThreshold?: number; openMs?: number },
) {
  return new HorizonSelector(
    urls.map((url) => ({ url })),
    { failureThreshold: 3, openMs: 30_000, ...opts },
  );
}

describe('HorizonSelector', () => {
  it('returns an endpoint when at least one is healthy', () => {
    const sel = makeSelector(['https://a.example.com', 'https://b.example.com']);
    const ep = sel.selectEndpoint();
    expect(['https://a.example.com', 'https://b.example.com']).toContain(ep);
  });

  it('trips an endpoint after crossing the failure threshold', () => {
    const sel = makeSelector(['https://a.example.com', 'https://b.example.com'], {
      failureThreshold: 2,
    });

    sel.recordFailure('https://a.example.com');
    sel.recordFailure('https://a.example.com');

    const status = sel.getStatus();
    const a = status.find((s) => s.url === 'https://a.example.com')!;
    expect(a.tripped).toBe(true);
    expect(a.effectiveWeight).toBe(0);
  });

  it('always returns a healthy endpoint when one is tripped', () => {
    const sel = makeSelector(['https://a.example.com', 'https://b.example.com'], {
      failureThreshold: 1,
    });

    sel.recordFailure('https://a.example.com');

    for (let i = 0; i < 20; i++) {
      expect(sel.selectEndpoint()).toBe('https://b.example.com');
    }
  });

  it('resets failure count and restores weight after a success', () => {
    const sel = makeSelector(['https://a.example.com'], { failureThreshold: 2 });

    sel.recordFailure('https://a.example.com');
    sel.recordFailure('https://a.example.com');

    const tripped = sel.getStatus();
    expect(tripped[0].tripped).toBe(true);

    sel.recordSuccess('https://a.example.com');

    const restored = sel.getStatus();
    expect(restored[0].tripped).toBe(false);
    expect(restored[0].failureCount).toBe(0);
    expect(restored[0].effectiveWeight).toBe(restored[0].weight);
  });

  it('recovers a tripped endpoint after openMs elapses (half-open probe)', () => {
    const sel = makeSelector(['https://a.example.com'], {
      failureThreshold: 1,
      openMs: 5_000,
    });

    sel.recordFailure('https://a.example.com');
    expect(sel.getStatus()[0].tripped).toBe(true);

    vi.advanceTimersByTime(5_000);

    const after = sel.getStatus();
    expect(after[0].tripped).toBe(false);
    expect(after[0].effectiveWeight).toBe(1);
  });

  it('re-trips after a failed half-open probe', () => {
    const sel = makeSelector(['https://a.example.com'], {
      failureThreshold: 1,
      openMs: 5_000,
    });

    sel.recordFailure('https://a.example.com');
    vi.advanceTimersByTime(5_000);

    // half-open: select should succeed
    expect(sel.selectEndpoint()).toBe('https://a.example.com');

    // probe fails
    sel.recordFailure('https://a.example.com');
    expect(sel.getStatus()[0].tripped).toBe(true);
  });

  it('returns the only endpoint even when tripped in single-endpoint config', () => {
    const sel = makeSelector(['https://only.example.com'], { failureThreshold: 1 });
    sel.recordFailure('https://only.example.com');

    expect(() => sel.selectEndpoint()).toThrow(AllEndpointsUnhealthyError);
  });

  // ── core bug fix: all-endpoints-tripped scenario ──────────────────

  it('throws AllEndpointsUnhealthyError when every endpoint is tripped', () => {
    const sel = makeSelector(
      ['https://a.example.com', 'https://b.example.com', 'https://c.example.com'],
      { failureThreshold: 2 },
    );

    // Trip every endpoint
    for (const url of ['https://a.example.com', 'https://b.example.com', 'https://c.example.com']) {
      sel.recordFailure(url);
      sel.recordFailure(url);
    }

    expect(() => sel.selectEndpoint()).toThrow(AllEndpointsUnhealthyError);
  });

  it('throws with correct message including endpoint count', () => {
    const sel = makeSelector(['https://a.example.com', 'https://b.example.com'], {
      failureThreshold: 1,
    });

    sel.recordFailure('https://a.example.com');
    sel.recordFailure('https://b.example.com');

    expect(() => sel.selectEndpoint()).toThrow(
      expect.objectContaining({
        code: 'ALL_ENDPOINTS_UNHEALTHY',
        message: expect.stringContaining('2 Horizon endpoint(s)'),
      }),
    );
  });

  it('does NOT silently return a tripped endpoint when all are unhealthy', () => {
    const sel = makeSelector(
      ['https://a.example.com', 'https://b.example.com'],
      { failureThreshold: 1 },
    );

    sel.recordFailure('https://a.example.com');
    sel.recordFailure('https://b.example.com');

    const returnedUrls: string[] = [];
    for (let i = 0; i < 10; i++) {
      try {
        returnedUrls.push(sel.selectEndpoint());
      } catch {
        break;
      }
    }

    // selectEndpoint must throw before returning any URL
    expect(returnedUrls).toHaveLength(0);
  });

  it('re-throws AllEndpointsUnhealthyError on repeated calls while all remain tripped', () => {
    const sel = makeSelector(['https://a.example.com', 'https://b.example.com'], {
      failureThreshold: 1,
      openMs: 60_000,
    });

    sel.recordFailure('https://a.example.com');
    sel.recordFailure('https://b.example.com');

    for (let i = 0; i < 5; i++) {
      expect(() => sel.selectEndpoint()).toThrow(AllEndpointsUnhealthyError);
    }
  });

  it('recovers selection once at least one endpoint heals', () => {
    const sel = makeSelector(
      ['https://a.example.com', 'https://b.example.com'],
      { failureThreshold: 1 },
    );

    sel.recordFailure('https://a.example.com');
    sel.recordFailure('https://b.example.com');

    expect(() => sel.selectEndpoint()).toThrow(AllEndpointsUnhealthyError);

    // Heal endpoint b
    sel.recordSuccess('https://b.example.com');

    const ep = sel.selectEndpoint();
    expect(ep).toBe('https://b.example.com');
  });

  it('prefers higher-weight healthy endpoint', () => {
    const sel = new HorizonSelector([
      { url: 'https://low.example.com', weight: 1 },
      { url: 'https://high.example.com', weight: 100 },
    ]);

    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const ep = sel.selectEndpoint();
      counts[ep] = (counts[ep] ?? 0) + 1;
    }

    expect(counts['https://high.example.com']).toBeGreaterThan(
      counts['https://low.example.com']!,
    );
  });

  it('throws on construction with zero endpoints', () => {
    expect(() => new HorizonSelector([])).toThrow('at least one endpoint');
  });

  it('getStatus reports accurate snapshot after mixed successes and failures', () => {
    const sel = makeSelector(['https://a.example.com', 'https://b.example.com'], {
      failureThreshold: 3,
    });

    sel.recordFailure('https://a.example.com');
    sel.recordSuccess('https://a.example.com');
    sel.recordFailure('https://b.example.com');

    const status = sel.getStatus();
    const a = status.find((s) => s.url === 'https://a.example.com')!;
    const b = status.find((s) => s.url === 'https://b.example.com')!;

    expect(a.failureCount).toBe(0);
    expect(a.tripped).toBe(false);
    expect(b.failureCount).toBe(1);
    expect(b.tripped).toBe(false);
  });
});
