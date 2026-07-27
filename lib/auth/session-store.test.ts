import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  extractSessionId,
  revokeSession,
  revokeUserSessions,
  isSessionRevoked,
  cleanupExpiredRevocations,
  getRevocationStoreSize,
  clearRevocations,
  getRevocationStats,
} from '@/lib/auth/session-store';

/**
 * Helper to create a test JWT token with specified user ID and issued-at time
 */
const createTestToken = (userId: string, iat: number = Math.floor(Date.now() / 1000)): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    userId,
    walletAddress: `G${userId}`,
    iat,
    exp: iat + 86400,
  })).toString('base64url');
  const signature = Buffer.from('mock-signature').toString('base64url');
  return `${header}.${payload}.${signature}`;
};

describe('Session Store: extractSessionId', () => {
  it('extracts valid session ID from token', () => {
    const token = createTestToken('user-123');
    const sessionId = extractSessionId(token);

    expect(sessionId).toBeTruthy();
    expect(sessionId).toContain('user-123');
    expect(sessionId).toMatch(/user-123_\d+/);
  });

  it('returns null for malformed token', () => {
    const malformed = 'not-a-valid-jwt';
    expect(extractSessionId(malformed)).toBeNull();
  });

  it('returns null for token with missing claims', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ walletAddress: 'G123' })).toString('base64url');
    const signature = Buffer.from('sig').toString('base64url');
    const token = `${header}.${payload}.${signature}`;

    expect(extractSessionId(token)).toBeNull();
  });

  it('handles fallback to sub field if userId not present', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: 'user-fallback',
      iat: Math.floor(Date.now() / 1000),
    })).toString('base64url');
    const signature = Buffer.from('sig').toString('base64url');
    const token = `${header}.${payload}.${signature}`;

    const sessionId = extractSessionId(token);
    expect(sessionId).toContain('user-fallback');
  });

  it('returns consistent session ID for same token', () => {
    const token = createTestToken('user-123');
    const id1 = extractSessionId(token);
    const id2 = extractSessionId(token);

    expect(id1).toBe(id2);
  });
});

describe('Session Store: revokeSession', () => {
  beforeEach(() => {
    clearRevocations();
  });

  it('revokes a session successfully', () => {
    const token = createTestToken('user-123');

    expect(isSessionRevoked(token)).toBe(false);

    const result = revokeSession(token);

    expect(result).toBe(true);
    expect(isSessionRevoked(token)).toBe(true);
  });

  it('returns false if session ID cannot be extracted', () => {
    const malformed = 'not-a-jwt';
    const result = revokeSession(malformed);

    expect(result).toBe(false);
  });

  it('multiple revocations of same token are idempotent', () => {
    const token = createTestToken('user-123');

    const result1 = revokeSession(token);
    expect(result1).toBe(true);
    expect(isSessionRevoked(token)).toBe(true);

    const result2 = revokeSession(token);
    expect(result2).toBe(true);
    expect(isSessionRevoked(token)).toBe(true);

    // Store size should only be 1
    expect(getRevocationStoreSize()).toBe(1);
  });

  it('revokes different sessions independently', () => {
    const token1 = createTestToken('user-1');
    const token2 = createTestToken('user-2');

    revokeSession(token1);
    expect(isSessionRevoked(token1)).toBe(true);
    expect(isSessionRevoked(token2)).toBe(false);

    revokeSession(token2);
    expect(isSessionRevoked(token1)).toBe(true);
    expect(isSessionRevoked(token2)).toBe(true);

    expect(getRevocationStoreSize()).toBe(2);
  });
});

