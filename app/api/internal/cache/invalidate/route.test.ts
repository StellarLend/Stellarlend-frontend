import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const routePath = '@/app/api/internal/cache/invalidate/route';

describe('POST /api/internal/cache/invalidate', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.SERVER_TOKEN;
    delete process.env.CACHE_INVALIDATE_ALLOWED_ORIGINS;
  });

  afterEach(() => {
    // clear global cache if available
    try {
      // eslint-disable-next-line
      const { globalCache } = require('@/lib/cache');
      globalCache.clear();
    } catch {}
  });

  it('rejects unauthorized requests', async () => {
    const { POST } = await import(routePath);

    const req = new NextRequest('http://localhost/api/internal/cache/invalidate', { method: 'POST' });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('validates request body', async () => {
    process.env.SERVER_TOKEN = 'test-token-123';
    process.env.CACHE_INVALIDATE_ALLOWED_ORIGINS = 'https://deploy.stellarlend.test';
    const { POST } = await import(routePath);

    const req = new NextRequest('http://localhost/api/internal/cache/invalidate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SERVER_TOKEN}`,
        'Content-Type': 'application/json',
        'Origin': 'https://deploy.stellarlend.test',
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid request body/);
  });

  it('invalidates specified namespaces and emits logs/metrics', async () => {
    process.env.SERVER_TOKEN = 'server-token-xyz';
    process.env.CACHE_INVALIDATE_ALLOWED_ORIGINS = 'https://deploy.stellarlend.test';

    // Prepare cache
    const { globalCache } = await import('@/lib/cache');
    globalCache.set('prices:all', { foo: 'bar' }, { ttl: 1000, swr: 0 });
    globalCache.set('prices:XLM', { foo: 'baz' }, { ttl: 1000, swr: 0 });
    globalCache.set('markets:assets:XLM', { m: 1 }, { ttl: 1000, swr: 0 });

    expect(globalCache.size()).toBeGreaterThanOrEqual(3);

    // Spy on logger and console
    const { logger } = await import('@/lib/logger');
    const loggerSpy = vi.spyOn(logger, 'info');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { POST } = await import(routePath);

    const req = new NextRequest('http://localhost/api/internal/cache/invalidate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SERVER_TOKEN}`,
        'Content-Type': 'application/json',
        'Origin': 'https://deploy.stellarlend.test',
      },
      body: JSON.stringify({ namespaces: ['prices'] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.deletedCount).toBe('number');
    expect(body.deletedCount).toBeGreaterThanOrEqual(2);

    // Ensure prices keys removed, markets remains
    expect(globalCache.get('prices:all')).toBeNull();
    expect(globalCache.get('prices:XLM')).toBeNull();
    expect(globalCache.get('markets:assets:XLM')).not.toBeNull();

    expect(loggerSpy).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();

    loggerSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('rejects requests with an unexpected method', async () => {
    process.env.SERVER_TOKEN = 'server-token-xyz';
    process.env.CACHE_INVALIDATE_ALLOWED_ORIGINS = 'https://deploy.stellarlend.test';
    const { POST } = await import(routePath);

    const req = new NextRequest('http://localhost/api/internal/cache/invalidate', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SERVER_TOKEN}`,
        'Origin': 'https://deploy.stellarlend.test',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('rejects requests from a disallowed origin', async () => {
    process.env.SERVER_TOKEN = 'server-token-xyz';
    process.env.CACHE_INVALIDATE_ALLOWED_ORIGINS = 'https://deploy.stellarlend.test';
    const { POST } = await import(routePath);

    const req = new NextRequest('http://localhost/api/internal/cache/invalidate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SERVER_TOKEN}`,
        'Content-Type': 'application/json',
        'Origin': 'https://attacker.example',
      },
      body: JSON.stringify({ namespaces: ['prices'] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('rejects origin-bearing requests when the allowlist is empty', async () => {
    process.env.SERVER_TOKEN = 'server-token-xyz';
    const { POST } = await import(routePath);

    const req = new NextRequest('http://localhost/api/internal/cache/invalidate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SERVER_TOKEN}`,
        'Content-Type': 'application/json',
        'Origin': 'https://deploy.stellarlend.test',
      },
      body: JSON.stringify({ namespaces: ['prices'] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('rejects malformed bearer tokens without leaking guard details', async () => {
    process.env.SERVER_TOKEN = 'server-token-xyz';
    process.env.CACHE_INVALIDATE_ALLOWED_ORIGINS = 'https://deploy.stellarlend.test';
    const { POST } = await import(routePath);

    const req = new NextRequest('http://localhost/api/internal/cache/invalidate', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer',
        'Content-Type': 'application/json',
        'Origin': 'https://deploy.stellarlend.test',
      },
      body: JSON.stringify({ namespaces: ['prices'] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });
});
