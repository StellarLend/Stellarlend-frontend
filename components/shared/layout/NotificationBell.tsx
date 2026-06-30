import React, { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { IconButton } from '@/components/atoms/IconButton/IconButton';
import { IconPlaceholder } from '@/components/shared/ui/icons/IconPlaceholder';
import useNotificationStream from '@/hooks/useNotificationStream';
import { useNotificationPins } from '@/hooks/useNotificationPins';
import { type DateGroup } from '@/lib/notifications/grouping';
import type { Notification } from '@/lib/notifications/types';
import NotificationCenter from './NotificationCenter';

const NotificationIcon = dynamic(
  () =>
    import("@/components/shared/ui/icons/Notification").then((mod) => ({
      default: mod.Notification,
    })),
  {
    loading: () => <IconPlaceholder />,
    ssr: true,
  },
);

const NotificationBell = () => {
  const { unreadCount } = useNotificationStream();
  const { pinnedIds, togglePin } = useNotificationPins();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoadedNotifications, setHasLoadedNotifications] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<DateGroup>>(
    new Set(),
  );

  const triggerRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) {
        if (res.status === 401) {
          setNotifications([]);
          setHasLoadedNotifications(true);
          return;
        }
        throw new Error("Failed to fetch");
      }
      const data = await res.json();
      if (isMountedRef.current) {
        setNotifications(data.notifications ?? []);
        setHasLoadedNotifications(true);
      }
    } catch {
      if (isMountedRef.current) {
        setNotifications([]);
        setHasLoadedNotifications(true);
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
    previouslyFocusedRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!isOpen) return;

      const target = event.target as Node;

      if (triggerRef.current?.contains(target)) return;

      const panel = document.querySelector('[data-testid="notification-panel"]');
      if (panel && panel.contains(target)) return;

      closePanel();
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closePanel]);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
    }
  }, [isOpen]);

  const handleMarkRead = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
        );
      }
    } catch {
      // silently fail
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "PATCH",
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch {
      // silently fail
    }
  }, []);

  const handleDismiss = useCallback(
    async (id: string) => {
      const previousNotifications = notifications;
      setNotifications((prev) => prev.filter((n) => n.id !== id));

      try {
        const res = await fetch(`/api/notifications/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          throw new Error("Failed to dismiss notification");
        }
      } catch {
        if (isMountedRef.current) {
          setNotifications(previousNotifications);
        }
      }
    },
    [notifications],
  );

  const handleClearAll = useCallback(async () => {
    const previousNotifications = notifications;
    if (previousNotifications.length === 0) return;

    setNotifications([]);

    try {
      const results = await Promise.all(
        previousNotifications.map((n) =>
          fetch(`/api/notifications/${n.id}`, { method: "DELETE" }),
        ),
      );

      if (results.some((res) => !res.ok)) {
        throw new Error("Failed to clear notifications");
      }
    } catch {
      if (isMountedRef.current) {
        setNotifications(previousNotifications);
      }
    }
  }, [notifications]);

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

  const displayCount = unreadCount > 99 ? '99+' : unreadCount.toString();
  const showBadge = unreadCount > 0;

  return (
    <div className="relative inline-block">
      <IconButton
        ref={triggerRef}
        aria-label={ariaLabel}
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
        <NotificationCenter
          notifications={notifications}
          loading={loading}
          collapsedGroups={collapsedGroups}
          pinnedIds={pinnedIds}
          onToggleGroup={toggleGroup}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          onTogglePin={togglePin}
          onClose={closePanel}
        />
      )}
    </div>
  );
};

export default NotificationBell;