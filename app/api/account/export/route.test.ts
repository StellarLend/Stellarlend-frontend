import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { resetThrottleRegistry } from '@/lib/account/export-throttle';
import { getUser } from '@/lib/auth';

vi.mock('@/lib/auth');

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/account/export', {
    method: 'POST',
    headers: {
      'x-csrf-token': 'csrf-cookie-value',
      cookie: 'csrf-token=csrf-cookie-value',
    },
  });
}

describe('GDPR DSAR Account Export API Route Flow', () => {
  beforeEach(() => {
    resetThrottleRegistry();
    vi.clearAllMocks();
  });

  it('returns 401 when the caller is not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain('Unauthorized');
  });

  it('accepts a valid authenticated request and returns a 202 with a signed download URL', async () => {
    vi.mocked(getUser).mockResolvedValue({ id: 'user-123', email: 'user@example.com' } as any);

    const response = await POST(makeRequest());

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.downloadUrl).toContain('https://storage.stellarlend.com/exports/');
    expect(body.expiresInSeconds).toBe(900);
  });

  it('rate-limits repeated requests for the same user within 24 hours', async () => {
    vi.mocked(getUser).mockResolvedValue({ id: 'user-123', email: 'user@example.com' } as any);

    const firstResponse = await POST(makeRequest());
    const secondResponse = await POST(makeRequest());

    expect(firstResponse.status).toBe(202);
    expect(secondResponse.status).toBe(429);
    const body = await secondResponse.json();
    expect(body.error).toContain('DSAR export rate limit exceeded');
  });

  it('uses a separate throttle window for each authenticated user', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-123', email: 'user1@example.com' } as any);
    const firstResponse = await POST(makeRequest());

    vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-456', email: 'user2@example.com' } as any);
    const secondResponse = await POST(makeRequest());

    expect(firstResponse.status).toBe(202);
    expect(secondResponse.status).toBe(202);
    const body = await secondResponse.json();
    expect(body.success).toBe(true);
  });
});
