import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/account/sessions/route';
import { DELETE } from '@/app/api/account/sessions/[id]/route';
import { addStoredSession, clearStoredSessions, getStoredSession } from '@/lib/auth/session-store';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession,
}));

function makeRequest(url: string, method: 'GET' | 'DELETE' = 'GET'): NextRequest {
  return new NextRequest(url, { method });
}

describe('Sessions API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearStoredSessions();
  });

  describe('GET /api/account/sessions', () => {
    it('returns 401 if unauthorized', async () => {
      mockGetSession.mockResolvedValue(null);
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it('returns empty array if no sessions are stored', async () => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.sessions).toEqual([]);
    });

    it('returns stored sessions and touches the current session', async () => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      const initialLastSeen = new Date(Date.now() - 60000).toISOString();

      // Add a couple of sessions for user-1
      addStoredSession({
        id: 'user-1', // current session
        userId: 'user-1',
        userAgent: 'Mozilla/5.0 Chrome',
        ipAddress: '127.0.0.1',
        createdAt: new Date().toISOString(),
        lastSeenAt: initialLastSeen,
      });

      addStoredSession({
        id: 'session-other',
        userId: 'user-1',
        userAgent: 'Mozilla/5.0 Safari',
        ipAddress: '192.168.1.1',
        createdAt: new Date().toISOString(),
        lastSeenAt: initialLastSeen,
      });

      // Add a session for user-2 (should not be returned)
      addStoredSession({
        id: 'session-user-2',
        userId: 'user-2',
        userAgent: 'Mozilla/5.0 Firefox',
        ipAddress: '10.0.0.1',
        createdAt: new Date().toISOString(),
        lastSeenAt: initialLastSeen,
      });

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.sessions).toHaveLength(2);

      const current = body.sessions.find((s: any) => s.current);
      expect(current).toBeDefined();
      expect(current.id).toBe('user-1');
      expect(current.device.userAgent).toBe('Mozilla/5.0 Chrome');
      // The current session was touched, so lastSeenAt should be updated
      expect(new Date(current.lastSeenAt).getTime()).toBeGreaterThan(new Date(initialLastSeen).getTime());

      const other = body.sessions.find((s: any) => !s.current);
      expect(other).toBeDefined();
      expect(other.id).toBe('session-other');
      expect(other.device.userAgent).toBe('Mozilla/5.0 Safari');
      // The other session was not touched
      expect(other.lastSeenAt).toBe(initialLastSeen);
    });
  });

  describe('DELETE /api/account/sessions/[id]', () => {
    it('returns 401 if unauthorized', async () => {
      mockGetSession.mockResolvedValue(null);
      const req = makeRequest('http://localhost/api/account/sessions/session-1', 'DELETE');
      const res = await DELETE(req, { params: { id: 'session-1' } });
      expect(res.status).toBe(401);
    });

    it('returns 404 if session does not exist', async () => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      const req = makeRequest('http://localhost/api/account/sessions/non-existent', 'DELETE');
      const res = await DELETE(req, { params: { id: 'non-existent' } });
      expect(res.status).toBe(404);
    });

    it('returns 404 if session belongs to another user', async () => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      addStoredSession({
        id: 'session-user-2',
        userId: 'user-2',
        userAgent: 'Mozilla/5.0 Firefox',
        ipAddress: '10.0.0.1',
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      });

      const req = makeRequest('http://localhost/api/account/sessions/session-user-2', 'DELETE');
      const res = await DELETE(req, { params: { id: 'session-user-2' } });
      expect(res.status).toBe(404);
      expect(getStoredSession('session-user-2')).not.toBeNull(); // Still exists
    });

    it('returns 400 if trying to delete current session without confirm=true', async () => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      addStoredSession({
        id: 'user-1',
        userId: 'user-1',
        userAgent: 'Mozilla/5.0 Chrome',
        ipAddress: '127.0.0.1',
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      });

      const req = makeRequest('http://localhost/api/account/sessions/user-1', 'DELETE');
      const res = await DELETE(req, { params: { id: 'user-1' } });
      expect(res.status).toBe(400);
      expect(getStoredSession('user-1')).not.toBeNull(); // Still exists
    });

    it('successfully revokes current session with confirm=true', async () => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      addStoredSession({
        id: 'user-1',
        userId: 'user-1',
        userAgent: 'Mozilla/5.0 Chrome',
        ipAddress: '127.0.0.1',
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      });

      const req = makeRequest('http://localhost/api/account/sessions/user-1?confirm=true', 'DELETE');
      const res = await DELETE(req, { params: { id: 'user-1' } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.revoked).toBe(true);
      expect(getStoredSession('user-1')).toBeNull(); // Revoked
    });

    it('successfully revokes other session without confirm=true', async () => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      addStoredSession({
        id: 'session-other',
        userId: 'user-1',
        userAgent: 'Mozilla/5.0 Safari',
        ipAddress: '192.168.1.1',
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      });

      const req = makeRequest('http://localhost/api/account/sessions/session-other', 'DELETE');
      const res = await DELETE(req, { params: { id: 'session-other' } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.revoked).toBe(true);
      expect(getStoredSession('session-other')).toBeNull(); // Revoked
    });
  });
});
