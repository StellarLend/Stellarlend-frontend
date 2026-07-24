import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

// ── mocks ──────────────────────────────────────────────────────────────────

const mockGetSession = vi.fn();
const mockListStoredSessions = vi.fn();
const mockTouchStoredSession = vi.fn();

vi.mock('@/lib/auth', () => ({ getSession: mockGetSession }));
vi.mock('@/lib/auth/session-store', () => ({
  listStoredSessions: mockListStoredSessions,
  touchStoredSession: mockTouchStoredSession,
}));

// ── helpers ────────────────────────────────────────────────────────────────

const SESSION_USER_A = { user: { id: 'user-a' } };
const SESSION_USER_B = { user: { id: 'user-b' } };

function makeStoredSession(id: string, userId: string, overrides: object = {}) {
  return {
    id,
    userId,
    userAgent: 'Mozilla/5.0',
    ipAddress: '127.0.0.1',
    createdAt: '2025-01-01T00:00:00Z',
    lastSeenAt: '2025-01-02T00:00:00Z',
    ...overrides,
  };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('GET /api/account/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no session exists', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 401 when session has no user id', async () => {
    mockGetSession.mockResolvedValue({ user: {} });

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('returns only the authenticated user\'s sessions', async () => {
    mockGetSession.mockResolvedValue(SESSION_USER_A);
    mockListStoredSessions.mockReturnValue([
      makeStoredSession('sess-1', 'user-a'),
      makeStoredSession('sess-2', 'user-a'),
    ]);

    const res = await GET();

    expect(res.status).toBe(200);
    const { sessions } = await res.json();
    expect(sessions).toHaveLength(2);
    expect(sessions.every((s: { id: string }) => ['sess-1', 'sess-2'].includes(s.id))).toBe(true);
  });

  it('calls listStoredSessions with the authenticated user id', async () => {
    mockGetSession.mockResolvedValue(SESSION_USER_A);
    mockListStoredSessions.mockReturnValue([]);

    await GET();

    expect(mockListStoredSessions).toHaveBeenCalledWith('user-a');
  });

  it('marks the current session with current: true', async () => {
    mockGetSession.mockResolvedValue(SESSION_USER_A);
    mockListStoredSessions.mockReturnValue([
      makeStoredSession('user-a', 'user-a'),   // id matches session.user.id → current
      makeStoredSession('sess-2', 'user-a'),
    ]);

    const res = await GET();
    const { sessions } = await res.json();

    const current = sessions.find((s: { current: boolean }) => s.current);
    expect(current).toBeDefined();
    expect(current.id).toBe('user-a');

    const other = sessions.find((s: { id: string }) => s.id === 'sess-2');
    expect(other.current).toBe(false);
  });

  it('touches the current session on list', async () => {
    mockGetSession.mockResolvedValue(SESSION_USER_A);
    mockListStoredSessions.mockReturnValue([]);

    await GET();

    expect(mockTouchStoredSession).toHaveBeenCalledWith('user-a');
  });

  it('returns an empty sessions array when the user has no stored sessions', async () => {
    mockGetSession.mockResolvedValue(SESSION_USER_A);
    mockListStoredSessions.mockReturnValue([]);

    const res = await GET();

    expect(res.status).toBe(200);
    const { sessions } = await res.json();
    expect(sessions).toEqual([]);
  });

  it('does not leak sessions belonging to another user', async () => {
    mockGetSession.mockResolvedValue(SESSION_USER_A);
    // listStoredSessions is expected to filter server-side; we return only user-a sessions
    mockListStoredSessions.mockReturnValue([makeStoredSession('sess-1', 'user-a')]);

    const res = await GET();
    const { sessions } = await res.json();

    expect(sessions.every((s: { id: string }) => s.id !== 'sess-user-b-data')).toBe(true);
    // Verify the call was scoped to the authenticated user
    expect(mockListStoredSessions).toHaveBeenCalledWith('user-a');
    expect(mockListStoredSessions).not.toHaveBeenCalledWith('user-b');
  });

  it('shapes each session entry correctly', async () => {
    mockGetSession.mockResolvedValue(SESSION_USER_A);
    mockListStoredSessions.mockReturnValue([makeStoredSession('sess-1', 'user-a')]);

    const res = await GET();
    const { sessions } = await res.json();
    const s = sessions[0];

    expect(s).toHaveProperty('id');
    expect(s).toHaveProperty('current');
    expect(s).toHaveProperty('device');
    expect(s.device).toHaveProperty('userAgent');
    expect(s.device).toHaveProperty('ipAddress');
    expect(s).toHaveProperty('createdAt');
    expect(s).toHaveProperty('lastSeenAt');
  });
});
