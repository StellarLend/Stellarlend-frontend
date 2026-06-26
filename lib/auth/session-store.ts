/**
 * Server-side session store for managing session revocation.
 * Maintains a revocation list to invalidate sessions across all devices.
 *
 * Sessions are stored with a TTL that matches the session expiry time
 * to prevent unbounded memory growth.
 */

import { logger } from '@/lib/logger';

interface RevokedSession {
  sessionId: string;
  revokedAt: number; // timestamp in ms
  expiresAt: number; // when this revocation entry should be removed
}

/**
 * In-memory revocation store
 * In production, this should be backed by Redis or similar
 */
const revocationStore = new Map<string, RevokedSession>();

/**
 * User-level revocation store tracking the last time a user's sessions were all revoked
 */
const userRevocations = new Map<string, number>();

// Session TTL in milliseconds (matches AUTH_SESSION_EXPIRY, default 24 hours)
const SESSION_TTL_MS = (parseInt(process.env.AUTH_SESSION_EXPIRY || '24', 10)) * 60 * 60 * 1000;

interface TokenPayload {
  userId: string;
  iat: number;
}

/**
 * Parses JWT token payload without signature verification
 */
export function parseTokenPayload(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );

    const userId = payload.userId || payload.sub;
    const iat = payload.iat;

    if (!userId || !iat) {
      return null;
    }

    return { userId, iat };
  } catch (error) {
    return null;
  }
}

/**
 * Extract session ID from JWT token
 * Session ID is based on the issued-at timestamp and user ID for uniqueness
 */
export function extractSessionId(token: string): string | null {
  const payload = parseTokenPayload(token);
  if (!payload) {
    return null;
  }
  return `${payload.userId}_${payload.iat}`;
}

/**
 * Revoke a session by its token
 * @param token - The session JWT token
 * @returns true if revocation was successful, false if session ID couldn't be extracted
 */
export function revokeSession(token: string): boolean {
  const sessionId = extractSessionId(token);

  if (!sessionId) {
    logger.warn('Could not extract session ID for revocation', 'session-store');
    return false;
  }

  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;

  revocationStore.set(sessionId, {
    sessionId,
    revokedAt: now,
    expiresAt,
  });

  logger.info('Session revoked', 'session-store', {
    sessionId,
    expiresAt: new Date(expiresAt).toISOString(),
  });

  return true;
}

/**
 * Revoke all sessions for a user (logout all devices)
 * @param userId - The user ID
 * @returns number of sessions revoked
 */
export function revokeUserSessions(userId: string): number {
  const now = Date.now();
  userRevocations.set(userId, now);
  let revokedCount = 0;

  // Revoke any existing sessions for this user that are in the revocationStore
  for (const [sessionId] of revocationStore) {
    if (sessionId.startsWith(`${userId}_`)) {
      const expiresAt = now + SESSION_TTL_MS;
      revocationStore.set(sessionId, {
        sessionId,
        revokedAt: now,
        expiresAt,
      });
      revokedCount++;
    }
  }

  logger.info('All user sessions revoked', 'session-store', {
    userId,
    revokedCount,
  });

  return revokedCount;
}

/**
 * Check if a session is revoked
 * @param token - The session JWT token
 * @returns true if the session is revoked, false otherwise
 */
export function isSessionRevoked(token: string): boolean {
  const payload = parseTokenPayload(token);

  if (!payload) {
    return false;
  }

  const { userId, iat } = payload;
  const userRevokedAt = userRevocations.get(userId);

  // If a user has revoked all sessions, any session issued before that revocation time is invalid
  if (userRevokedAt !== undefined && (iat * 1000) <= userRevokedAt) {
    logger.debug('Session is revoked by user-level revocation', 'session-store', { userId, iat });
    return true;
  }

  const sessionId = `${userId}_${iat}`;
  const revoked = revocationStore.has(sessionId);

  if (revoked) {
    logger.debug('Session is revoked', 'session-store', { sessionId });
  }

  return revoked;
}

/**
 * Clean up expired revocation entries
 * Should be called periodically (e.g., every hour) to prevent unbounded growth
 */
export function cleanupExpiredRevocations(): number {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [sessionId, revoked] of revocationStore) {
    if (revoked.expiresAt < now) {
      revocationStore.delete(sessionId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.info('Cleaned up expired revocation entries', 'session-store', {
      cleanedCount,
      remainingRevocations: revocationStore.size,
    });
  }

  return cleanedCount;
}

/**
 * Get the current size of the revocation store
 * Useful for monitoring and debugging
 */
export function getRevocationStoreSize(): number {
  return revocationStore.size;
}

/**
 * Clear all revocations (for testing only)
 */
export function clearRevocations(): void {
  revocationStore.clear();
  userRevocations.clear();
}

/**
 * Get revocation stats for monitoring
 */
export function getRevocationStats() {
  let expiredCount = 0;
  const now = Date.now();

  for (const revoked of revocationStore.values()) {
    if (revoked.expiresAt < now) {
      expiredCount++;
    }
  }

  return {
    totalRevocations: revocationStore.size,
    expiredRevocations: expiredCount,
    activeRevocations: revocationStore.size - expiredCount,
  };
}
