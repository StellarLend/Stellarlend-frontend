import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/lib/notifications/repository', () => ({
  markNotificationRead: vi.fn(),
}));

vi.mock('@/lib/api/handler', () => ({
  withCsrfProtection: <T extends (...args: any[]) => any>(handler: T) => handler,
}));

import { PATCH } from './route';
import { getUser } from '@/lib/auth';
import { markNotificationRead } from '@/lib/notifications/repository';
import type { Notification } from '@/lib/notifications/types';

const mockGetUser = vi.mocked(getUser);
const mockMarkNotificationRead = vi.mocked(markNotificationRead);

function patchRequest(id = 'notif-1') {
  return new NextRequest(`http://localhost:3000/api/notifications/${id}`, {
    method: 'PATCH',
  });
}

function routeContext(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-1',
    userId: 'user-1',
    title: 'Deposit Confirmed',
    message: 'Your deposit has been confirmed.',
    read: true,
    createdAt: '2026-05-26T10:00:00.000Z',
    type: 'success',
    ...overrides,
  };
}

describe('PATCH /api/notifications/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when the user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce(null as any);

    const response = await PATCH(patchRequest(), routeContext('notif-1'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(mockMarkNotificationRead).not.toHaveBeenCalled();
  });

  it('returns 400 for a blank notification id', async () => {
    mockGetUser.mockResolvedValueOnce({ id: 'user-1' } as any);

    const response = await PATCH(patchRequest('blank'), routeContext('   '));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid notification id' });
    expect(mockMarkNotificationRead).not.toHaveBeenCalled();
  });

  it('marks the current user notification read and returns the updated record', async () => {
    const updated = notification();
    mockGetUser.mockResolvedValueOnce({ id: 'user-1' } as any);
    mockMarkNotificationRead.mockResolvedValueOnce(updated);

    const response = await PATCH(patchRequest(), routeContext('notif-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockMarkNotificationRead).toHaveBeenCalledWith('user-1', 'notif-1');
    expect(body).toEqual({ notification: updated });
  });

  it('trims the route id before sending it to the repository', async () => {
    const updated = notification({ id: 'notif-trimmed' });
    mockGetUser.mockResolvedValueOnce({ id: 'user-1' } as any);
    mockMarkNotificationRead.mockResolvedValueOnce(updated);

    const response = await PATCH(patchRequest('notif-trimmed'), routeContext(' notif-trimmed '));

    expect(response.status).toBe(200);
    expect(mockMarkNotificationRead).toHaveBeenCalledWith('user-1', 'notif-trimmed');
  });

  it('returns 404 when the notification id is unknown for the current user', async () => {
    mockGetUser.mockResolvedValueOnce({ id: 'user-1' } as any);
    mockMarkNotificationRead.mockResolvedValueOnce(null);

    const response = await PATCH(patchRequest('missing'), routeContext('missing'));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Notification not found' });
  });

  it('does not expose another user notification when the repository denies ownership', async () => {
    mockGetUser.mockResolvedValueOnce({ id: 'user-2' } as any);
    mockMarkNotificationRead.mockResolvedValueOnce(null);

    const response = await PATCH(patchRequest('notif-1'), routeContext('notif-1'));

    expect(response.status).toBe(404);
    expect(mockMarkNotificationRead).toHaveBeenCalledWith('user-2', 'notif-1');
  });
});
