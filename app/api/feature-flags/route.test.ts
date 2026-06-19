import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/feature-flags/route';
import { evaluateAllFlags } from '@/lib/flags/evaluator';

vi.mock('@/lib/flags/evaluator', () => ({
  evaluateAllFlags: vi.fn(),
}));

const mockedEvaluateAllFlags = vi.mocked(evaluateAllFlags);
const baseTime = new Date('2026-06-20T00:00:00.000Z');

function makeGetRequest(userId?: string) {
  return new Request('http://localhost/api/feature-flags', {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

describe('GET /api/feature-flags', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);
    mockedEvaluateAllFlags.mockReset();
    mockedEvaluateAllFlags.mockImplementation((userId: string) => ({
      [`flag-for-${userId}`]: true,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('evaluates and caches flags for the same user within the TTL', async () => {
    const first = await GET(makeGetRequest('user-cache-hit'));
    const second = await GET(makeGetRequest('user-cache-hit'));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ 'flag-for-user-cache-hit': true });
    await expect(second.json()).resolves.toEqual({ 'flag-for-user-cache-hit': true });
    expect(mockedEvaluateAllFlags).toHaveBeenCalledTimes(1);
    expect(mockedEvaluateAllFlags).toHaveBeenCalledWith('user-cache-hit');
  });

  it('re-evaluates a cached user after the five-minute TTL expires', async () => {
    mockedEvaluateAllFlags
      .mockReturnValueOnce({ expiringFlag: false })
      .mockReturnValueOnce({ expiringFlag: true });

    const first = await GET(makeGetRequest('user-cache-expiry'));
    vi.advanceTimersByTime(5 * 60 * 1000);
    const second = await GET(makeGetRequest('user-cache-expiry'));

    await expect(first.json()).resolves.toEqual({ expiringFlag: false });
    await expect(second.json()).resolves.toEqual({ expiringFlag: true });
    expect(mockedEvaluateAllFlags).toHaveBeenCalledTimes(2);
    expect(mockedEvaluateAllFlags).toHaveBeenNthCalledWith(1, 'user-cache-expiry');
    expect(mockedEvaluateAllFlags).toHaveBeenNthCalledWith(2, 'user-cache-expiry');
  });

  it('keeps cache entries isolated by x-user-id', async () => {
    const firstUser = await GET(makeGetRequest('user-alpha'));
    const secondUser = await GET(makeGetRequest('user-beta'));
    const cachedFirstUser = await GET(makeGetRequest('user-alpha'));

    await expect(firstUser.json()).resolves.toEqual({ 'flag-for-user-alpha': true });
    await expect(secondUser.json()).resolves.toEqual({ 'flag-for-user-beta': true });
    await expect(cachedFirstUser.json()).resolves.toEqual({ 'flag-for-user-alpha': true });
    expect(mockedEvaluateAllFlags).toHaveBeenCalledTimes(2);
    expect(mockedEvaluateAllFlags).toHaveBeenNthCalledWith(1, 'user-alpha');
    expect(mockedEvaluateAllFlags).toHaveBeenNthCalledWith(2, 'user-beta');
  });

  it('uses anonymous as the cache key when x-user-id is missing', async () => {
    const first = await GET(makeGetRequest());
    const second = await GET(makeGetRequest());

    await expect(first.json()).resolves.toEqual({ 'flag-for-anonymous': true });
    await expect(second.json()).resolves.toEqual({ 'flag-for-anonymous': true });
    expect(mockedEvaluateAllFlags).toHaveBeenCalledTimes(1);
    expect(mockedEvaluateAllFlags).toHaveBeenCalledWith('anonymous');
  });

  it('does not duplicate evaluation for back-to-back first requests for one user', async () => {
    const [first, second] = await Promise.all([
      GET(makeGetRequest('user-concurrent')),
      GET(makeGetRequest('user-concurrent')),
    ]);

    await expect(first.json()).resolves.toEqual({ 'flag-for-user-concurrent': true });
    await expect(second.json()).resolves.toEqual({ 'flag-for-user-concurrent': true });
    expect(mockedEvaluateAllFlags).toHaveBeenCalledTimes(1);
  });
});
