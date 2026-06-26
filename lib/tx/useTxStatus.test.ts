import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTxStatus from './useTxStatus';

vi.useFakeTimers();

describe('useTxStatus', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('resolves to completed when API returns SUCCESS', async () => {
    const mock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'SUCCESS', hash: 'h' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', mock as any);

    const { result, waitForNextUpdate } = renderHook(() => useTxStatus('h'));

    // initial processing
    expect(result.current).toEqual({ state: 'processing' });

    // allow promise microtasks
    await Promise.resolve();
    // since hook sets completed, await next tick
    await waitForNextUpdate();
    expect(result.current?.state).toBe('completed');
  });

  it('stops and returns rate_limited on 429', async () => {
    const mock = vi.fn().mockResolvedValue(new Response('rate', { status: 429, headers: { 'Retry-After': '5' } }));
    vi.stubGlobal('fetch', mock as any);

    const { result, waitForNextUpdate } = renderHook(() => useTxStatus('r'));
    await Promise.resolve();
    await waitForNextUpdate();

    expect(result.current).toEqual({ state: 'rate_limited', retryAfterSeconds: 5 });
  });
});
