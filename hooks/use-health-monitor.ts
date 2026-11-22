"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  classifyHealth,
  formatHealthFactor,
  getHealthFactor,
  isNotifyEnabled,
  loadThresholds,
  rankLevel,
  readLastLevel,
  saveThresholds,
  setNotifyEnabled,
  validateThresholds,
  writeLastLevel,
  type HealthFactor,
  type HealthLevel,
  type Thresholds,
} from "@/lib/health";

export const POLL_INTERVAL_MS = 60_000;
export const MAX_BACKOFF_MS = 5 * 60_000;

export type MonitorStatus = "idle" | "loading" | "ok" | "error";
export type NotificationPermissionState = NotificationPermission | "unsupported";

function currentPermission(): NotificationPermissionState {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export function useHealthMonitor(user: string) {
  const [health, setHealth] = useState<HealthFactor | null>(null);
  const [status, setStatus] = useState<MonitorStatus>("loading");
  const [thresholds, setThresholdsState] = useState<Thresholds>(() =>
    loadThresholds(user),
  );
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    currentPermission(),
  );
  const [notifyOn, setNotifyOn] = useState<boolean>(() => isNotifyEnabled());

  const thresholdsRef = useRef(thresholds);
  const notifyRef = useRef(notifyOn);
  useEffect(() => {
    thresholdsRef.current = thresholds;
  }, [thresholds]);
  useEffect(() => {
    notifyRef.current = notifyOn;
  }, [notifyOn]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function clear() {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    }

    function schedule() {
      clear();
      if (cancelled || document.visibilityState === "hidden") return;
      const delay =
        failures === 0
          ? POLL_INTERVAL_MS
          : Math.min(POLL_INTERVAL_MS * 2 ** failures, MAX_BACKOFF_MS);
      timer = setTimeout(() => void poll(), delay);
    }

    function maybeNotify(next: HealthFactor, level: HealthLevel) {
      const previous = readLastLevel(user);
      writeLastLevel(user, level);
      if (
        previous &&
        rankLevel(level) > rankLevel(previous) &&
        notifyRef.current &&
        currentPermission() === "granted"
      ) {
        try {
          new Notification("StellarLend: health factor alert", {
            body: `Your health factor is now ${formatHealthFactor(next)} (${level}).`,
            tag: `stellarlend-health-${user}`,
          });
        } catch {
          // notifications can throw on some mobile browsers: ignore
        }
      }
    }

    async function poll() {
      if (inFlight || cancelled) return;
      inFlight = true;
      try {
        const next = await getHealthFactor(user);
        if (cancelled) return;
        failures = 0;
        setHealth(next);
        setStatus("ok");
        maybeNotify(next, classifyHealth(next, thresholdsRef.current));
      } catch {
        if (cancelled) return;
        failures += 1;
        setStatus("error");
      } finally {
        inFlight = false;
        schedule();
      }
    }

    function onVisibilityChange() {
      clear();
      if (document.visibilityState === "visible") void poll();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    if (document.visibilityState === "visible") void poll();

    return () => {
      cancelled = true;
      clear();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [user]);

  const setThresholds = useCallback(
    (next: Thresholds): string | null => {
      const error = validateThresholds(next);
      if (error) return error;
      saveThresholds(user, next);
      setThresholdsState(next);
      return null;
    },
    [user],
  );

  const enable = useCallback(async () => {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      setNotifyEnabled(true);
      setNotifyOn(true);
    }
  }, []);

  const disable = useCallback(() => {
    setNotifyEnabled(false);
    setNotifyOn(false);
  }, []);

  const level = health ? classifyHealth(health, thresholds) : null;

  return {
    health,
    level,
    status,
    thresholds,
    setThresholds,
    notifications: {
      permission,
      enabled: notifyOn && permission === "granted",
      enable,
      disable,
    },
  };
}