import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';
import { vi, describe, it, expect } from 'vitest';
import * as auth from '@/lib/auth';

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }));

function mockRequest(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe('auth middleware', () => {
  it('redirects unauthenticated page request to /login', async () => {
    vi.mocked(auth.getUser).mockResolvedValueOnce(null as any);
    const res = await middleware(mockRequest('/dashboard'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('returns 401 for unauthenticated API request', async () => {
    vi.mocked(auth.getUser).mockResolvedValueOnce(null as any);
    const res = await middleware(mockRequest('/dashboard/api/positions'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('allows authenticated request to proceed', async () => {
    vi.mocked(auth.getUser).mockResolvedValueOnce({ name: 'Jane' } as any);
    const res = await middleware(mockRequest('/dashboard'));
    expect(res.status).toBe(200);
  });

  it('passes through public routes unchanged', async () => {
    vi.mocked(auth.getUser).mockResolvedValueOnce(null as any);
    const res = await middleware(mockRequest('/health'));
    expect(res.status).toBe(200);
  });
});
