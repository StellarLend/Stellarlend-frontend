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

// ─────────────────────────────────────────────────────────────────────────────
// Per-device session store
//
// Stores one record per active device session so the Active Sessions UI can
// list, inspect, and individually revoke sessions.  The in-memory map is keyed
// by a stable, per-device session id that callers supply (typically the value
// held in session.user.id or a UUID minted at login time).
//
// In production this should be backed by Redis / the sessions DB table, but the
// interface is intentionally kept identical so the store can be swapped without
// touching the route layer.
// ─────────────────────────────────────────────────────────────────────────────

export interface StoredSession {
  /** Stable per-device identifier */
  id: string;
  /** Owning user's identifier */
  userId: string;
  /** User-Agent header captured at login */
  userAgent: string;
  /** Client IP captured at login */
  ipAddress: string;
  /** ISO-8601 timestamp when the session was first created */
  createdAt: string;
  /** ISO-8601 timestamp of the most recent activity (updated by touchStoredSession) */
  lastSeenAt: string;
}

/** In-memory per-device session store (keyed by StoredSession.id) */
const deviceSessionStore = new Map<string, StoredSession>();

/**
 * Add (or upsert) a per-device session record.
 * Callers should invoke this immediately after a successful login.
 */
export function addStoredSession(session: StoredSession): void {
  deviceSessionStore.set(session.id, { ...session });
  logger.info('Stored session added', 'session-store', { sessionId: session.id, userId: session.userId });
}

/**
 * Return the stored session with the given id, or null if it does not exist.
 */
export function getStoredSession(sessionId: string): StoredSession | null {
  return deviceSessionStore.get(sessionId) ?? null;
}

/**
 * Return all stored sessions belonging to a specific user.
 */
export function listStoredSessions(userId: string): StoredSession[] {
  const results: StoredSession[] = [];
  for (const session of deviceSessionStore.values()) {
    if (session.userId === userId) {
      results.push({ ...session });
    }
  }
  return results;
}

/**
 * Update lastSeenAt for the session with the given id.
 * No-op if the session does not exist.
 */
export function touchStoredSession(sessionId: string): void {
  const existing = deviceSessionStore.get(sessionId);
  if (existing) {
    deviceSessionStore.set(sessionId, {
      ...existing,
      lastSeenAt: new Date().toISOString(),
    });
  }
}

/**
 * Remove (revoke) the per-device session record with the given id.
 * No-op if the session does not exist (idempotent).
 */
export function revokeStoredSession(sessionId: string): void {
  deviceSessionStore.delete(sessionId);
  logger.info('Stored session revoked', 'session-store', { sessionId });
}

/**
 * Remove all per-device session records (for testing only).
 */
export function clearStoredSessions(): void {
  deviceSessionStore.clear();
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