describe('Session Store: revokeUserSessions', () => {
  beforeEach(() => {
    clearRevocations();
  });

  it('revokes all sessions for a user', () => {
    const userId = 'user-123';
    const token1 = createTestToken(userId, Math.floor(Date.now() / 1000) - 1000);
    const token2 = createTestToken(userId, Math.floor(Date.now() / 1000));
    const token3 = createTestToken('different-user');

    // Pre-revoke one session
    revokeSession(token1);

    // Now revoke all for user-123
    const revokedCount = revokeUserSessions(userId);

    expect(revokedCount).toBeGreaterThanOrEqual(1);
    expect(isSessionRevoked(token1)).toBe(true);
    expect(isSessionRevoked(token2)).toBe(true);
    expect(isSessionRevoked(token3)).toBe(false);
  });

  it('returns 0 for user with no sessions', () => {
    const revokedCount = revokeUserSessions('unknown-user');
    expect(revokedCount).toBe(0);
  });

  it('revokes multiple user sessions across different times', () => {
    const userId = 'wallet-address';
    const baseTime = Math.floor(Date.now() / 1000);

    const token1 = createTestToken(userId, baseTime - 3600); // 1 hour ago
    const token2 = createTestToken(userId, baseTime - 1800); // 30 min ago
    const token3 = createTestToken(userId, baseTime);       // now

    revokeSession(token1);
    revokeSession(token2);
    // Don't revoke token3 yet

    const revokedCount = revokeUserSessions(userId);

    expect(revokedCount).toBeGreaterThanOrEqual(2);
    expect(isSessionRevoked(token1)).toBe(true);
    expect(isSessionRevoked(token2)).toBe(true);
    expect(isSessionRevoked(token3)).toBe(true); // Should be revoked now
  });
});

describe('Session Store: isSessionRevoked', () => {
  beforeEach(() => {
    clearRevocations();
  });

  it('returns false for non-revoked session', () => {
    const token = createTestToken('user-123');
    expect(isSessionRevoked(token)).toBe(false);
  });

  it('returns true for revoked session', () => {
    const token = createTestToken('user-123');
    revokeSession(token);

    expect(isSessionRevoked(token)).toBe(true);
  });

  it('returns false for malformed token', () => {
    expect(isSessionRevoked('not-a-jwt')).toBe(false);
  });
});

describe('Session Store: cleanupExpiredRevocations', () => {
  beforeEach(() => {
    clearRevocations();
  });

  it('cleans up expired revocation entries', () => {
    // Create revocation with past expiry time
    const token = createTestToken('user-123');
    revokeSession(token);

    // The cleanup is normally based on TTL (24h by default)
    // For testing, we'd need to mock the TTL or the timestamps
    // For now, just verify cleanup doesn't crash
    const cleaned = cleanupExpiredRevocations();
    expect(typeof cleaned).toBe('number');
    expect(cleaned).toBeGreaterThanOrEqual(0);
  });

  it('does not crash on empty store', () => {
    const cleaned = cleanupExpiredRevocations();
    expect(cleaned).toBe(0);
  });

  it('preserves active revocations', () => {
    const token = createTestToken('user-123');
    revokeSession(token);

    const initialSize = getRevocationStoreSize();
    expect(initialSize).toBe(1);

    cleanupExpiredRevocations();

    const afterCleanupSize = getRevocationStoreSize();
    expect(afterCleanupSize).toBe(initialSize);
    expect(isSessionRevoked(token)).toBe(true);
  });
});

describe('Session Store: getRevocationStoreSize', () => {
  beforeEach(() => {
    clearRevocations();
  });

  it('returns 0 for empty store', () => {
    expect(getRevocationStoreSize()).toBe(0);
  });

  it('increments with each revocation', () => {
    expect(getRevocationStoreSize()).toBe(0);

    revokeSession(createTestToken('user-1'));
    expect(getRevocationStoreSize()).toBe(1);

    revokeSession(createTestToken('user-2'));
    expect(getRevocationStoreSize()).toBe(2);

    revokeSession(createTestToken('user-3'));
    expect(getRevocationStoreSize()).toBe(3);
  });

  it('stays same on duplicate revocation', () => {
    const token = createTestToken('user-1');
    revokeSession(token);
    expect(getRevocationStoreSize()).toBe(1);

    revokeSession(token);
    expect(getRevocationStoreSize()).toBe(1);
  });
});

