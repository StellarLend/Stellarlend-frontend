import { renderHook, act } from "@testing-library/react";
import { useReducedMotion } from "../useReducedMotion";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("useReducedMotion", () => {
  let changeListener: ((e: { matches: boolean }) => void) | null = null;

  const createMockMediaQueryList = (initialMatches: boolean) => ({
    matches: initialMatches,
    addEventListener: vi.fn((event, callback) => {
      if (event === "change") {
        changeListener = callback as (e: { matches: boolean }) => void;
      }
    }),
    removeEventListener: vi.fn((event, callback) => {
      if (event === "change") {
        changeListener = null;
      }
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  });

  beforeEach(() => {
    changeListener = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should return false by default (when matches is false)", () => {
    const mockMQL = createMockMediaQueryList(false);
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockReturnValue(mockMQL),
    });

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it("should return true when matches is true", () => {
    const mockMQL = createMockMediaQueryList(true);
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockReturnValue(mockMQL),
    });

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it("should update state when media query changes", () => {
    const mockMQL = createMockMediaQueryList(false);
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockReturnValue(mockMQL),
    });

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    // Simulate change
    act(() => {
      if (changeListener) {
        changeListener({ matches: true });
      }
    });

    expect(result.current).toBe(true);
  });
});
