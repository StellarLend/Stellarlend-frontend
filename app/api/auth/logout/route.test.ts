import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, DELETE } from '@/app/api/auth/logout/route';
import { createSession, setSessionCookie, getSession } from '@/lib/auth';
import { revokeSession, isSessionRevoked, clearRevocations, getRevocationStats } from '@/lib/auth/session-store';
import { Keypair } from '@stellar/stellar-sdk';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual('@/lib/auth');
  return {
    ...actual,
    getSession: vi.fn(),
    setSessionCookie: vi.fn(),
  };
});

// Mock wallet verification
vi.mock('@/lib/auth/wallet', () => ({
  verifyWalletSignature: vi.fn().mockResolvedValue('GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'),
}));

const createMockRequest = (method: string = 'POST'): NextRequest => {
  return new NextRequest('http://localhost:3000/api/auth/logout', {
    method,
  });
};

// Generate a valid test token (since we can't easily create real JWT with mocks)
const createTestToken = (userId: string = 'user-123', walletAddress: string = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', iatOffset: number = 0) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000) + iatOffset;
  const payload = Buffer.from(JSON.stringify({
    userId,
    walletAddress,
    iat: now,
    exp: now + 86400,
  })).toString('base64url');
  const signature = Buffer.from('mock-signature').toString('base64url');
  return `${header}.${payload}.${signature}`;
};

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRevocations();
  });

  afterEach(() => {
    clearRevocations();
  });

  it('returns 401 if no active session', async () => {
    const { cookies } = await import('next/headers');
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn(),
    } as any);

    const { getSession } = await import('@/lib/auth');
    vi.mocked(getSession).mockResolvedValue(null);

    const request = createMockRequest('POST');
    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('No active session');
  });

  it('successfully logs out authenticated user', async () => {
    const { cookies: cookiesMock } = await import('next/headers');
    const { getSession: getSessionMock } = await import('@/lib/auth');

    const testToken = createTestToken();
    const walletAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

    vi.mocked(getSessionMock).mockResolvedValue({
      user: {
        id: 'user-123',
        walletAddress,
        email: 'user@example.com',
        name: 'Test User',
        createdAt: new Date(),
      },
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    } as any);

    vi.mocked(cookiesMock).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: testToken }),
      delete: vi.fn(),
    } as any);

    const request = createMockRequest('POST');
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('Logged out');
    expect(body.walletAddress).toBe(walletAddress);

    // Verify session was revoked
    expect(isSessionRevoked(testToken)).toBe(true);
  });

  it('clears the session cookie on logout', async () => {
    const { cookies: cookiesMock } = await import('next/headers');
    const { getSession: getSessionMock } = await import('@/lib/auth');

    const testToken = createTestToken();
    const mockCookieStore = {
      get: vi.fn().mockReturnValue({ value: testToken }),
      delete: vi.fn(),
    };

    vi.mocked(cookiesMock).mockResolvedValue(mockCookieStore as any);
    vi.mocked(getSessionMock).mockResolvedValue({
      user: {
        id: 'user-123',
        walletAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        email: 'user@example.com',
        name: 'Test User',
        createdAt: new Date(),
      },
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    } as any);

    const request = createMockRequest('POST');
    const response = await POST(request);

    expect(response.status).toBe(200);

    // Verify cookie was deleted in response
    const setCookieHeaders = response.headers.getSetCookie();
    expect(setCookieHeaders).toBeDefined();
    expect(setCookieHeaders.some(header => header.includes('session='))).toBeTruthy();
  });

  it('handles missing session cookie gracefully', async () => {
    const { cookies: cookiesMock } = await import('next/headers');
    const { getSession: getSessionMock } = await import('@/lib/auth');

    const walletAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

    vi.mocked(getSessionMock).mockResolvedValue({
      user: {
        id: 'user-123',
        walletAddress,
        email: 'user@example.com',
        name: 'Test User',
        createdAt: new Date(),
      },
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    } as any);

    vi.mocked(cookiesMock).mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined), // No session cookie
      delete: vi.fn(),
    } as any);

    const request = createMockRequest('POST');
    const response = await POST(request);

    // Should still logout successfully even without a cookie to revoke
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it('returns correct response structure with wallet address for UI state', async () => {
    const { cookies: cookiesMock } = await import('next/headers');
    const { getSession: getSessionMock } = await import('@/lib/auth');

    const testToken = createTestToken();
    const walletAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

    vi.mocked(getSessionMock).mockResolvedValue({
      user: {
        id: 'user-123',
        walletAddress,
        email: 'user@example.com',
        name: 'Test User',
        createdAt: new Date(),
      },
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    } as any);

    vi.mocked(cookiesMock).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: testToken }),
      delete: vi.fn(),
    } as any);

    const request = createMockRequest('POST');
    const response = await POST(request);

    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      message: expect.any(String),
      walletAddress: expect.any(String),
    });
    expect(body.walletAddress).toBe(walletAddress);
  });

  it('handles errors gracefully and returns 500', async () => {
    const { cookies: cookiesMock } = await import('next/headers');

    vi.mocked(cookiesMock).mockRejectedValue(new Error('Cookie error'));

    const request = createMockRequest('POST');
    const response = await POST(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Failed to logout');
  });

  it('successfully revokes session by extracting token from cookies', async () => {
    const { cookies: cookiesMock } = await import('next/headers');
    const { getSession: getSessionMock } = await import('@/lib/auth');

    const userId = 'user-123';
    const testToken = createTestToken(userId);

    vi.mocked(getSessionMock).mockResolvedValue({
      user: {
        id: userId,
        walletAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        email: 'user@example.com',
        name: 'Test User',
        createdAt: new Date(),
      },
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    } as any);

    vi.mocked(cookiesMock).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: testToken }),
      delete: vi.fn(),
    } as any);

    // Before logout
    expect(isSessionRevoked(testToken)).toBe(false);

    const request = createMockRequest('POST');
    const response = await POST(request);

    expect(response.status).toBe(200);

    // After logout
    expect(isSessionRevoked(testToken)).toBe(true);
  });

  it('tracks revocation statistics correctly', async () => {
    const { cookies: cookiesMock } = await import('next/headers');
    const { getSession: getSessionMock } = await import('@/lib/auth');

    const testToken1 = createTestToken('user-1');
    const testToken2 = createTestToken('user-2');

    vi.mocked(getSessionMock).mockResolvedValue({
      user: {
        id: 'user-1',
        walletAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        email: 'user@example.com',
        name: 'Test User',
        createdAt: new Date(),
      },
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    } as any);

    // First logout
    vi.mocked(cookiesMock).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: testToken1 }),
      delete: vi.fn(),
    } as any);

    let request = createMockRequest('POST');
    await POST(request);

    let stats = getRevocationStats();
    expect(stats.activeRevocations).toBe(1);

    // Second logout
    vi.mocked(cookiesMock).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: testToken2 }),
      delete: vi.fn(),
    } as any);

    request = createMockRequest('POST');
    await POST(request);

    stats = getRevocationStats();
    expect(stats.activeRevocations).toBe(2);
  });
});

