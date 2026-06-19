import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH } from './route';
import { getUser } from '@/lib/auth';
import { markNotificationRead } from '@/lib/notifications/repository';

vi.mock('@/lib/auth', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/lib/notifications/repository', () => ({
  markNotificationRead: vi.fn(),
}));

const mockGetUser = vi.mocked(getUser);
const mockMarkNotificationRead = vi.mocked(markNotificationRead);

const user = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'Test User',
  walletAddress: null,
  createdAt: new Date('2026-06-20T00:00:00.000Z'),
} as any;

function makePatchRequest(id: string) {
  return new NextRequest(
    `http://localhost/api/notifications/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer test-token',
      },
    },
  );
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('PATCH /api/notifications/[id]', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockMarkNotificationRead.mockReset();
  });

  it('returns 401 when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue(null);

    const response = await PATCH(
      makePatchRequest('notif-1'),
      makeParams('notif-1'),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(mockMarkNotificationRead).not.toHaveBeenCalled();
  });

  it('marks the caller notification as read and returns the updated record', async () => {
    const notification = {
      id: 'notif-1',
      userId: user.id,
      title: 'Deposit Confirmed',
      message: 'Your deposit settled.',
      read: true,
      createdAt: '2026-06-20T00:00:00.000Z',
      type: 'success' as const,
    };
    mockGetUser.mockResolvedValue(user);
    mockMarkNotificationRead.mockResolvedValue(notification);

    const response = await PATCH(
      makePatchRequest('notif-1'),
      makeParams('notif-1'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ notification });
    expect(mockMarkNotificationRead).toHaveBeenCalledWith(user.id, 'notif-1');
  });

  it('trims the route id before calling the repository', async () => {
    const notification = {
      id: 'notif-2',
      userId: user.id,
      title: 'Payment Due',
      message: 'A payment is due soon.',
      read: true,
      createdAt: '2026-06-20T00:00:00.000Z',
      type: 'warning' as const,
    };
    mockGetUser.mockResolvedValue(user);
    mockMarkNotificationRead.mockResolvedValue(notification);

    const response = await PATCH(
      makePatchRequest('notif-2'),
      makeParams('  notif-2  '),
    );

    expect(response.status).toBe(200);
    expect(mockMarkNotificationRead).toHaveBeenCalledWith(user.id, 'notif-2');
  });

  it('returns 400 for a blank notification id', async () => {
    mockGetUser.mockResolvedValue(user);

    const response = await PATCH(makePatchRequest('blank'), makeParams('   '));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid notification id',
    });
    expect(mockMarkNotificationRead).not.toHaveBeenCalled();
  });

  it('returns 404 when the notification is unknown or belongs to another user', async () => {
    mockGetUser.mockResolvedValue(user);
    mockMarkNotificationRead.mockResolvedValue(null);

    const response = await PATCH(
      makePatchRequest('other-user-notif'),
      makeParams('other-user-notif'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Notification not found',
    });
    expect(mockMarkNotificationRead).toHaveBeenCalledWith(user.id, 'other-user-notif');
  });
});
