import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  getNotifications,
  addNotification,
  markNotificationRead,
  deleteNotification,
  clearStore,
} from '../repository';
import { db } from '../../db';

vi.mock('../../db', () => {
  const mockSelect = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(async () => []),
      })),
    })),
  }));

  const mockInsert = vi.fn(() => ({
    values: vi.fn(() => ({
      onConflictDoNothing: vi.fn(async () => ({})),
      onConflictDoUpdate: vi.fn(async () => ({})),
    })),
  }));

  const mockUpdate = vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => []),
      })),
    })),
  }));

  const mockDelete = vi.fn(() => (async () => ({})));

  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    },
  };
});

describe('Drizzle Notifications Repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('seeds notifications if database is empty', async () => {
    const mockSelect = vi.mocked(db.select);
    mockSelect.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(async () => []), // empty db
        })),
      })),
    } as any);

    const list = await getNotifications('user-1');
    expect(list.length).toBe(3); // Seed size is 3
    expect(db.insert).toHaveBeenCalled();
  });

  it('fetches existing notifications from the db', async () => {
    const mockRow = {
      id: 'user-1-notif-123',
      userId: 'user-1',
      title: 'Hello',
      message: 'World',
      read: false,
      createdAt: new Date(),
      type: 'info',
    };

    const mockSelect = vi.mocked(db.select);
    mockSelect.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(async () => [mockRow]),
        })),
      })),
    } as any);

    const list = await getNotifications('user-1');
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('notif-123'); // Unmapped prefix
  });

  it('coerces an invalid stored type to "info" when fetching', async () => {
    const mockRow = {
      id: 'user-1-notif-bad',
      userId: 'user-1',
      title: 'Legacy',
      message: 'Persisted before the enum existed',
      read: false,
      createdAt: new Date(),
      type: 'legacy-bogus-value', // stray value outside the Notification['type'] union
    };

    const mockSelect = vi.mocked(db.select);
    mockSelect.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(async () => [mockRow]),
        })),
      })),
    } as any);

    const list = await getNotifications('user-1');
    expect(list).toHaveLength(1);
    expect(list[0].type).toBe('info');
  });

  it('coerces an invalid stored type to "info" when marking read', async () => {
    const mockRow = {
      id: 'user-1-notif-1',
      userId: 'user-1',
      title: 'Confirmed',
      message: 'Msg',
      read: true,
      createdAt: new Date(),
      type: 'legacy-bogus-value',
    };

    const mockUpdate = vi.mocked(db.update);
    mockUpdate.mockReturnValueOnce({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => [mockRow]),
        })),
      })),
    } as any);

    const result = await markNotificationRead('user-1', 'notif-1');
    expect(result?.type).toBe('info');
  });

  it('coerces an invalid stored type to "info" when deleting', async () => {
    const mockRow = {
      id: 'user-1-notif-1',
      userId: 'user-1',
      title: 'Confirmed',
      message: 'Msg',
      read: true,
      createdAt: new Date(),
      type: 'legacy-bogus-value',
    };

    const mockDelete = vi.mocked(db.delete);
    mockDelete.mockReturnValueOnce({
      where: vi.fn(() => ({
        returning: vi.fn(async () => [mockRow]),
      })),
    } as any);

    const result = await deleteNotification('user-1', 'notif-1');
    expect(result?.type).toBe('info');
  });

  it('adds a notification successfully', async () => {
    const n = {
      id: 'notif-999',
      title: 'New Notif',
      message: 'Body',
      read: false,
      createdAt: new Date().toISOString(),
      type: 'info' as const,
    };

    const result = await addNotification('user-1', n);
    expect(result.id).toBe('notif-999');
    expect(db.insert).toHaveBeenCalled();
  });

  it('marks a notification read successfully', async () => {
    const mockRow = {
      id: 'user-1-notif-1',
      userId: 'user-1',
      title: 'Confirmed',
      message: 'Msg',
      read: true,
      createdAt: new Date(),
      type: 'success',
    };

    const mockUpdate = vi.mocked(db.update);
    mockUpdate.mockReturnValueOnce({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => [mockRow]),
        })),
      })),
    } as any);

    const result = await markNotificationRead('user-1', 'notif-1');
    expect(result).toBeDefined();
    expect(result?.read).toBe(true);
  });

  it('clears store successfully', async () => {
    await clearStore();
    expect(db.delete).toHaveBeenCalled();
  });
});
