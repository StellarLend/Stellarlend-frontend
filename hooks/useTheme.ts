"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** localStorage key for the user's theme preference. */
export const THEME_STORAGE_KEY = "stellarlend-theme";

const MODES: readonly ThemeMode[] = ["light", "dark", "system"];

/**
 * Coerce an unknown stored value to a valid ThemeMode.
 * Corrupted / missing values fall back to `system`.
 */
export function parseThemeMode(value: unknown): ThemeMode {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

/** Resolve light/dark given a mode and the current system preference. */
export function resolveTheme(
  mode: ThemeMode,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (mode === "system") {
    return systemPrefersDark ? "dark" : "light";
  }
  return mode;
}

/**
 * Apply a resolved theme to the document root.
 * Uses the `dark` class so existing `dark:` Tailwind utilities activate,
 * and sets `color-scheme` so native form controls match.
 */
export function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  root.style.colorScheme = resolved;
  root.dataset.theme = resolved;
}

function readStoredMode(): ThemeMode {
  try {
    return parseThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // Quota exceeded / private mode / storage blocked.
    return "system";
  }
}

function writeStoredMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Persistence is best-effort; the in-memory mode still applies this session.
  }
}

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export interface UseThemeResult {
  /** User preference: light, dark, or system. */
  mode: ThemeMode;
  /** Concrete theme currently painted. */
  resolved: ResolvedTheme;
  /** Set an explicit preference (persists). */
  setMode: (mode: ThemeMode) => void;
  /** Cycle light → dark → system → light. */
  cycleMode: () => void;
}

/**
 * Theme preference hook for the dashboard shell.
 *
 * - Defaults to `system` and rehydrates from localStorage after mount.
 * - Listens to `prefers-color-scheme` while in system mode.
 * - Applies the resolved theme to `<html>` via `applyResolvedTheme`.
 */
export function useTheme(): UseThemeResult {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Rehydrate preference + system media once on the client.
  useEffect(() => {
    setModeState(readStoredMode());
    setSystemDark(getSystemPrefersDark());
    setHydrated(true);
  }, []);

  // Follow system preference changes while relevant.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      setSystemDark(event.matches);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const resolved = resolveTheme(mode, systemDark);

  // Paint the document whenever the resolved theme changes (after hydration).
  useEffect(() => {
    if (!hydrated) return;
    applyResolvedTheme(resolved);
  }, [hydrated, resolved]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    writeStoredMode(next);
  }, []);

  const cycleMode = useCallback(() => {
    setModeState((current) => {
      const idx = MODES.indexOf(current);
      const next = MODES[(idx + 1) % MODES.length];
      writeStoredMode(next);
      return next;
    });
  }, []);

  return { mode, resolved, setMode, cycleMode };
}
