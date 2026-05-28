import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, POST } from '@/app/api/auth/session/route';
import { globalCache } from '@/lib/cache';

const makeRequest = (body: unknown, headers: Record<string, string> = {}) => {
  return new NextRequest('http://localhost/api/auth/session', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
};

beforeEach(() => {
  globalCache.clear();
});

describe('POST /api/auth/session', () => {
  it('replays the original session response for duplicate idempotency keys', async () => {
    const body = {
      userId: 'user-123',
      email: 'user@example.com',
      name: 'Jane Doe',
      walletAddress: 'G123',
    };

    const first = await POST(makeRequest(body, { 'Idempotency-Key': 'session-123' }));
    expect(first.status).toBe(200);
    expect(first.headers.getSetCookie()).toBeTruthy();
    const firstBody = await first.json();

    const duplicate = await POST(makeRequest(body, { 'Idempotency-Key': 'session-123' }));
    expect(duplicate.status).toBe(200);
    expect(duplicate.headers.getSetCookie()).toEqual(first.headers.getSetCookie());
    const duplicateBody = await duplicate.json();

    expect(duplicateBody).toEqual(firstBody);
  });
});

describe('DELETE /api/auth/session', () => {
  it('replays the original clear-session response for duplicate idempotency keys', async () => {
    const request = new NextRequest('http://localhost/api/auth/session', {
      method: 'DELETE',
      headers: {
        'Idempotency-Key': 'session-clear-123',
      },
    });

    const first = await DELETE(request);
    expect(first.status).toBe(200);
    expect(first.headers.getSetCookie()).toBeTruthy();

    const duplicate = await DELETE(request);
    expect(duplicate.status).toBe(200);
    expect(duplicate.headers.getSetCookie()).toEqual(first.headers.getSetCookie());
  });
});
