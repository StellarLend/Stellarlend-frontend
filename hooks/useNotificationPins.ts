'use client';

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'notification-pinned-ids';

function getStoredPins(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed);
    return new Set();
  } catch {
    return new Set();
  }
}

function storePins(pins: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(pins)));
  } catch {
    // localStorage may be full or unavailable
  }
}

export function useNotificationPins() {
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(getStoredPins);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setPinnedIds(getStoredPins());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      storePins(next);
      return next;
    });
  }, []);

  const isPinned = useCallback(
    (id: string) => pinnedIds.has(id),
    [pinnedIds],
  );

  return { pinnedIds, togglePin, isPinned };
}
