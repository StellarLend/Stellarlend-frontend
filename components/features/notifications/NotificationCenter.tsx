"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import type { Notification } from "@/lib/notifications/types";
import { useNotificationStream } from "@/hooks/useNotificationStream";

const typeColors: Record<Notification["type"], string> = {
  info: "bg-blue-100 text-blue-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
};

const NotificationCenter = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [ariaMessage, setAriaMessage] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const showBadge = unreadCount > 0;
  const displayCount = unreadCount > 99 ? "99+" : String(unreadCount);

  useEffect(() => {
    fetch("/api/notifications")
      .then((res) => {
        if (res.status === 401) {
          setHidden(true);
          return null;
        }
        if (!res.ok) return null;
        return res.json() as Promise<{ notifications: Notification[] }>;
      })
      .then((data) => {
        if (data?.notifications) {
          setNotifications(data.notifications);
        }
      })
      .catch(() => {});
  }, []);

  const handleNewNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => {
      if (prev.some((n) => n.id === notification.id)) return prev;
      return [notification, ...prev];
    });
    setAriaMessage(`New notification: ${notification.title}`);
  }, []);

  useNotificationStream({ onNotification: handleNewNotification });

  const handleMarkRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      if (!res.ok) throw new Error("patch failed");
    } catch {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: false } : n)),
      );
    }
  }, []);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handlePanelKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    },
    [],
  );

  useEffect(() => {
    if (isOpen && panelRef.current) {
      const first = panelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      first?.focus();
    }
  }, [isOpen]);

  if (hidden) return null;

  return (
    <div className="relative" data-testid="notification-center">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-label={
          showBadge
            ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
            : "No unread notifications"
        }
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="relative flex items-center justify-center w-10 h-10 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2 transition-colors"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="text-gray-700 dark:text-gray-300"
        >
          <path
            d="M22 20H2V18H3V11.0314C3 6.04348 7.02944 2 12 2C16.9706 2 21 6.04348 21 11.0314V18H22V20ZM9.5 21H14.5C14.5 22.3807 13.3807 23.5 12 23.5C10.6193 23.5 9.5 22.3807 9.5 21Z"
            fill="currentColor"
          />
        </svg>

        {showBadge && (
          <span
            data-testid="unread-badge"
            className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 bg-red-600 text-xs text-white rounded-full flex items-center justify-center font-semibold leading-none px-1"
            aria-hidden="true"
          >
            {displayCount}
          </span>
        )}
      </button>

      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="live-region"
      >
        {ariaMessage}
      </div>

      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications panel"
          onKeyDown={handlePanelKeyDown}
          data-testid="notification-panel"
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50"
        >
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Notifications
          </div>

          {notifications.length === 0 ? (
            <p
              data-testid="empty-state"
              className="px-4 py-8 text-center text-sm text-gray-400"
            >
              No notifications yet
            </p>
          ) : (
            <ul
              className="divide-y divide-gray-100 dark:divide-gray-800 max-h-80 overflow-y-auto"
              aria-label="Notification list"
            >
              {notifications.map((n) => (
                <li
                  key={n.id}
                  data-testid={`notification-item-${n.id}`}
                  className={`px-4 py-3 ${n.read ? "bg-white dark:bg-gray-900" : "bg-slate-50 dark:bg-gray-800"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${typeColors[n.type]}`}
                    >
                      {n.type}
                    </span>
                    <time
                      dateTime={n.createdAt}
                      className="text-[11px] text-gray-400 whitespace-nowrap"
                    >
                      {new Date(n.createdAt).toLocaleDateString()}
                    </time>
                  </div>
                  <div
                    className={`mt-1 text-sm ${n.read ? "font-normal text-gray-600 dark:text-gray-400" : "font-semibold text-gray-900 dark:text-gray-100"}`}
                  >
                    {n.title}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    {n.message}
                  </p>
                  {!n.read && (
                    <button
                      type="button"
                      data-testid={`mark-read-${n.id}`}
                      onClick={() => handleMarkRead(n.id)}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:underline"
                    >
                      Mark as read
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
