import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, render } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";

const STORAGE_KEY = "stellarlend_sidebar_v1:collapsed";

const DEFAULT_WIDTH = 1024;

function createWrapper(
  props: { initialSidebarOpen?: boolean; initialIsMobile?: boolean } = {}
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(SidebarProvider, props, children);
  };
}

function renderSidebarHook(
  props: { initialSidebarOpen?: boolean; initialIsMobile?: boolean } = {}
) {
  const wrapper = createWrapper(props);
  return renderHook(() => useSidebar(), { wrapper });
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: DEFAULT_WIDTH,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SidebarContext", () => {
  describe("Provider defaults", () => {
    it("provides default isSidebarOpen as true", () => {
      const { result } = renderSidebarHook();
      expect(result.current.isSidebarOpen).toBe(true);
    });

    it("provides default isMobile as false", () => {
      const { result } = renderSidebarHook();
      expect(result.current.isMobile).toBe(false);
    });
  });

  describe("Actions", () => {
    it("toggleSidebar flips isSidebarOpen from true to false to true", () => {
      const { result } = renderSidebarHook();

      act(() => { result.current.toggleSidebar(); });
      expect(result.current.isSidebarOpen).toBe(false);

      act(() => { result.current.toggleSidebar(); });
      expect(result.current.isSidebarOpen).toBe(true);
    });

    it("closeSidebar sets isSidebarOpen to false", () => {
      const { result } = renderSidebarHook();

      act(() => { result.current.closeSidebar(); });
      expect(result.current.isSidebarOpen).toBe(false);
    });

    it("toggleSidebar and closeSidebar maintain stable references across renders", () => {
      const { result } = renderSidebarHook();

      const firstToggle = result.current.toggleSidebar;
      const firstClose = result.current.closeSidebar;

      act(() => { result.current.toggleSidebar(); });
      expect(result.current.toggleSidebar).toBe(firstToggle);
      expect(result.current.closeSidebar).toBe(firstClose);

      act(() => { result.current.closeSidebar(); });
      expect(result.current.toggleSidebar).toBe(firstToggle);
      expect(result.current.closeSidebar).toBe(firstClose);
    });
  });

  describe("Out-of-provider error guard", () => {
    it("throws when useSidebar is called outside SidebarProvider", () => {
      expect(() => {
        renderHook(() => useSidebar());
      }).toThrow("useSidebar must be used within a SidebarProvider");
    });
  });

  describe("Multiple consumers in sync", () => {
    it("two consumers share the same state and toggle updates both", () => {
      const values: Array<{ isSidebarOpen: boolean; toggleSidebar: () => void }> = [];

      function ConsumerA() {
        const ctx = useSidebar();
        values[0] = ctx;
        return null;
      }

      function ConsumerB() {
        const ctx = useSidebar();
        values[1] = ctx;
        return null;
      }

      render(
        createElement(SidebarProvider, null,
          createElement(ConsumerA),
          createElement(ConsumerB)
        )
      );

      expect(values[0].isSidebarOpen).toBe(true);
      expect(values[1].isSidebarOpen).toBe(true);

      act(() => { values[0].toggleSidebar(); });
      expect(values[0].isSidebarOpen).toBe(false);
      expect(values[1].isSidebarOpen).toBe(false);
    });
  });

  describe("Initial state overrides", () => {
    it("initialSidebarOpen overrides default state", () => {
      const { result } = renderSidebarHook({ initialSidebarOpen: false });
      expect(result.current.isSidebarOpen).toBe(false);
    });

    it("initialSidebarOpen set to true keeps sidebar open", () => {
      const { result } = renderSidebarHook({ initialSidebarOpen: true });
      expect(result.current.isSidebarOpen).toBe(true);
    });

    it("initialIsMobile is used as initial value (effect may overwrite)", () => {
      const { result } = renderSidebarHook({ initialIsMobile: false });
      expect(result.current.isMobile).toBe(false);
    });

    it("mobile viewport overrides initialIsMobile", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 500,
      });

      const { result } = renderSidebarHook({ initialIsMobile: false });
      expect(result.current.isMobile).toBe(true);
    });
  });

  describe("localStorage — read on mount", () => {
    it("reads collapsed state (true) and sets sidebar closed", () => {
      localStorage.setItem(STORAGE_KEY, "true");
      const { result } = renderSidebarHook();
      expect(result.current.isSidebarOpen).toBe(false);
    });

    it("reads not-collapsed state (false) and sets sidebar open", () => {
      localStorage.setItem(STORAGE_KEY, "false");
      const { result } = renderSidebarHook();
      expect(result.current.isSidebarOpen).toBe(true);
    });

    it("does not read localStorage when initialSidebarOpen is provided", () => {
      localStorage.setItem(STORAGE_KEY, "true");
      const { result } = renderSidebarHook({ initialSidebarOpen: true });
      expect(result.current.isSidebarOpen).toBe(true);
    });
  });

  describe("localStorage — write on toggle/close", () => {
    it("persists collapsed=true via toggle on desktop", () => {
      const { result } = renderSidebarHook();

      act(() => { result.current.toggleSidebar(); });
      expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
    });

    it("persists collapsed=false via second toggle on desktop", () => {
      const { result } = renderSidebarHook();

      act(() => { result.current.toggleSidebar(); });
      act(() => { result.current.toggleSidebar(); });
      expect(localStorage.getItem(STORAGE_KEY)).toBe("false");
    });

    it("persists collapsed=true via closeSidebar on desktop", () => {
      const { result } = renderSidebarHook();

      act(() => { result.current.closeSidebar(); });
      expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
    });

    it("does not persist when initialSidebarOpen is provided", () => {
      const { result } = renderSidebarHook({ initialSidebarOpen: true });

      act(() => { result.current.toggleSidebar(); });
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe("localStorage error handling", () => {
    it("handles localStorage setItem error in toggleSidebar gracefully", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("Storage denied");
      });

      const { result } = renderSidebarHook();

      act(() => { result.current.toggleSidebar(); });
      expect(result.current.isSidebarOpen).toBe(false);
    });

    it("handles localStorage setItem error in closeSidebar gracefully", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("Storage denied");
      });

      const { result } = renderSidebarHook();

      act(() => { result.current.closeSidebar(); });
      expect(result.current.isSidebarOpen).toBe(false);
    });

    it("handles localStorage getItem error in checkDimensions gracefully", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("Storage denied");
      });

      const { result } = renderSidebarHook();
      expect(result.current.isSidebarOpen).toBe(true);
    });
  });

  describe("Mobile behavior", () => {
    it("detects mobile on mount when window.innerWidth < 768", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 500,
      });

      const { result } = renderSidebarHook();
      expect(result.current.isMobile).toBe(true);
      expect(result.current.isSidebarOpen).toBe(false);
    });

    it("updates isMobile and closes sidebar on resize below 768px", () => {
      const { result } = renderSidebarHook();

      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 500,
      });

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      expect(result.current.isMobile).toBe(true);
      expect(result.current.isSidebarOpen).toBe(false);
    });

    it("reverts isMobile on resize above 768px", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 500,
      });

      const { result } = renderSidebarHook();

      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024,
      });

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      expect(result.current.isMobile).toBe(false);
    });
  });
});
