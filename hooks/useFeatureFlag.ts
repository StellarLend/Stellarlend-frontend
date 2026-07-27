"use client";

import { useState, useEffect } from "react";

// Short TTL so a transient network blip won't permanently lock out flags.
const TTL_MS = 30_000; // 30s

const cache = new Map<string, Record<string, boolean>>();
let cacheTs = 0;
let fetchPromise: Promise<void> | null = null;

// Subscribers (hook instances) get notified when flags change.
const subscribers = new Set<(flags: Record<string, boolean>) => void>();

function notifySubscribers(flags: Record<string, boolean>) {
  for (const s of subscribers) {
    try {
      s(flags);
    } catch (e) {
      // swallow subscriber errors
    }
  }
}

function isCacheFresh() {
  return cache.has("__all__") && Date.now() - cacheTs < TTL_MS;
}

function startFetchIfNeeded() {
  if (isCacheFresh()) return;
  if (fetchPromise) return;

  fetchPromise = fetch("/api/feature-flags")
    .then((res) => {
      if (!res.ok) throw new Error("Failed to fetch feature flags");
      return res.json() as Promise<Record<string, boolean>>;
    })
    .then((data) => {
      cache.set("__all__", data);
      cacheTs = Date.now();
      notifySubscribers(data);
    })
    .catch(() => {
      // don't persist an empty cache on failure; schedule a retry after TTL
      // so transient failures won't permanently disable flags.
      setTimeout(() => {
        // clear fetchPromise so a new attempt may run
        fetchPromise = null;
        // attempt again only if cache is still stale
        if (!isCacheFresh()) startFetchIfNeeded();
      }, TTL_MS);
    })
    .finally(() => {
      fetchPromise = null;
    });
}

export function useFeatureFlag(name: string, defaultValue = false): boolean {
  const [flags, setFlags] = useState<Record<string, boolean>>(() => {
    return cache.get("__all__") ?? {};
  });

  useEffect(() => {
    // register subscriber to receive updates
    const subscriber = (f: Record<string, boolean>) => setFlags(f);
    subscribers.add(subscriber);

    // if cache is fresh, set local state and skip fetch
    if (isCacheFresh()) {
      setFlags(cache.get("__all__") ?? {});
    } else {
      // try to fetch (centralized)
      startFetchIfNeeded();
    }

    return () => {
      subscribers.delete(subscriber);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (name in flags) {
    return flags[name];
  }

  return defaultValue;
}
