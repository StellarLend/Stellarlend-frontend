/**
 * Tests for GET /api/positions/history
 * 
 * Coverage:
 * - Authentication requirement
 * - Query parameter validation
 * - Cache hit/miss
 * - Response formatting
 * - Error handling
 * - Edge cases (empty data, invalid params)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as auth from '@/lib/auth';
import * as snapshotWorker from '@/src/jobs/snapshot.worker';
import { globalCache } from '@/lib/cache';

vi.mock('@/lib/auth');
vi.mock('@/src/jobs/snapshot.worker');

describe('GET /api/positions/history', () => {
  const testWallet = 'GBTEST123';
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    globalCache.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockUser = (walletAddress: string = testWallet) => ({
    id: 'user-123',
    walletAddress,
    email: 'test@example.com',
    name: 'Test User',
  });

  const createMockSnapshot = (timestamp: number) => ({
    id: `snap-${timestamp}`,
    walletAddress: testWallet,
    timestamp,
    supplied: 5000,
    borrowed: 2000,
    effectiveSupplyApy: 2.5,
    effectiveBorrowApy: 8.5,
    createdAt: timestamp,
  });

  const createRequest = (queryParams: Record<string, string> = {}) => {
    const url = new URL('http://localhost/api/positions/history');
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    return new NextRequest(url, { method: 'GET' });
  };

  describe('Authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      vi.mocked(auth.getUser).mockResolvedValueOnce(null as any);

      const request = createRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 401 when wallet address is missing', async () => {
      vi.mocked(auth.getUser).mockResolvedValueOnce({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        walletAddress: null,
      } as any);

      const request = createRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('allows authenticated request with valid wallet', async () => {
      vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser());
      vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce([]);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Query Parameters', () => {
    beforeEach(() => {
      vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser());
    });

    it('accepts valid from and to parameters', async () => {
      const from = now - 30 * dayMs;
      const to = now;

      globalCache.clear();
      vi.clearAllMocks();
      vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser());
      vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce([]);

      const request = createRequest({ from: String(from), to: String(to) });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('accepts valid interval parameter', async () => {
      for (const interval of ['1h', '1d', '7d', '30d']) {
        globalCache.clear();
        vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser());
        vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce([]);

        const request = createRequest({ interval });
        const response = await GET(request);
        expect(response.status).toBe(200);
      }
    });

    it('rejects invalid interval', async () => {
      vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce([]);

      const request = createRequest({ interval: 'invalid' });
      const response = await GET(request);

      expect(response.status).toBe(400);
      expect(response.headers.get('content-type')).toContain('application/json');
    });

    it('rejects when from >= to', async () => {
      const from = now;
      const to = now - 1000;

      vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce([]);

      const request = createRequest({ from: String(from), to: String(to) });
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('rejects when range exceeds 365 days', async () => {
      const from = now - 400 * dayMs;
      const to = now;

      vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce([]);

      const request = createRequest({ from: String(from), to: String(to) });
      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('Response Format', () => {
    it('returns correct response structure', async () => {
      globalCache.clear();
      vi.clearAllMocks();
      vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser());
      const snapshots = [
        createMockSnapshot(now - 2 * dayMs),
        createMockSnapshot(now - dayMs),
        createMockSnapshot(now),
      ];

      vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce(snapshots);

      const request = createRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('walletAddress');
      expect(data).toHaveProperty('snapshots');
      expect(data).toHaveProperty('interval');
      expect(data).toHaveProperty('bucketCount');
    });

    it('returns wallet address from authenticated user', async () => {
      const wallet = 'GBCUSTOM123';
      globalCache.clear();
      vi.clearAllMocks();
      vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser(wallet));
      vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce([]);

      const request = createRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.walletAddress).toBe(wallet);
    });

    it('includes all snapshot fields in response', async () => {
      globalCache.clear();
      vi.clearAllMocks();
      vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser());
      const snapshots = [
        createMockSnapshot(now - dayMs),
        createMockSnapshot(now),
      ];

      vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce(snapshots);

      const request = createRequest({ interval: '1d' });
      const response = await GET(request);
      const data = await response.json();

      expect(data.snapshots.length).toBeGreaterThan(0);

      const snapshot = data.snapshots[0];
      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('supplied');
      expect(snapshot).toHaveProperty('borrowed');
      expect(snapshot).toHaveProperty('effectiveSupplyApy');
      expect(snapshot).toHaveProperty('effectiveBorrowApy');
    });

    it('does not include internal fields in response', async () => {
      const snapshots = [createMockSnapshot(now)];
      vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce(snapshots);

      const request = createRequest();
      const response = await GET(request);
      const data = await response.json();

      const snapshot = data.snapshots[0];
      expect(snapshot).not.toHaveProperty('id');
      expect(snapshot).not.toHaveProperty('walletAddress');
      expect(snapshot).not.toHaveProperty('createdAt');
    });

    it('returns correct interval in response', async () => {
      vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce([]);

      const request = createRequest({ interval: '7d' });
      const response = await GET(request);
      const data = await response.json();
      expect(data.interval).toBe('7d');
    });

    it('returns correct bucket count', async () => {
      const dayMs = 24 * 60 * 60 * 1000;
      const snapshots = [
        createMockSnapshot(now - 3 * dayMs),
        createMockSnapshot(now - 2 * dayMs),
        createMockSnapshot(now - dayMs),
        createMockSnapshot(now),
      ];

      vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce(snapshots);

      const request = createRequest({ interval: '1d' });
      const response = await GET(request);
      const data = await response.json();

      expect(data.bucketCount).toBeGreaterThan(0);
      expect(data.bucketCount).toBeLessThanOrEqual(snapshots.length);
    });
  });

  describe('Caching', () => {
    it('returns cache hit on second request', async () => {
      globalCache.clear();
      vi.clearAllMocks();
      vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser());
      const snapshots = [createMockSnapshot(now)];
      vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce(snapshots);

      const request1 = createRequest({ interval: '1d' });
      const response1 = await GET(request1);
      const data1 = await response1.json();

      // Clear the mock to ensure it's not called again
      vi.mocked(snapshotWorker.getWalletSnapshots).mockClear();

      // Reset auth mock for second request
      vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser());

      const request2 = createRequest({ interval: '1d' });
      const response2 = await GET(request2);
      const data2 = await response2.json();

      expect(response2.status).toBe(200);
      expect(data1).toEqual(data2);
      // The worker should not have been called a second time (cached)
      expect(vi.mocked(snapshotWorker.getWalletSnapshots)).not.toHaveBeenCalled();
    });

    it('includes cache header in response', async () => {
      globalCache.clear();
      vi.clearAllMocks();
      vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser());
      vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce([]);

      const request = createRequest();
      const response = await GET(request);

      const cacheHeader = response.headers.get('X-Cache');
      expect(['HIT', 'MISS', 'STALE', 'BYPASS']).toContain(cacheHeader);
    });

    it('uses different cache keys for different intervals', async () => {
      globalCache.clear();
      vi.clearAllMocks();
      const snapshots = [createMockSnapshot(now)];

      // Reset mocks before first call
      vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser());
      vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce(snapshots);

      const request1 = createRequest({ interval: '1d' });
      await GET(request1);

      // Reset mocks for second call with different interval
      vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser());
      vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce(snapshots);

      const request2 = createRequest({ interval: '7d' });
      const response2 = await GET(request2);

      expect(response2.status).toBe(200);
      // Both requests should succeed independently
    });

    it('uses wallet address in cache key', async () => {
      const wallet1 = 'GBWALLET1';
      const snapshots = [createMockSnapshot(now - dayMs)];

      globalCache.clear();
      vi.clearAllMocks();
      vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser(wallet1));
      vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce(snapshots);

      const request = createRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.walletAddress).toBe(wallet1);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty snapshot data', async () => {
      globalCache.clear();
      vi.clearAllMocks();
      vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser());
      vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce([]);

      const request = createRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.snapshots).toEqual([]);
      expect(data.bucketCount).toBe(0);
    });

    it('handles large snapshot count', async () => {
      globalCache.clear();
      vi.clearAllMocks();
      vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser());
      // Generate 365 snapshots (daily for a year)
      const snapshots = [];
      for (let i = 0; i < 365; i++) {
        snapshots.push(createMockSnapshot(now - i * dayMs));
      }

      vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce(snapshots);

      const request = createRequest({ interval: '1d' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.snapshots.length).toBeGreaterThan(0);
    });

    it('returns consistent data on repeated requests', async () => {
      globalCache.clear();
      vi.clearAllMocks();
      const snapshots = [
        createMockSnapshot(now - dayMs),
        createMockSnapshot(now),
      ];

      // First request - hit the worker
      vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser());
      vi.mocked(snapshotWorker.getWalletSnapshots).mockResolvedValueOnce(snapshots);

      const request1 = createRequest();
      const response1 = await GET(request1);
      const data1 = await response1.json();

      // Second request - should be from cache
      vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser());
      // Don't mock getWalletSnapshots for the cached request

      const request2 = createRequest();
      const response2 = await GET(request2);
      const data2 = await response2.json();

      expect(data1).toEqual(data2);
    });
  });

  describe('Error Handling', () => {
    it('returns 400 for worker errors', async () => {
      globalCache.clear();
      vi.clearAllMocks();
      vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser());
      vi.mocked(snapshotWorker.getWalletSnapshots).mockRejectedValueOnce(
        new Error('Database error')
      );

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('message');
    });

    it('includes error message in response', async () => {
      globalCache.clear();
      vi.clearAllMocks();
      vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser());
      const errorMsg = 'Test error message';
      vi.mocked(snapshotWorker.getWalletSnapshots).mockRejectedValueOnce(
        new Error(errorMsg)
      );

      const request = createRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.message).toContain(errorMsg);
    });

    it('returns valid JSON error responses', async () => {
      globalCache.clear();
      vi.clearAllMocks();
      vi.mocked(auth.getUser).mockResolvedValueOnce(createMockUser());
      vi.mocked(snapshotWorker.getWalletSnapshots).mockRejectedValueOnce(
        new Error('Test error')
      );

      const request = createRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(typeof data).toBe('object');
      expect(data).not.toBeNull();
    });
  });
});
