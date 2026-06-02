import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { chaosInject } from '@/lib/chaos/inject';

// Mock logger to silence output
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

function mockRequest(headers: Record<string, string> = {}): NextRequest {
  return {
    headers: new Headers(headers),
    nextUrl: { pathname: '/test' } as any,
    // @ts-ignore minimal implementation
    method: 'GET',
  } as any;
}

describe('chaosInject middleware', () => {
  it('returns null when disabled', async () => {
    process.env.ENABLE_CHAOS_INJECTION = 'false';
    const req = mockRequest({ 'x-chaos-inject': JSON.stringify({ latency: 10 }) });
    const result = await chaosInject(req as any);
    expect(result).toBeNull();
  });

  it('injects latency', async () => {
    process.env.ENABLE_CHAOS_INJECTION = 'true';
    const start = Date.now();
    const req = mockRequest({ 'x-chaos-inject': JSON.stringify({ latency: 50 }) });
    const result = await chaosInject(req as any);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(result).toBeNull();
  });

  it('injects rate limit response', async () => {
    process.env.ENABLE_CHAOS_INJECTION = 'true';
    const req = mockRequest({ 'x-chaos-inject': JSON.stringify({ rateLimit: 1 }) });
    const result = await chaosInject(req as any);
    expect(result?.status).toBe(429);
  });

  it('injects 5xx error', async () => {
    process.env.ENABLE_CHAOS_INJECTION = 'true';
    const req = mockRequest({ 'x-chaos-inject': JSON.stringify({ status: 502 }) });
    const result = await chaosInject(req as any);
    expect(result?.status).toBe(502);
  });
});
