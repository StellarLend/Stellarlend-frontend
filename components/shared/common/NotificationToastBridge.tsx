"use client";

import { useCallback, useEffect, useRef } from "react";
import useNotificationStream from "@/hooks/useNotificationStream";
import type { Notification } from "@/lib/notifications/types";
import { useToast, type ToastVariant } from "./Toast";

export type NotificationToastPriority = Notification["type"];

export interface NotificationToastBridgeProps {
  priorityThreshold?: NotificationToastPriority;
  seenLimit?: number;
  initialNotificationsUrl?: string;
  fetchInitialNotifications?: boolean;
}

const PRIORITY_RANK: Record<NotificationToastPriority, number> = {
  info: 0,
  success: 1,
  warning: 2,
  error: 3,
};

const TOAST_VARIANT_BY_NOTIFICATION_TYPE: Record<
  NotificationToastPriority,
  ToastVariant
> = {
  info: "info",
  success: "success",
  warning: "processing",
  error: "error",
};

export const DEFAULT_NOTIFICATION_TOAST_PRIORITY: NotificationToastPriority =
  parsePriorityThreshold(
    process.env.NEXT_PUBLIC_NOTIFICATION_TOAST_PRIORITY_THRESHOLD,
  ) ?? "warning";

export const DEFAULT_NOTIFICATION_TOAST_SEEN_LIMIT = 100;

function parsePriorityThreshold(
  value: string | undefined,
): NotificationToastPriority | null {
  if (
    value === "info" ||
    value === "success" ||
    value === "warning" ||
    value === "error"
  ) {
    return value;
  }

  return null;
}

function isNotification(value: unknown): value is Notification {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<Notification>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.userId === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.read === "boolean" &&
    typeof candidate.createdAt === "string" &&
    parsePriorityThreshold(candidate.type) !== null
  );
}

export function notificationMeetsPriorityThreshold(
  notification: Notification,
  threshold: NotificationToastPriority,
) {
  return PRIORITY_RANK[notification.type] >= PRIORITY_RANK[threshold];
}

export default function NotificationToastBridge({
  priorityThreshold = DEFAULT_NOTIFICATION_TOAST_PRIORITY,
  seenLimit = DEFAULT_NOTIFICATION_TOAST_SEEN_LIMIT,
  initialNotificationsUrl = "/api/notifications",
  fetchInitialNotifications = true,
}: NotificationToastBridgeProps) {
  const { showToast } = useToast();
  const seenIds = useRef<Set<string>>(new Set());
  const seenOrder = useRef<string[]>([]);
  const seedComplete = useRef(!fetchInitialNotifications);
  const pendingNotifications = useRef<Notification[]>([]);

  const rememberSeen = useCallback(
    (id: string) => {
      if (seenIds.current.has(id)) {
        return;
      }

      seenIds.current.add(id);
      seenOrder.current.push(id);

      while (seenOrder.current.length > seenLimit) {
        const oldestId = seenOrder.current.shift();
        if (oldestId) {
          seenIds.current.delete(oldestId);
        }
      }
    },
    [seenLimit],
  );

  const processNotification = useCallback(
    (notification: Notification) => {
      if (seenIds.current.has(notification.id)) {
        return;
      }

      rememberSeen(notification.id);

      if (
        notification.read ||
        !notificationMeetsPriorityThreshold(notification, priorityThreshold)
      ) {
        return;
      }

      showToast({
        id: `notification-${notification.id}`,
        title: notification.title,
        description: notification.message,
        variant: TOAST_VARIANT_BY_NOTIFICATION_TYPE[notification.type],
      });
    },
    [priorityThreshold, rememberSeen, showToast],
  );

  const flushPendingNotifications = useCallback(() => {
    const pending = pendingNotifications.current.splice(0);
    for (const notification of pending) {
      processNotification(notification);
    }
  }, [processNotification]);

  useEffect(() => {
    let isMounted = true;
    seedComplete.current = !fetchInitialNotifications;
    pendingNotifications.current = [];

    if (!fetchInitialNotifications) {
      return () => {
        isMounted = false;
        pendingNotifications.current = [];
      };
    }

    const seedSeenNotifications = async () => {
      try {
        const response = await fetch(initialNotificationsUrl, {
          credentials: "same-origin",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { notifications?: unknown[] };
        if (!isMounted || !Array.isArray(data.notifications)) {
          return;
        }

        for (const notification of data.notifications) {
          if (isNotification(notification) && !notification.read) {
            rememberSeen(notification.id);
          }
        }
      } catch {
        // If the unread store cannot be reached, live notifications still work.
      } finally {
        if (isMounted) {
          seedComplete.current = true;
          flushPendingNotifications();
        }
      }
    };

    void seedSeenNotifications();

    return () => {
      isMounted = false;
      pendingNotifications.current = [];
    };
  }, [
    fetchInitialNotifications,
    flushPendingNotifications,
    initialNotificationsUrl,
    rememberSeen,
  ]);

  const handleNotification = useCallback(
    (notification: Notification) => {
      if (!seedComplete.current) {
        pendingNotifications.current.push(notification);
        return;
      }

      processNotification(notification);
    },
    [processNotification],
  );

  useNotificationStream({ onNotification: handleNotification });

  return null;
}
