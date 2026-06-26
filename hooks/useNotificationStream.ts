import { useEffect, useState, useRef } from 'react';

/**
 * Hook that connects to the backend SSE stream at /api/notifications/stream
 * and provides the current unread notification count.
 * It reconnects with exponential backoff on errors and cleans up on unmount.
 */
export const useNotificationStream = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoff = useRef<number>(1000); // start at 1s

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
      const source = new EventSource('/api/notifications/stream');
      sourceRef.current = source;

      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (typeof data.unreadCount === 'number') {
            setUnreadCount(data.unreadCount);
          }
        } catch {
          // ignore malformed messages
        }
      };

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
