import React, { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { IconButton } from '@/components/atoms/IconButton/IconButton';
import { IconPlaceholder } from '@/components/shared/ui/icons/IconPlaceholder';
import useNotificationStream from '@/hooks/useNotificationStream';
import { useNotificationPins } from '@/hooks/useNotificationPins';
import {
  groupNotifications,
  sortGroupedNotifications,
  getDateGroupLabel,
  type DateGroup,
} from '@/lib/notifications/grouping';
import type { Notification } from '@/lib/notifications/types';

const NotificationIcon = dynamic(() => import('@/components/shared/ui/icons/Notification').then(mod => ({ default: mod.Notification })), {
  loading: () => <IconPlaceholder />,
  ssr: true,
});

const dateGroups: DateGroup[] = ['today', 'earlier_this_week', 'older'];

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  return `${diffDays}d ago`;
}

function typeIcon(type: Notification['type']): string {
  switch (type) {
    case 'success': return '●';
    case 'warning': return '●';
    case 'error': return '●';
    default: return '●';
  }
}

function typeColor(type: Notification['type']): string {
  switch (type) {
    case 'success': return 'text-green-500';
    case 'warning': return 'text-amber-500';
    case 'error': return 'text-red-500';
    default: return 'text-blue-500';
  }
}

const NotificationBell = () => {
  const { unreadCount } = useNotificationStream();
  const { pinnedIds, togglePin, isPinned } = useNotificationPins();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<DateGroup>>(new Set());

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) {
        if (res.status === 401) {
          setNotifications([]);
          return;
        }
        throw new Error('Failed to fetch');
      }
      const data = await res.json();
      if (isMountedRef.current) {
        setNotifications(data.notifications ?? []);
      }
    } catch {
      if (isMountedRef.current) {
        setNotifications([]);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        fetchNotifications();
      }
      return next;
    });
  }, [fetchNotifications]);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePanel();
      }
    },
    [closePanel],
  );

  useEffect(() => {
    if (isOpen && panelRef.current) {
      const firstFocusable = panelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
    }
  }, [isOpen]);

  const handleMarkRead = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
        if (res.ok) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
          );
        }
      } catch {
        // silently fail
      }
    },
    [],
  );

  const handleMarkAllRead = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'PATCH' });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch {
      // silently fail
    }
  }, []);

  const toggleGroup = useCallback((group: DateGroup) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }, []);

  const grouped = groupNotifications(notifications, pinnedIds);
  sortGroupedNotifications(grouped);

  const hasPinned = grouped.pinned.length > 0;
  const hasUnread = notifications.some((n) => !n.read);
  const hasAny = notifications.length > 0;

  const displayCount = useMemo(
    () => (unreadCount > 99 ? '99+' : unreadCount.toString()),
    [unreadCount],
  );

  const showBadge = useMemo(() => unreadCount > 0, [unreadCount]);

  const ariaLabel = useMemo(
    () =>
      showBadge
        ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
        : 'No unread notifications',
    [showBadge, unreadCount],
  );

  return (
    <div className="relative inline-block">
      <IconButton
        ref={triggerRef}
        aria-label={showBadge ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'No unread notifications'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={handleToggle}
      >
        <NotificationIcon className="text-white" width={24} height={24} />
        {showBadge && (
          <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 bg-red-600 text-xs text-white rounded-full flex items-center justify-center font-medium">
            {displayCount}
          </span>
        )}
      </IconButton>

      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications panel"
          onKeyDown={handleKeyDown}
          data-testid="notification-panel"
          className="absolute top-full right-0 mt-2 w-[360px] bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[480px] flex flex-col"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
            <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
            {hasAny && hasUnread && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                data-testid="mark-all-read"
                className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="flex items-center justify-center py-8" data-testid="loading-state">
                <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
              </div>
            )}

            {!loading && !hasAny && (
              <p
                data-testid="empty-state"
                className="py-8 text-center text-sm text-gray-400"
              >
                No notifications yet
              </p>
            )}

            {!loading && hasAny && (
              <ul className="divide-y divide-gray-50" role="list">
                {hasPinned && (
                  <li>
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Pinned
                      </span>
                    </div>
                    <ul className="divide-y divide-gray-50">
                      {grouped.pinned.map((n) => (
                        <NotificationItem
                          key={n.id}
                          notification={n}
                          isPinned={true}
                          onTogglePin={togglePin}
                          onMarkRead={handleMarkRead}
                        />
                      ))}
                    </ul>
                  </li>
                )}

                {dateGroups.map((group) => {
                  const items = grouped[group];
                  if (items.length === 0) return null;
                  const isCollapsed = collapsedGroups.has(group);

                  return (
                    <li key={group}>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group)}
                        aria-expanded={!isCollapsed}
                        data-testid={`group-toggle-${group}`}
                        className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100 text-left hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                          {getDateGroupLabel(group)}
                        </span>
                        <svg
                          className={`w-3 h-3 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {!isCollapsed && (
                        <ul className="divide-y divide-gray-50">
                          {items.map((n) => (
                            <NotificationItem
                              key={n.id}
                              notification={n}
                              isPinned={false}
                              onTogglePin={togglePin}
                              onMarkRead={handleMarkRead}
                            />
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface NotificationItemProps {
  notification: Notification;
  isPinned: boolean;
  onTogglePin: (id: string) => void;
  onMarkRead: (id: string) => void;
}

const NotificationItem = React.memo(function NotificationItem({
  notification: n,
  isPinned,
  onTogglePin,
  onMarkRead,
}: NotificationItemProps) {
  return (
    <li
      data-testid={`notification-item-${n.id}`}
      className={`px-4 py-3 transition-colors ${n.read ? 'bg-white' : 'bg-blue-50/40'}`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 text-xs ${typeColor(n.type)}`}
          aria-hidden="true"
        >
          {typeIcon(n.type)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm truncate ${n.read ? 'text-gray-700 font-normal' : 'text-gray-900 font-semibold'}`}>
              {n.title}
            </p>
            <span className="text-xs text-gray-400 shrink-0">{timeAgo(n.createdAt)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => onTogglePin(n.id)}
              data-testid={`pin-btn-${n.id}`}
              className={`text-xs transition-colors ${
                isPinned
                  ? 'text-blue-600 hover:text-blue-800'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              aria-label={isPinned ? 'Unpin notification' : 'Pin notification'}
            >
              {isPinned ? 'Unpin' : 'Pin'}
            </button>
            {!n.read && (
              <button
                type="button"
                onClick={() => onMarkRead(n.id)}
                data-testid={`mark-read-${n.id}`}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Mark as read
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
});

export default NotificationBell;
