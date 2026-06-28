import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE } from './route';

// ── mocks ──────────────────────────────────────────────────────────────────

const mockGetSession = vi.fn();
const mockGetStoredSession = vi.fn();
const mockRevokeStoredSession = vi.fn();

vi.mock('@/lib/auth', () => ({ getSession: mockGetSession }));
vi.mock('@/lib/auth/session-store', () => ({
  getStoredSession: mockGetStoredSession,
  revokeStoredSession: mockRevokeStoredSession,
}));

// ── helpers ────────────────────────────────────────────────────────────────

function makeRequest(sessionId: string, confirm?: string): NextRequest {
  const url = confirm
    ? `http://localhost/api/account/sessions/${sessionId}?confirm=${confirm}`
    : `http://localhost/api/account/sessions/${sessionId}`;
  return new NextRequest(url, { method: 'DELETE' });
}

function makeContext(id: string) {
  return { params: { id } };
}

function makeStoredSession(id: string, userId: string) {
  return { id, userId, userAgent: 'Chrome', ipAddress: '127.0.0.1', createdAt: '2025-01-01T00:00:00Z', lastSeenAt: '2025-01-02T00:00:00Z' };
}

const SESSION_USER_A = { user: { id: 'user-a' } };

// ── tests ──────────────────────────────────────────────────────────────────

describe('DELETE /api/account/sessions/[id]', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  // ── unauthorized ──────────────────────────────────────────────────────

  it('returns 401 when no session exists', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await DELETE(makeRequest('sess-1'), makeContext('sess-1'));

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 401 when session has no user id', async () => {
    mockGetSession.mockResolvedValue({ user: {} });

    const res = await DELETE(makeRequest('sess-1'), makeContext('sess-1'));

    expect(res.status).toBe(401);
  });

  // ── not found / foreign session ───────────────────────────────────────

  it('returns 404 when target session does not exist', async () => {
    mockGetSession.mockResolvedValue(SESSION_USER_A);
    mockGetStoredSession.mockReturnValue(null);

    const res = await DELETE(makeRequest('non-existent'), makeContext('non-existent'));

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'Session not found' });
  });

  it('returns 404 when the session belongs to a different user (foreign session)', async () => {
    mockGetSession.mockResolvedValue(SESSION_USER_A);
    mockGetStoredSession.mockReturnValue(makeStoredSession('sess-foreign', 'user-b'));

    const res = await DELETE(makeRequest('sess-foreign'), makeContext('sess-foreign'));

    expect(res.status).toBe(404);
    expect(mockRevokeStoredSession).not.toHaveBeenCalled();
  });

  // ── current-session guard ─────────────────────────────────────────────

  it('returns 400 when revoking the current session without confirm=true', async () => {
    // The route considers it "current" when target.id === session.user.id
    mockGetSession.mockResolvedValue(SESSION_USER_A);
    mockGetStoredSession.mockReturnValue(makeStoredSession('user-a', 'user-a'));

    const res = await DELETE(makeRequest('user-a'), makeContext('user-a'));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('confirm') });
    expect(mockRevokeStoredSession).not.toHaveBeenCalled();
  });

  it('revokes the current session when confirm=true is provided', async () => {
    mockGetSession.mockResolvedValue(SESSION_USER_A);
    mockGetStoredSession.mockReturnValue(makeStoredSession('user-a', 'user-a'));

    const res = await DELETE(makeRequest('user-a', 'true'), makeContext('user-a'));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ revoked: true });
    expect(mockRevokeStoredSession).toHaveBeenCalledWith('user-a');
  });

  // ── successful revoke ─────────────────────────────────────────────────

  it('revokes a non-current session and returns { revoked: true }', async () => {
    mockGetSession.mockResolvedValue(SESSION_USER_A);
    mockGetStoredSession.mockReturnValue(makeStoredSession('sess-other', 'user-a'));

    const res = await DELETE(makeRequest('sess-other'), makeContext('sess-other'));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ revoked: true });
    expect(mockRevokeStoredSession).toHaveBeenCalledWith('sess-other');
  });

  it('does not revoke sessions belonging to other users', async () => {
    mockGetSession.mockResolvedValue(SESSION_USER_A);
    mockGetStoredSession.mockReturnValue(makeStoredSession('sess-b', 'user-b'));

    await DELETE(makeRequest('sess-b'), makeContext('sess-b'));

    expect(mockRevokeStoredSession).not.toHaveBeenCalled();
  });

  // ── audit event ───────────────────────────────────────────────────────

  it('emits an audit event on successful revoke', async () => {
    mockGetSession.mockResolvedValue(SESSION_USER_A);
    mockGetStoredSession.mockReturnValue(makeStoredSession('sess-other', 'user-a'));

    await DELETE(makeRequest('sess-other'), makeContext('sess-other'));

    expect(consoleSpy).toHaveBeenCalledWith(
      'audit.session.revoked',
      expect.objectContaining({
        sessionId: 'sess-other',
        userId: 'user-a',
        revokedAt: expect.any(String),
      })
    );
  });

  it('does not emit an audit event when revoke is rejected (unauthorized)', async () => {
    mockGetSession.mockResolvedValue(null);

    await DELETE(makeRequest('sess-1'), makeContext('sess-1'));

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('does not emit an audit event when target session is not found', async () => {
    mockGetSession.mockResolvedValue(SESSION_USER_A);
    mockGetStoredSession.mockReturnValue(null);

    await DELETE(makeRequest('sess-ghost'), makeContext('sess-ghost'));

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  // ── already-revoked (idempotent) ──────────────────────────────────────

  it('calling revoke a second time still succeeds (idempotent behaviour from route perspective)', async () => {
    mockGetSession.mockResolvedValue(SESSION_USER_A);
    // Simulate the session still being findable after first revoke (store doesn't remove it)
    mockGetStoredSession.mockReturnValue(makeStoredSession('sess-other', 'user-a'));

    const res1 = await DELETE(makeRequest('sess-other'), makeContext('sess-other'));
    const res2 = await DELETE(makeRequest('sess-other'), makeContext('sess-other'));

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(mockRevokeStoredSession).toHaveBeenCalledTimes(2);
  });
});
