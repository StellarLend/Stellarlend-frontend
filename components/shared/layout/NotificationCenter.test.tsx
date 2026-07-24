import React from 'react';
import { render, screen, within } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import NotificationCenter from './NotificationCenter';
import type { Notification } from '@/lib/notifications/types';

const todayNotif: Notification = {
  id: 'today-1',
  userId: 'u1',
  title: 'Today Event',
  message: 'Happened today',
  read: false,
  createdAt: new Date(Date.now() - 3600000).toISOString(),
  type: 'info',
};

const weekNotif: Notification = {
  id: 'week-1',
  userId: 'u1',
  title: 'This Week',
  message: 'Earlier this week',
  read: true,
  createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  type: 'success',
};

const olderNotif: Notification = {
  id: 'older-1',
  userId: 'u1',
  title: 'Old News',
  message: 'Long ago',
  read: false,
  createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  type: 'warning',
};

const multipleNotifications: Notification[] = [todayNotif, weekNotif, olderNotif];

function setupMocks() {
  return {
    onMarkRead: vi.fn(),
    onMarkAllRead: vi.fn(),
    onTogglePin: vi.fn(),
    onToggleGroup: vi.fn(),
    onClose: vi.fn(),
  };
}

describe('NotificationCenter', () => {
  const user = userEvent.setup();

  describe('rendering', () => {
    it('renders the notification panel with notifications', () => {
      const mocks = setupMocks();
      render(
        <NotificationCenter
          notifications={multipleNotifications}
          loading={false}
          collapsedGroups={new Set()}
          pinnedIds={new Set()}
          onMarkRead={mocks.onMarkRead}
          onMarkAllRead={mocks.onMarkAllRead}
          onTogglePin={mocks.onTogglePin}
          onToggleGroup={mocks.onToggleGroup}
          onClose={mocks.onClose}
        />,
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByTestId('notification-item-today-1')).toBeInTheDocument();
      expect(screen.getByTestId('notification-item-week-1')).toBeInTheDocument();
      expect(screen.getByTestId('notification-item-older-1')).toBeInTheDocument();
    });

    it('shows loading spinner when loading is true', () => {
      render(
        <NotificationCenter
          notifications={[]}
          loading={true}
          collapsedGroups={new Set()}
          pinnedIds={new Set()}
          onMarkRead={vi.fn()}
          onMarkAllRead={vi.fn()}
          onTogglePin={vi.fn()}
          onToggleGroup={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    });

    it('shows empty state when no notifications', () => {
      render(
        <NotificationCenter
          notifications={[]}
          loading={false}
          collapsedGroups={new Set()}
          pinnedIds={new Set()}
          onMarkRead={vi.fn()}
          onMarkAllRead={vi.fn()}
          onTogglePin={vi.fn()}
          onToggleGroup={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No notifications yet')).toBeInTheDocument();
    });
  });

  describe('mark as read', () => {
    it('shows Mark as read button only for unread notifications', () => {
      render(
        <NotificationCenter
          notifications={multipleNotifications}
          loading={false}
          collapsedGroups={new Set()}
          pinnedIds={new Set()}
          {...setupMocks()}
        />,
      );

      expect(screen.getByTestId('mark-read-today-1')).toBeInTheDocument();
      expect(screen.queryByTestId('mark-read-week-1')).not.toBeInTheDocument();
    });

    it('calls onMarkRead when Mark as read is clicked', async () => {
      const { onMarkRead } = setupMocks();

      render(
        <NotificationCenter
          notifications={[todayNotif]}
          loading={false}
          collapsedGroups={new Set()}
          pinnedIds={new Set()}
          onMarkRead={onMarkRead}
          onMarkAllRead={vi.fn()}
          onTogglePin={vi.fn()}
          onToggleGroup={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId('mark-read-today-1'));
      expect(onMarkRead).toHaveBeenCalledWith('today-1');
    });
  });

  describe('mark all read', () => {
    it('shows mark all read button when there are unread notifications', () => {
      render(
        <NotificationCenter
          notifications={multipleNotifications}
          loading={false}
          collapsedGroups={new Set()}
          pinnedIds={new Set()}
          {...setupMocks()}
        />,
      );

      expect(screen.getByTestId('mark-all-read')).toBeInTheDocument();
    });

    it('hides mark all read button when all notifications are read', () => {
      render(
        <NotificationCenter
          notifications={[weekNotif]}
          loading={false}
          collapsedGroups={new Set()}
          pinnedIds={new Set()}
          {...setupMocks()}
        />,
      );

      expect(screen.queryByTestId('mark-all-read')).not.toBeInTheDocument();
    });

    it('calls onMarkAllRead when button is clicked', async () => {
      const { onMarkAllRead } = setupMocks();

      render(
        <NotificationCenter
          notifications={multipleNotifications}
          loading={false}
          collapsedGroups={new Set()}
          pinnedIds={new Set()}
          onMarkRead={vi.fn()}
          onMarkAllRead={onMarkAllRead}
          onTogglePin={vi.fn()}
          onToggleGroup={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId('mark-all-read'));
      expect(onMarkAllRead).toHaveBeenCalled();
    });
  });

  describe('keyboard accessibility', () => {
    it('has Escape key handler to close panel', async () => {
      const { onClose } = setupMocks();

      render(
        <NotificationCenter
          notifications={[todayNotif]}
          loading={false}
          collapsedGroups={new Set()}
          pinnedIds={new Set()}
          onMarkRead={vi.fn()}
          onMarkAllRead={vi.fn()}
          onTogglePin={vi.fn()}
          onToggleGroup={vi.fn()}
          onClose={onClose}
        />,
      );

      const panel = screen.getByRole('dialog');
      panel.focus();
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalled();
    });

    it('traps focus inside the panel with Tab key', async () => {
      render(
        <NotificationCenter
          notifications={[todayNotif]}
          loading={false}
          collapsedGroups={new Set()}
          pinnedIds={new Set()}
          {...setupMocks()}
        />,
      );

      const panel = screen.getByRole('dialog');
      const focusable = within(panel).getAllByRole('button');

      if (focusable.length > 1) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        first.focus();
        expect(first).toHaveFocus();

        await user.tab();

        if (focusable.length === 2) {
          expect(last).toHaveFocus();
        }
      }
    });

    it('wraps focus from last to first on Shift+Tab', async () => {
      render(
        <NotificationCenter
          notifications={[todayNotif]}
          loading={false}
          collapsedGroups={new Set()}
          pinnedIds={new Set()}
          {...setupMocks()}
        />,
      );

      const panel = screen.getByRole('dialog');
      const buttons = within(panel).getAllByRole('button');

      if (buttons.length > 1) {
        const first = buttons[0];
        const last = buttons[buttons.length - 1];

        last.focus();

        await user.tab({ shift: true });

        expect(first).toHaveFocus();
      }
    });
  });

  describe('grouping', () => {
    it('renders group toggles for date groups', () => {
      render(
        <NotificationCenter
          notifications={multipleNotifications}
          loading={false}
          collapsedGroups={new Set()}
          pinnedIds={new Set()}
          {...setupMocks()}
        />,
      );

      expect(screen.getByTestId('group-toggle-today')).toBeInTheDocument();
      expect(screen.getByTestId('group-toggle-earlier_this_week')).toBeInTheDocument();
      expect(screen.getByTestId('group-toggle-older')).toBeInTheDocument();
    });

    it('group toggles have aria-expanded attribute', () => {
      render(
        <NotificationCenter
          notifications={multipleNotifications}
          loading={false}
          collapsedGroups={new Set()}
          pinnedIds={new Set()}
          {...setupMocks()}
        />,
      );

      const toggles = [
        screen.getByTestId('group-toggle-today'),
        screen.getByTestId('group-toggle-earlier_this_week'),
        screen.getByTestId('group-toggle-older'),
      ];

      toggles.forEach((toggle) => {
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('calls onToggleGroup when group toggle is clicked', async () => {
      const { onToggleGroup } = setupMocks();

      render(
        <NotificationCenter
          notifications={[todayNotif]}
          loading={false}
          collapsedGroups={new Set()}
          pinnedIds={new Set()}
          onMarkRead={vi.fn()}
          onMarkAllRead={vi.fn()}
          onTogglePin={vi.fn()}
          onToggleGroup={onToggleGroup}
          onClose={vi.fn()}
        />,
      );

      const toggle = screen.getByTestId('group-toggle-today');
      await user.click(toggle);
      expect(onToggleGroup).toHaveBeenCalledWith('today');
    });

    it('renders Pinned section when there are pinned notifications', () => {
      const pinnedNotif: Notification = { ...todayNotif, id: 'pinned-1', pinned: true };

      render(
        <NotificationCenter
          notifications={[pinnedNotif, weekNotif]}
          loading={false}
          collapsedGroups={new Set()}
          pinnedIds={new Set(['pinned-1'])}
          {...setupMocks()}
        />,
      );

      expect(screen.getByText('Pinned')).toBeInTheDocument();
      expect(screen.getByTestId('notification-item-pinned-1')).toBeInTheDocument();
    });
  });

  describe('pinning', () => {
    it('calls onTogglePin when Pin button is clicked', async () => {
      const { onTogglePin } = setupMocks();

      render(
        <NotificationCenter
          notifications={[todayNotif]}
          loading={false}
          collapsedGroups={new Set()}
          pinnedIds={new Set()}
          onMarkRead={vi.fn()}
          onMarkAllRead={vi.fn()}
          onTogglePin={onTogglePin}
          onToggleGroup={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId('pin-btn-today-1'));
      expect(onTogglePin).toHaveBeenCalledWith('today-1');
    });

    it('shows Unpin label for pinned notifications', () => {
      const pinnedNotif: Notification = { ...todayNotif, id: 'pinned-1', pinned: true };

      render(
        <NotificationCenter
          notifications={[pinnedNotif]}
          loading={false}
          collapsedGroups={new Set()}
          pinnedIds={new Set(['pinned-1'])}
          {...setupMocks()}
        />,
      );

      const pinBtn = screen.getByTestId('pin-btn-pinned-1');
      expect(pinBtn).toHaveTextContent('Unpin');
      expect(pinBtn).toHaveAttribute('aria-label', 'Unpin notification');
    });
  });

  describe('unread styling', () => {
    it('applies distinct background for unread notifications', () => {
      render(
        <NotificationCenter
          notifications={[todayNotif]}
          loading={false}
          collapsedGroups={new Set()}
          pinnedIds={new Set()}
          {...setupMocks()}
        />,
      );

      const unreadItem = screen.getByTestId('notification-item-today-1');
      expect(unreadItem.className).toContain('bg-blue-50/40');
    });

    it('applies standard background for read notifications', () => {
      render(
        <NotificationCenter
          notifications={[weekNotif]}
          loading={false}
          collapsedGroups={new Set()}
          pinnedIds={new Set()}
          {...setupMocks()}
        />,
      );

      const readItem = screen.getByTestId('notification-item-week-1');
      expect(readItem.className).toContain('bg-white');
    });
  });
});