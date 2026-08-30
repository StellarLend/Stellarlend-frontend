import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getNotifications,
  getUnreadCount,
  addNotification,
  markNotificationRead,
  clearStore,
} from '../repository';
import { db } from '../../db';

function mockSelectChain(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: vi.fn(async () => rows),
          })),
        })),
        // getUnreadCount selects without orderBy/limit/offset, so `where(...)`
        // itself must be awaitable and resolve to the row array.
        then: (resolve: (v: unknown[]) => void) => resolve(rows),
      })),
    })),
  };
}

vi.mock('../../db', () => {
  const mockSelect = vi.fn(() => mockSelectChain([]));

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
    vi.mocked(db.select).mockImplementation(() => mockSelectChain([]) as any);
  });

  it('seeds notifications if database is empty', async () => {
    vi.mocked(db.select).mockReturnValueOnce(mockSelectChain([]) as any);

    const page = await getNotifications('user-1');
    expect(page.notifications.length).toBe(3); // Seed size is 3
    expect(page.hasMore).toBe(false);
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

    vi.mocked(db.select).mockReturnValueOnce(mockSelectChain([mockRow]) as any);

    const page = await getNotifications('user-1');
    expect(page.notifications.length).toBe(1);
    expect(page.notifications[0].id).toBe('notif-123'); // Unmapped prefix
    expect(page.hasMore).toBe(false);
  });

  it('bounds the requested page size to the hard maximum', async () => {
    const rows = Array.from({ length: 101 }, (_, i) => ({
      id: `user-1-notif-${i}`,
      userId: 'user-1',
      title: `Notif ${i}`,
      message: 'Body',
      read: false,
      createdAt: new Date(),
      type: 'info',
    }));

    // Even if the caller asks for 1000, the repo caps the fetch and result.
    vi.mocked(db.select).mockReturnValueOnce(mockSelectChain(rows) as any);

    const page = await getNotifications('user-1', { limit: 1000 });
    expect(page.notifications.length).toBeLessThanOrEqual(100);
    expect(page.hasMore).toBe(true);
  });

  it('reports hasMore=false when the page is not full', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      id: `user-1-notif-${i}`,
      userId: 'user-1',
      title: `Notif ${i}`,
      message: 'Body',
      read: false,
      createdAt: new Date(),
      type: 'info',
    }));

    vi.mocked(db.select).mockReturnValueOnce(mockSelectChain(rows) as any);

    const page = await getNotifications('user-1', { limit: 50 });
    expect(page.notifications.length).toBe(5);
    expect(page.hasMore).toBe(false);
  });

  it('computes unread count independently of pagination', async () => {
    const unreadRows = [{ id: 'user-1-notif-1' }, { id: 'user-1-notif-2' }];
    vi.mocked(db.select).mockReturnValueOnce(mockSelectChain(unreadRows) as any);

    const count = await getUnreadCount('user-1');
    expect(count).toBe(2);
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
