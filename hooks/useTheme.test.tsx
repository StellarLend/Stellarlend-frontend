import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  parseThemeMode,
  resolveTheme,
  useTheme,
} from "./useTheme";

describe("parseThemeMode / resolveTheme", () => {
  it.each([
    ["light", "light"],
    ["dark", "dark"],
    ["system", "system"],
  ] as const)("accepts %s", (input, expected) => {
    expect(parseThemeMode(input)).toBe(expected);
  });

  it("falls back to system for corrupted or missing values", () => {
    expect(parseThemeMode(null)).toBe("system");
    expect(parseThemeMode(undefined)).toBe("system");
    expect(parseThemeMode("neon")).toBe("system");
    expect(parseThemeMode(42)).toBe("system");
  });

  it("resolves system against the media preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("applyResolvedTheme", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.style.colorScheme = "";
    delete document.documentElement.dataset.theme;
  });

  it("toggles the dark/light classes and color-scheme", () => {
    applyResolvedTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    applyResolvedTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });
});

describe("useTheme", () => {
  let matchMediaListeners: Array<(e: MediaQueryListEvent) => void>;
  let systemDark: boolean;

  beforeEach(() => {
    matchMediaListeners = [];
    systemDark = false;
    window.localStorage.clear();
    document.documentElement.classList.remove("dark", "light");

    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("dark") ? systemDark : false,
        media: query,
        onchange: null,
        addEventListener: (
          _type: string,
          listener: (e: MediaQueryListEvent) => void,
        ) => {
          matchMediaListeners.push(listener);
        },
        removeEventListener: (
          _type: string,
          listener: (e: MediaQueryListEvent) => void,
        ) => {
          matchMediaListeners = matchMediaListeners.filter((l) => l !== listener);
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("defaults to system and rehydrates a stored preference", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    const { result } = renderHook(() => useTheme());

    await waitFor(() => {
      expect(result.current.mode).toBe("dark");
      expect(result.current.resolved).toBe("dark");
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("persists setMode and cycles light → dark → system", async () => {
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.mode).toBe("system"));

    act(() => {
      result.current.setMode("light");
    });
    expect(result.current.mode).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    act(() => {
      result.current.cycleMode();
    });
    expect(result.current.mode).toBe("dark");

    act(() => {
      result.current.cycleMode();
    });
    expect(result.current.mode).toBe("system");

    act(() => {
      result.current.cycleMode();
    });
    expect(result.current.mode).toBe("light");
  });

  it("falls back to system when storage is unavailable", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.mode).toBe("system"));

    act(() => {
      result.current.setMode("dark");
    });
    // Mode still updates in memory even though persistence failed.
    expect(result.current.mode).toBe("dark");

    getItem.mockRestore();
    setItem.mockRestore();
  });

  it("tracks system preference changes while in system mode", async () => {
    systemDark = false;
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.resolved).toBe("light"));

    act(() => {
      systemDark = true;
      for (const listener of matchMediaListeners) {
        listener({ matches: true } as MediaQueryListEvent);
      }
    });

    await waitFor(() => {
      expect(result.current.resolved).toBe("dark");
    });
  });

  it("ignores a corrupted stored value and uses system", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "not-a-theme");
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.mode).toBe("system"));
  });
});
