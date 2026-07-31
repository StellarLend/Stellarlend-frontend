"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Notification, NotificationType } from "@/lib/notifications/types";
import {
  getDateGroupLabel,
  groupNotifications,
  sortGroupedNotifications,
  type DateGroup,
} from "@/lib/notifications/grouping";

export type FeedTab = "all" | NotificationType;

const TABS: Array<{ value: FeedTab; label: string }> = [
  { value: "all", label: "All" },
  { value: "info", label: "Info" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
];

const typeColors: Record<NotificationType, string> = {
  info: "bg-blue-100 text-blue-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
};

const GROUP_ORDER: DateGroup[] = ["today", "earlier_this_week", "older"];

export interface NotificationsFeedProps {
  /** Optional fixture for tests. When omitted, loads /api/notifications. */
  initialNotifications?: Notification[];
}

function countByType(notifications: Notification[]): Record<FeedTab, number> {
  const counts: Record<FeedTab, number> = {
    all: notifications.length,
    info: 0,
    success: 0,
    warning: 0,
    error: 0,
  };
  for (const n of notifications) {
    const t = n.type in counts ? n.type : ("info" as NotificationType);
    // Unknown types bucket into info for counting so they remain visible under All.
    if (t === "info" || t === "success" || t === "warning" || t === "error") {
      counts[t] += 1;
    }
  }
  return counts;
}

export default function NotificationsFeed({
  initialNotifications,
}: NotificationsFeedProps) {
  const [notifications, setNotifications] = useState<Notification[]>(
    initialNotifications ?? [],
  );
  const [loading, setLoading] = useState(!initialNotifications);
  const [activeTab, setActiveTab] = useState<FeedTab>("all");
  const [pinnedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (initialNotifications) return;
    let cancelled = false;
    fetch("/api/notifications")
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{ notifications: Notification[] }>;
      })
      .then((data) => {
        if (!cancelled && data?.notifications) {
          setNotifications(data.notifications);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialNotifications]);

  const counts = useMemo(() => countByType(notifications), [notifications]);

  const filtered = useMemo(() => {
    if (activeTab === "all") return notifications;
    return notifications.filter((n) => n.type === activeTab);
  }, [notifications, activeTab]);

  const grouped = useMemo(() => {
    const g = groupNotifications(filtered, pinnedIds);
    sortGroupedNotifications(g);
    return g;
  }, [filtered, pinnedIds]);

  const focusTab = (value: FeedTab) => {
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(`[data-notif-tab="${value}"]`)
        ?.focus();
    });
  };

  const selectTab = useCallback((value: FeedTab) => {
    setActiveTab(value);
    focusTab(value);
  }, []);

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const lastIndex = TABS.length - 1;
    let nextIndex = index;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = index === lastIndex ? 0 : index + 1;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = index === 0 ? lastIndex : index - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = lastIndex;
    } else {
      return;
    }

    event.preventDefault();
    selectTab(TABS[nextIndex].value);
  };

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    } catch {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: false } : n)),
      );
    }
  };

  if (loading) {
    return (
      <div data-testid="notifications-feed" aria-busy="true">
        <p role="status" className="text-sm text-gray-500">
          Loading notifications…
        </p>
      </div>
    );
  }

  return (
    <div data-testid="notifications-feed" className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Filter notifications by type"
        className="flex flex-wrap gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200"
      >
        {TABS.map((tab, index) => {
          const selected = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              id={`notif-tab-${tab.value}`}
              aria-selected={selected}
              aria-controls="notif-panel"
              tabIndex={selected ? 0 : -1}
              data-notif-tab={tab.value}
              onClick={() => selectTab(tab.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] ${
                selected
                  ? "bg-green-500 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 text-xs tabular-nums ${
                  selected ? "text-white/90" : "text-gray-400"
                }`}
                aria-label={`${counts[tab.value]} notifications`}
              >
                {counts[tab.value]}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="notif-panel"
        aria-labelledby={`notif-tab-${activeTab}`}
        className="bg-white rounded-lg border border-gray-200 shadow-sm"
      >
        {filtered.length === 0 ? (
          <p
            data-testid="feed-empty"
            className="px-4 py-10 text-center text-sm text-gray-500"
          >
            No {activeTab === "all" ? "" : `${activeTab} `}notifications
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {GROUP_ORDER.map((group) => {
              const items = grouped[group];
              if (!items.length) return null;
              return (
                <section
                  key={group}
                  aria-labelledby={`notif-group-${group}`}
                  data-testid={`notif-group-${group}`}
                  className="px-2 py-2"
                >
                  <h3
                    id={`notif-group-${group}`}
                    className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    {getDateGroupLabel(group)}
                  </h3>
                  <ul className="divide-y divide-gray-50">
                    {items.map((n) => (
                      <li
                        key={n.id}
                        data-testid={`feed-item-${n.id}`}
                        className={`px-3 py-3 ${
                          n.read ? "bg-white" : "bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                              typeColors[n.type] ?? typeColors.info
                            }`}
                          >
                            {n.type}
                          </span>
                          <time
                            dateTime={n.createdAt}
                            className="text-[11px] text-gray-400 whitespace-nowrap"
                          >
                            {new Date(n.createdAt).toLocaleString()}
                          </time>
                        </div>
                        <div
                          className={`mt-1 text-sm ${
                            n.read
                              ? "font-normal text-gray-600"
                              : "font-semibold text-gray-900"
                          }`}
                        >
                          {n.title}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                          {n.message}
                        </p>
                        {!n.read && (
                          <button
                            type="button"
                            onClick={() => handleMarkRead(n.id)}
                            className="mt-2 text-xs text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:underline"
                          >
                            Mark as read
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            {grouped.pinned.length > 0 && (
              <section
                aria-labelledby="notif-group-pinned"
                data-testid="notif-group-pinned"
                className="px-2 py-2"
              >
                <h3
                  id="notif-group-pinned"
                  className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500"
                >
                  Pinned
                </h3>
                <ul>
                  {grouped.pinned.map((n) => (
                    <li key={n.id} data-testid={`feed-item-${n.id}`} className="px-3 py-3">
                      <div className="text-sm font-semibold">{n.title}</div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