describe('DELETE /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRevocations();
  });

  afterEach(() => {
    clearRevocations();
  });

  it('delegates to POST handler', async () => {
    const { cookies: cookiesMock } = await import('next/headers');
    const { getSession: getSessionMock } = await import('@/lib/auth');

    const testToken = createTestToken();
    const walletAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

    vi.mocked(getSessionMock).mockResolvedValue({
      user: {
        id: 'user-123',
        walletAddress,
        email: 'user@example.com',
        name: 'Test User',
        createdAt: new Date(),
      },
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    } as any);

    vi.mocked(cookiesMock).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: testToken }),
      delete: vi.fn(),
    } as any);

    const request = createMockRequest('DELETE');
    const response = await DELETE(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(isSessionRevoked(testToken)).toBe(true);
  });

  it('returns 401 if no active session when using DELETE', async () => {
    const { cookies: cookiesMock } = await import('next/headers');
    const { getSession: getSessionMock } = await import('@/lib/auth');

    vi.mocked(getSessionMock).mockResolvedValue(null);
    vi.mocked(cookiesMock).mockResolvedValue({
      get: vi.fn(),
    } as any);

    const request = createMockRequest('DELETE');
    const response = await DELETE(request);

    expect(response.status).toBe(401);
  });
});

describe('Session revocation store integration', () => {
  beforeEach(() => {
    clearRevocations();
  });

  it('multiple tokens from same user are tracked independently', () => {
    const userId = 'user-123';
    const token1 = createTestToken(userId, undefined, 0);
    const token2 = createTestToken(userId, undefined, 10);

    // Tokens should be different (different iat)
    expect(token1).not.toBe(token2);

    revokeSession(token1);
    expect(isSessionRevoked(token1)).toBe(true);
    expect(isSessionRevoked(token2)).toBe(false);

    revokeSession(token2);
    expect(isSessionRevoked(token1)).toBe(true);
    expect(isSessionRevoked(token2)).toBe(true);
  });

  it('maintains revocation statistics through lifecycle', () => {
    const token1 = createTestToken('user-1');
    const token2 = createTestToken('user-2');
    const token3 = createTestToken('user-3');

    let stats = getRevocationStats();
    expect(stats.activeRevocations).toBe(0);

    revokeSession(token1);
    revokeSession(token2);
    stats = getRevocationStats();
    expect(stats.activeRevocations).toBe(2);
    expect(stats.totalRevocations).toBe(2);

    revokeSession(token3);
    stats = getRevocationStats();
    expect(stats.activeRevocations).toBe(3);
    expect(stats.totalRevocations).toBe(3);
  });
});
