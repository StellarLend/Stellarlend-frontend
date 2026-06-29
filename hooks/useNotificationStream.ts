import { useEffect, useRef, useState } from "react";
import type { Notification } from "@/lib/notifications/types";

interface UseNotificationStreamOptions {
  onNotification?: (notification: Notification) => void;
}

function isNotificationPayload(value: unknown): value is Notification {
  if (!value || typeof value !== "object") {
    return false;
  }

  const notification = value as Partial<Notification>;
  return (
    typeof notification.id === "string" &&
    typeof notification.userId === "string" &&
    typeof notification.title === "string" &&
    typeof notification.message === "string" &&
    typeof notification.read === "boolean" &&
    typeof notification.createdAt === "string" &&
    (notification.type === "info" ||
      notification.type === "success" ||
      notification.type === "warning" ||
      notification.type === "error")
  );
}

function parseEventData(event: MessageEvent): unknown {
  try {
    return JSON.parse(event.data);
  } catch {
    return null;
  }
}

/**
 * Hook that connects to the backend SSE stream at /api/notifications/stream
 * and provides the current unread notification count.
 * It reconnects with exponential backoff on errors and cleans up on unmount.
 */
export const useNotificationStream = (
  options: UseNotificationStreamOptions = {},
) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoff = useRef<number>(1000); // start at 1s
  const onNotificationRef = useRef(options.onNotification);

  useEffect(() => {
    onNotificationRef.current = options.onNotification;
  }, [options.onNotification]);

  const cleanup = () => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
  };

  useEffect(() => {
    const connect = () => {
      const source = new EventSource("/api/notifications/stream");
      sourceRef.current = source;

      const handleUnreadCount = (event: MessageEvent) => {
        const data = parseEventData(event);
        if (
          data &&
          typeof data === "object" &&
          typeof (data as { unreadCount?: unknown }).unreadCount === "number"
        ) {
          setUnreadCount((data as { unreadCount: number }).unreadCount);
        }
      };

      const handleNotification = (event: MessageEvent) => {
        const data = parseEventData(event);
        if (isNotificationPayload(data)) {
          onNotificationRef.current?.(data);
        }
      };

      source.onmessage = handleUnreadCount;
      source.addEventListener?.(
        "unreadCount",
        handleUnreadCount as EventListener,
      );
      source.addEventListener?.(
        "notification",
        handleNotification as EventListener,
      );

      source.onerror = () => {
        cleanup();
        // exponential backoff up to 30s
        reconnectTimeout.current = setTimeout(() => {
          backoff.current = Math.min(backoff.current * 2, 30000);
          connect();
        }, backoff.current);
      };

      source.onopen = () => {
        backoff.current = 1000; // reset backoff
      };
    };

    connect();
    return () => cleanup();
  }, []);

  return { unreadCount };
};

export default useNotificationStream;
