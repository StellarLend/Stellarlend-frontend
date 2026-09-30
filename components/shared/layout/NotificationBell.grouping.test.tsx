import React from 'react';
import { render, screen, waitFor, within } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { streamFn } = vi.hoisted(() => ({ streamFn: vi.fn() }));
const { pinsFn } = vi.hoisted(() => ({ pinsFn: vi.fn() }));

vi.mock('@/hooks/useNotificationStream', () => ({
  default: streamFn,
  useNotificationStream: streamFn,
}));

vi.mock('@/hooks/useNotificationPins', () => ({
  useNotificationPins: pinsFn,
}));

import NotificationBell from './NotificationBell';
import type { Notification } from '@/lib/notifications/types';

function todayString(hoursOffset = 0): string {
  const d = new Date();
  d.setHours(d.getHours() + hoursOffset);
  return d.toISOString();
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

const todayNotif: Notification = {
  id: 'today-1',
  userId: 'u1',
  title: 'Today Event',
  message: 'Happened today',
  read: false,
  createdAt: todayString(-1),
  type: 'info',
};

const weekNotif: Notification = {
  id: 'week-1',
  userId: 'u1',
  title: 'This Week',
  message: 'Earlier this week',
  read: true,
  createdAt: daysAgo(2),
  type: 'success',
};

const olderNotif: Notification = {
  id: 'older-1',
  userId: 'u1',
  title: 'Old News',
  message: 'Long ago',
  read: false,
  createdAt: daysAgo(10),
  type: 'warning',
};

const mixedNotifications: Notification[] = [todayNotif, weekNotif, olderNotif];

function setupMocks(options: {
  unreadCount?: number;
  pinnedIds?: Set<string>;
  isPinned?: (id: string) => boolean;
  togglePin?: ReturnType<typeof vi.fn>;
} = {}) {
  streamFn.mockReturnValue({ unreadCount: options.unreadCount ?? 3 });

  const pinnedIds = options.pinnedIds ?? new Set<string>();
  const pinMock = {
    pinnedIds,
    togglePin: options.togglePin ?? vi.fn(),
    isPinned: options.isPinned ?? ((id: string) => pinnedIds.has(id)),
  };
  pinsFn.mockReturnValue(pinMock);
  return { pinMock };
}

describe('NotificationBell grouping', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    streamFn.mockReset();
    pinsFn.mockReset();
  });

  describe('panel open and empty state', () => {
    it('shows loading state then empty state when API returns no notifications', async () => {
      setupMocks({ unreadCount: 0 });
      let resolveFetch: (value: Response) => void = () => {};
      const fetchPromise = new Promise<Response>((resolve) => { resolveFetch = resolve; });
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(fetchPromise);

      render(<NotificationBell />);

      await userEvent.click(screen.getByRole('button', { name: /no unread notifications/i }));

      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      });

      resolveFetch(
        new Response(JSON.stringify({ notifications: [], unreadCount: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toHaveTextContent('No notifications yet');
      });

      fetchMock.mockRestore();
    });

    it('shows panel when bell is clicked', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ notifications: mixedNotifications, unreadCount: 2 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<NotificationBell />);
      const trigger = screen.getByRole('button', { name: /3 unread notifications/i });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByTestId('notification-panel')).toBeInTheDocument();
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      fetchMock.mockRestore();
    });

    it('closes panel on Escape', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ notifications: mixedNotifications, unreadCount: 2 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<NotificationBell />);
      await userEvent.click(screen.getByRole('button', { name: /3 unread notifications/i }));

      await waitFor(() => {
        expect(screen.getByTestId('notification-panel')).toBeInTheDocument();
      });

      const panel = screen.getByTestId('notification-panel');
      panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      await waitFor(() => {
        expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument();
      });

      fetchMock.mockRestore();
    });
  });

  describe('grouping display', () => {
    it('renders grouped sections for notifications in different date buckets', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ notifications: mixedNotifications, unreadCount: 2 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<NotificationBell />);
      await userEvent.click(screen.getByRole('button', { name: /3 unread notifications/i }));

      await waitFor(() => {
        expect(screen.getByTestId('group-toggle-today')).toBeInTheDocument();
        expect(screen.getByTestId('group-toggle-earlier_this_week')).toBeInTheDocument();
        expect(screen.getByTestId('group-toggle-older')).toBeInTheDocument();
      });

      expect(screen.getByTestId('notification-item-today-1')).toBeInTheDocument();
      expect(screen.getByTestId('notification-item-week-1')).toBeInTheDocument();
      expect(screen.getByTestId('notification-item-older-1')).toBeInTheDocument();

      fetchMock.mockRestore();
    });

    it('collapses and expands group sections with aria-expanded', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ notifications: mixedNotifications, unreadCount: 2 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<NotificationBell />);
      await userEvent.click(screen.getByRole('button', { name: /3 unread notifications/i }));

      await waitFor(() => {
        expect(screen.getByTestId('group-toggle-today')).toBeInTheDocument();
      });

      const toggle = screen.getByTestId('group-toggle-today');
      expect(toggle).toHaveAttribute('aria-expanded', 'true');

      await userEvent.click(toggle);
      await waitFor(() => {
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
      });
      expect(screen.queryByTestId('notification-item-today-1')).not.toBeInTheDocument();

      await userEvent.click(toggle);
      await waitFor(() => {
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
      });
      expect(screen.getByTestId('notification-item-today-1')).toBeInTheDocument();

      fetchMock.mockRestore();
    });

    it('shows mark-all-read button when there are unread notifications', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ notifications: mixedNotifications, unreadCount: 2 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<NotificationBell />);
      await userEvent.click(screen.getByRole('button', { name: /3 unread notifications/i }));

      await waitFor(() => {
        expect(screen.getByTestId('mark-all-read')).toBeInTheDocument();
      });

      fetchMock.mockRestore();
    });

    it('hides mark-all-read when all notifications are read', async () => {
      setupMocks({ unreadCount: 0 });
      const allRead = mixedNotifications.map((n) => ({ ...n, read: true }));
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ notifications: allRead, unreadCount: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<NotificationBell />);
      await userEvent.click(screen.getByRole('button', { name: /no unread notifications/i }));

      await waitFor(() => {
        expect(screen.queryByTestId('mark-all-read')).not.toBeInTheDocument();
      });

      fetchMock.mockRestore();
    });
  });

  describe('pinning', () => {
    it('renders pinned section with pinned notifications at top', async () => {
      const pinnedIds = new Set(['week-1']);
      setupMocks({ pinnedIds });

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ notifications: mixedNotifications, unreadCount: 2 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<NotificationBell />);
      await userEvent.click(screen.getByRole('button', { name: /3 unread notifications/i }));

      await waitFor(() => {
        expect(screen.getByTestId('notification-item-week-1')).toBeInTheDocument();
      });

      const items = screen.getAllByTestId(/^notification-item-/);
      expect(items[0]).toHaveAttribute('data-testid', 'notification-item-week-1');

      fetchMock.mockRestore();
    });

    it('pin button calls togglePin with correct id', async () => {
      const togglePin = vi.fn();
      setupMocks({ togglePin });

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ notifications: [todayNotif], unreadCount: 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<NotificationBell />);
      await userEvent.click(screen.getByRole('button', { name: /3 unread notifications/i }));

      await waitFor(() => {
        expect(screen.getByTestId('pin-btn-today-1')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('pin-btn-today-1'));
      expect(togglePin).toHaveBeenCalledWith('today-1');

      fetchMock.mockRestore();
    });

    it('shows unpin label for pinned notification', async () => {
      const pinnedIds = new Set(['today-1']);
      setupMocks({ pinnedIds });

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ notifications: [todayNotif], unreadCount: 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<NotificationBell />);
      await userEvent.click(screen.getByRole('button', { name: /3 unread notifications/i }));

      await waitFor(() => {
        const pinBtn = screen.getByTestId('pin-btn-today-1');
        expect(pinBtn).toHaveTextContent('Unpin');
        expect(pinBtn).toHaveAttribute('aria-label', 'Unpin notification');
      });

      fetchMock.mockRestore();
    });
  });

  describe('mark all read', () => {
    it('marks all notifications as read via API', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      fetchMock.mockImplementation((url: RequestInfo | URL) => {
        const urlStr = url.toString();
        if (urlStr === '/api/notifications') {
          return Promise.resolve(
            new Response(JSON.stringify({ notifications: mixedNotifications, unreadCount: 2 }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        if (urlStr === '/api/notifications/read-all') {
          return Promise.resolve(
            new Response(JSON.stringify({ updatedCount: 2 }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        return Promise.reject(new Error('unexpected call'));
      });

      render(<NotificationBell />);
      await userEvent.click(screen.getByRole('button', { name: /3 unread notifications/i }));

      await waitFor(() => {
        expect(screen.getByTestId('mark-all-read')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('mark-all-read'));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/notifications/read-all', { method: 'PATCH' });
      });

      fetchMock.mockRestore();
    });
  });

  describe('mark individual read', () => {
    it('marks a single notification as read via API', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      fetchMock.mockImplementation((url: RequestInfo | URL) => {
        const urlStr = url.toString();
        if (urlStr === '/api/notifications') {
          return Promise.resolve(
            new Response(JSON.stringify({ notifications: mixedNotifications, unreadCount: 2 }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        if (urlStr === '/api/notifications/today-1') {
          return Promise.resolve(
            new Response(JSON.stringify({ notification: { ...todayNotif, read: true } }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        return Promise.reject(new Error('unexpected call'));
      });

      render(<NotificationBell />);
      await userEvent.click(screen.getByRole('button', { name: /3 unread notifications/i }));

      await waitFor(() => {
        expect(screen.getByTestId('mark-read-today-1')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('mark-read-today-1'));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/notifications/today-1', { method: 'PATCH' });
      });

      fetchMock.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('handles empty list', async () => {
      setupMocks({ unreadCount: 0 });
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ notifications: [], unreadCount: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<NotificationBell />);
      await userEvent.click(screen.getByRole('button', { name: /no unread notifications/i }));

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      fetchMock.mockRestore();
    });

    it('handles all-pinned notifications', async () => {
      const pinnedIds = new Set(['n1', 'n2']);
      setupMocks({ pinnedIds });

      const allPinned: Notification[] = [
        { ...todayNotif, id: 'n1' },
        { ...weekNotif, id: 'n2' },
      ];

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ notifications: allPinned, unreadCount: 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<NotificationBell />);
      await userEvent.click(screen.getByRole('button', { name: /3 unread notifications/i }));

      await waitFor(() => {
        expect(screen.getByTestId('notification-item-n1')).toBeInTheDocument();
        expect(screen.getByTestId('notification-item-n2')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('group-toggle-today')).not.toBeInTheDocument();

      fetchMock.mockRestore();
    });

    it('handles 401 unauthorized gracefully', async () => {
      setupMocks({ unreadCount: 0 });
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(null, { status: 401 }),
      );

      render(<NotificationBell />);
      await userEvent.click(screen.getByRole('button', { name: /no unread notifications/i }));

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      fetchMock.mockRestore();
    });

    it('handles API fetch failure gracefully', async () => {
      setupMocks({ unreadCount: 0 });
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      render(<NotificationBell />);
      await userEvent.click(screen.getByRole('button', { name: /no unread notifications/i }));

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toHaveTextContent('No notifications yet');
      });

      fetchMock.mockRestore();
    });
  });

  describe('click outside', () => {
    it('closes panel when clicking outside the notification center', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ notifications: [todayNotif], unreadCount: 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(
        <div>
          <NotificationBell />
          <button type="button" data-testid="outside-button">Outside button</button>
        </div>,
      );

      const trigger = screen.getByRole('button', { name: /1 unread notification/i });
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByTestId('notification-panel')).toBeInTheDocument();
      });

      const outsideButton = screen.getByTestId('outside-button');
      await userEvent.click(outsideButton);

      await waitFor(() => {
        expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument();
      });

      fetchMock.mockRestore();
    });
  });

  describe('focus management', () => {
    it('restores focus to bell when panel closes via Escape', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ notifications: [todayNotif], unreadCount: 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<NotificationBell />);
      const trigger = screen.getByRole('button', { name: /1 unread notification/i });

      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByTestId('notification-panel')).toBeInTheDocument();
      });

      const panel = screen.getByTestId('notification-panel');
      panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      await waitFor(() => {
        expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument();
      });

      expect(trigger).toHaveFocus();

      fetchMock.mockRestore();
    });

    it('traps focus inside the panel with Tab key', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ notifications: [todayNotif], unreadCount: 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<NotificationBell />);
      const trigger = screen.getByRole('button', { name: /1 unread notification/i });

      trigger.focus();
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByTestId('notification-panel')).toBeInTheDocument();
      });

      const panel = screen.getByRole('dialog');
      const firstFocusable = panel.querySelector('button') as HTMLElement;

      if (firstFocusable) {
        firstFocusable.focus();
        expect(firstFocusable).toHaveFocus();

        await userEvent.tab();

        const buttons = within(panel).getAllByRole('button');
        if (buttons.length > 1) {
          const lastButton = buttons[buttons.length - 1];
          expect(document.activeElement).toEqual(lastButton);
        }
      }

      fetchMock.mockRestore();
    });
  });
});