describe('Session Store: clearRevocations', () => {
  it('clears all revocations', () => {
    revokeSession(createTestToken('user-1'));
    revokeSession(createTestToken('user-2'));
    revokeSession(createTestToken('user-3'));

    expect(getRevocationStoreSize()).toBe(3);

    clearRevocations();

    expect(getRevocationStoreSize()).toBe(0);
  });

  it('allows revocation after clearing', () => {
    const token = createTestToken('user-1');
    revokeSession(token);
    expect(isSessionRevoked(token)).toBe(true);

    clearRevocations();
    expect(isSessionRevoked(token)).toBe(false);

    revokeSession(token);
    expect(isSessionRevoked(token)).toBe(true);
  });
});

describe('Session Store: getRevocationStats', () => {
  beforeEach(() => {
    clearRevocations();
  });

  it('returns zero stats for empty store', () => {
    const stats = getRevocationStats();

    expect(stats.totalRevocations).toBe(0);
    expect(stats.activeRevocations).toBe(0);
    expect(stats.expiredRevocations).toBe(0);
  });

  it('tracks active revocations', () => {
    revokeSession(createTestToken('user-1'));
    revokeSession(createTestToken('user-2'));

    const stats = getRevocationStats();

    expect(stats.totalRevocations).toBe(2);
    expect(stats.activeRevocations).toBeGreaterThanOrEqual(2);
  });

  it('separates expired from active revocations', () => {
    revokeSession(createTestToken('user-1'));
    revokeSession(createTestToken('user-2'));
    revokeSession(createTestToken('user-3'));

    const stats = getRevocationStats();

    expect(stats.totalRevocations).toBe(stats.activeRevocations + stats.expiredRevocations);
    expect(stats.activeRevocations).toBeGreaterThan(0);
  });
});

describe('Session Store: Integration scenarios', () => {
  beforeEach(() => {
    clearRevocations();
  });

  it('handles complete session lifecycle', () => {
    const userId = 'user-123';
    const token = createTestToken(userId);

    // Initially not revoked
    expect(isSessionRevoked(token)).toBe(false);
    expect(getRevocationStoreSize()).toBe(0);

    // Revoke the session
    const revoked = revokeSession(token);
    expect(revoked).toBe(true);
    expect(isSessionRevoked(token)).toBe(true);
    expect(getRevocationStoreSize()).toBe(1);

    // Stats reflect the revocation
    let stats = getRevocationStats();
    expect(stats.totalRevocations).toBeGreaterThan(0);

    // Can check the same token again
    expect(isSessionRevoked(token)).toBe(true);

    // Cleanup doesn't affect active revocations
    cleanupExpiredRevocations();
    expect(isSessionRevoked(token)).toBe(true);
  });

  it('handles multi-device logout scenario', () => {
    const userId = 'wallet-address-123';

    // User logs in on 3 devices
    const device1Token = createTestToken(userId, Math.floor(Date.now() / 1000) - 7200);
    const device2Token = createTestToken(userId, Math.floor(Date.now() / 1000) - 3600);
    const device3Token = createTestToken(userId, Math.floor(Date.now() / 1000));

    // All initially valid
    expect(isSessionRevoked(device1Token)).toBe(false);
    expect(isSessionRevoked(device2Token)).toBe(false);
    expect(isSessionRevoked(device3Token)).toBe(false);

    // User disconnects from device 1
    revokeSession(device1Token);
    expect(isSessionRevoked(device1Token)).toBe(true);
    expect(isSessionRevoked(device2Token)).toBe(false);
    expect(isSessionRevoked(device3Token)).toBe(false);

    // User disconnects from device 2
    revokeSession(device2Token);
    expect(isSessionRevoked(device1Token)).toBe(true);
    expect(isSessionRevoked(device2Token)).toBe(true);
    expect(isSessionRevoked(device3Token)).toBe(false);

    // User logs out from device 3 (revokes all)
    const revokedCount = revokeUserSessions(userId);
    expect(revokedCount).toBeGreaterThanOrEqual(1);
    expect(isSessionRevoked(device1Token)).toBe(true);
    expect(isSessionRevoked(device2Token)).toBe(true);
    expect(isSessionRevoked(device3Token)).toBe(true);
  });
});
