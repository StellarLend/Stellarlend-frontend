import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../../app/api/notifications/route';
import { PATCH } from '../../app/api/notifications/[id]/route';
import { clearStore } from './repository';

// ---------------------------------------------------------------------------
// Auth mock – replaces lib/auth so we can control authentication in tests
// ---------------------------------------------------------------------------
vi.mock('@/lib/auth', () => ({
  getUser: vi.fn(),
}));

import { getUser } from '@/lib/auth';
const mockGetUser = vi.mocked(getUser);

const MOCK_USER = { id: 'user-test-1', email: 'test@example.com', name: 'Test User', walletAddress: null, createdAt: new Date() };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

// ---------------------------------------------------------------------------
describe('GET /api/notifications', () => {
  beforeEach(() => {
    clearStore();
    mockGetUser.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns notifications and unreadCount for an authenticated user', async () => {
    mockGetUser.mockResolvedValue(MOCK_USER);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.notifications)).toBe(true);
    expect(body.notifications.length).toBeGreaterThan(0);
    expect(typeof body.unreadCount).toBe('number');
    expect(body.unreadCount).toBe(
      body.notifications.filter((n: { read: boolean }) => !n.read).length,
    );
  });

  it('seeds demo notifications for a new user', async () => {
    mockGetUser.mockResolvedValue(MOCK_USER);
    const res = await GET();
    const body = await res.json();
    // Seeded data contains exactly 3 items: 2 unread + 1 read
    expect(body.notifications).toHaveLength(3);
    expect(body.unreadCount).toBe(2);
  });

  it('notification items have the expected shape', async () => {
    mockGetUser.mockResolvedValue(MOCK_USER);
    const res = await GET();
    const body = await res.json();
    const n = body.notifications[0];
    expect(n).toHaveProperty('id');
    expect(n).toHaveProperty('title');
    expect(n).toHaveProperty('message');
    expect(n).toHaveProperty('read');
    expect(n).toHaveProperty('createdAt');
    expect(n).toHaveProperty('type');
    expect(n.userId).toBe(MOCK_USER.id);
  });
});

// ---------------------------------------------------------------------------
describe('PATCH /api/notifications/:id', () => {
  beforeEach(() => {
    clearStore();
    mockGetUser.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/notifications/notif-1', { method: 'PATCH' });
    const res = await PATCH(req, makeParams('notif-1'));
    expect(res.status).toBe(401);
  });

  it('marks a notification as read and returns it', async () => {
    mockGetUser.mockResolvedValue(MOCK_USER);

    // Verify the notification starts as unread
    const listRes = await GET();
    const listBody = await listRes.json();
    const target = listBody.notifications.find((n: { id: string }) => n.id === 'notif-1');
    expect(target.read).toBe(false);

    const req = new NextRequest('http://localhost/api/notifications/notif-1', { method: 'PATCH' });
    const res = await PATCH(req, makeParams('notif-1'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.notification.id).toBe('notif-1');
    expect(body.notification.read).toBe(true);
  });

  it('reflects the updated read state in subsequent GET', async () => {
    mockGetUser.mockResolvedValue(MOCK_USER);

    const req = new NextRequest('http://localhost/api/notifications/notif-2', { method: 'PATCH' });
    await PATCH(req, makeParams('notif-2'));

    const listRes = await GET();
    const listBody = await listRes.json();
    const updated = listBody.notifications.find((n: { id: string }) => n.id === 'notif-2');
    expect(updated.read).toBe(true);
    // unreadCount should now be 1 (only notif-1 unread)
    expect(listBody.unreadCount).toBe(1);
  });

  it('returns 404 for an unknown notification id', async () => {
    mockGetUser.mockResolvedValue(MOCK_USER);
    const req = new NextRequest('http://localhost/api/notifications/does-not-exist', { method: 'PATCH' });
    const res = await PATCH(req, makeParams('does-not-exist'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Notification not found');
  });

  it('scopes notifications per user — one user cannot read another user\'s notifications', async () => {
    const user2 = { ...MOCK_USER, id: 'user-test-2' };

    // user-test-1 seeds their own store
    mockGetUser.mockResolvedValue(MOCK_USER);
    await GET();

    // user-test-2 tries to mark user-test-1's notif-1 as read
    mockGetUser.mockResolvedValue(user2);
    const req = new NextRequest('http://localhost/api/notifications/notif-1', { method: 'PATCH' });
    const res = await PATCH(req, makeParams('notif-1'));
    // user-test-2 has their own seeded notif-1 so this succeeds — but it only
    // affects user-test-2's copy, not user-test-1's
    expect(res.status).toBe(200);

    // Verify user-test-1's notif-1 is still unread
    mockGetUser.mockResolvedValue(MOCK_USER);
    const listRes = await GET();
    const listBody = await listRes.json();
    const u1notif = listBody.notifications.find((n: { id: string }) => n.id === 'notif-1');
    expect(u1notif.read).toBe(false);
  });
});
