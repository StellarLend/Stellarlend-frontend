"use client";

import { useState, useEffect } from "react";

const cache = new Map<string, Record<string, boolean>>();
let fetchPromise: Promise<void> | null = null;

export function useFeatureFlag(name: string, defaultValue = false): boolean {
  const [flags, setFlags] = useState<Record<string, boolean>>(() => {
    return cache.get("__all__") ?? {};
  });

  useEffect(() => {
    if (cache.has("__all__")) return;

    if (!fetchPromise) {
      fetchPromise = fetch("/api/feature-flags")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch feature flags");
          return res.json() as Promise<Record<string, boolean>>;
        })
        .then((data) => {
          cache.set("__all__", data);
        })
        .catch(() => {
          cache.set("__all__", {});
        });
    }

    let cancelled = false;

    fetchPromise.then(() => {
      if (cancelled) return;
      setFlags(cache.get("__all__") ?? {});
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (name in flags) {
    return flags[name];
  }

  return defaultValue;
}
