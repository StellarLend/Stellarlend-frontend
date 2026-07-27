import { describe, expect, it } from 'vitest';
import {
  runWithRequestContext,
  getRequestContext,
  getActiveRequestId,
} from '@/lib/request-context';

describe('request-context AsyncLocalStorage propagation', () => {
  it('getRequestContext returns undefined outside a run', () => {
    expect(getRequestContext()).toBeUndefined();
  });

  it('getActiveRequestId returns undefined outside a run', () => {
    expect(getActiveRequestId()).toBeUndefined();
  });

  it('runWithRequestContext propagates context inside the callback', () => {
    const ctx = { requestId: 'TEST-ID-001' };
    runWithRequestContext(ctx, () => {
      expect(getRequestContext()).toEqual(ctx);
      expect(getActiveRequestId()).toBe('TEST-ID-001');
    });
  });

  it('context is no longer available after the callback returns', () => {
    runWithRequestContext({ requestId: 'EPHEMERAL' }, () => {
      // confirm it's set inside
      expect(getActiveRequestId()).toBe('EPHEMERAL');
    });
    // confirm it's gone outside
    expect(getRequestContext()).toBeUndefined();
  });

  it('returns the callback return value', () => {
    const result = runWithRequestContext({ requestId: 'RET-ID' }, () => 42);
    expect(result).toBe(42);
  });

  it('propagates context into nested async callbacks', async () => {
    const ctx = { requestId: 'ASYNC-ID' };
    await runWithRequestContext(ctx, async () => {
      await Promise.resolve();
      expect(getActiveRequestId()).toBe('ASYNC-ID');
    });
  });

  it('isolates context between concurrent async runs', async () => {
    const results: string[] = [];

    await Promise.all([
      runWithRequestContext({ requestId: 'A' }, async () => {
        await new Promise((r) => setTimeout(r, 10));
        results.push(getActiveRequestId()!);
      }),
      runWithRequestContext({ requestId: 'B' }, async () => {
        await new Promise((r) => setTimeout(r, 5));
        results.push(getActiveRequestId()!);
      }),
    ]);

    expect(results).toContain('A');
    expect(results).toContain('B');
  });

  it('inner run does not leak into outer run after inner completes', () => {
    runWithRequestContext({ requestId: 'OUTER' }, () => {
      runWithRequestContext({ requestId: 'INNER' }, () => {
        expect(getActiveRequestId()).toBe('INNER');
      });
      // After inner run completes, outer context is restored
      expect(getActiveRequestId()).toBe('OUTER');
    });
  });

  it('nested runWithRequestContext uses innermost context', () => {
    runWithRequestContext({ requestId: 'PARENT' }, () => {
      runWithRequestContext({ requestId: 'CHILD' }, () => {
        expect(getActiveRequestId()).toBe('CHILD');
      });
    });
  });
});
