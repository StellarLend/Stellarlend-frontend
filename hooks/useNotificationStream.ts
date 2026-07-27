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
 * and provides the current unread notification count plus a debounced
 * connection state for the live notification feed.
 */
export type NotificationStreamConnectionState = "connected" | "reconnecting" | "offline";

const RECONNECTING_DEBOUNCE_MS = 1500;
const OFFLINE_DELAY_MS = 5000;
const MAX_RECONNECT_DELAY_MS = 30000;

export const useNotificationStream = (
  options: UseNotificationStreamOptions = {},
) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionState, setConnectionState] =
    useState<NotificationStreamConnectionState>("reconnecting");
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectingStateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offlineStateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoff = useRef<number>(1000); // start at 1s
  const onNotificationRef = useRef(options.onNotification);

  const clearStateTimers = () => {
    if (reconnectingStateTimeout.current) {
      clearTimeout(reconnectingStateTimeout.current);
      reconnectingStateTimeout.current = null;
    }
    if (offlineStateTimeout.current) {
      clearTimeout(offlineStateTimeout.current);
      offlineStateTimeout.current = null;
    }
  };

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
    clearStateTimers();
  };

  useEffect(() => {
    const markDisconnected = () => {
      clearStateTimers();

      reconnectingStateTimeout.current = setTimeout(() => {
        setConnectionState("reconnecting");
      }, RECONNECTING_DEBOUNCE_MS);

      offlineStateTimeout.current = setTimeout(() => {
        setConnectionState("offline");
      }, OFFLINE_DELAY_MS);
    };

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

      source.onopen = () => {
        setConnectionState("connected");
        backoff.current = 1000;
        clearStateTimers();
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
        if (reconnectTimeout.current) {
          return;
        }

        markDisconnected();

        if (sourceRef.current) {
          sourceRef.current.close();
          sourceRef.current = null;
        }

        reconnectTimeout.current = setTimeout(() => {
          reconnectTimeout.current = null;
          backoff.current = Math.min(
            backoff.current * 2,
            MAX_RECONNECT_DELAY_MS,
          );
          connect();
        }, backoff.current);
      };
    };

    connect();
    return () => cleanup();
  }, []);

  return { unreadCount, connectionState };
};

export default useNotificationStream;
