import { useEffect, useRef, useState } from "react";

export type NotificationStreamConnectionState =
  "connected" | "reconnecting" | "offline";

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const RECONNECTING_DEBOUNCE_MS = 1500;
const OFFLINE_DELAY_MS = 5000;

/**
 * Hook that connects to the backend SSE stream at /api/notifications/stream
 * and provides the current unread notification count plus a debounced
 * connection state for the live notification feed.
 */
export const useNotificationStream = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionState, setConnectionState] =
    useState<NotificationStreamConnectionState>("reconnecting");
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectingStateTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const offlineStateTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const backoff = useRef<number>(INITIAL_RECONNECT_DELAY_MS);

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

      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (typeof data.unreadCount === "number") {
            setUnreadCount(data.unreadCount);
          }
        } catch {
          // ignore malformed messages
        }
      };

      source.onopen = () => {
        clearStateTimers();
        setConnectionState("connected");
        backoff.current = INITIAL_RECONNECT_DELAY_MS;
      };

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
