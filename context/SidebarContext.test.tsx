import React from "react";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SidebarProvider, useSidebar } from "./SidebarContext";

// A clean utility component to expose context hooks during assertions
const TestComponent = () => {
  const { isSidebarOpen, isMobile, toggleSidebar, closeSidebar } = useSidebar();
  return (
    <div>
      <span data-testid="status">{isSidebarOpen ? "open" : "closed"}</span>
      <span data-testid="mobile-status">{isMobile ? "mobile" : "desktop"}</span>
      <button data-testid="toggle-btn" onClick={toggleSidebar}>Toggle</button>
      <button data-testid="close-btn" onClick={closeSidebar}>Close</button>
    </div>
  );
};

describe("SidebarContext Persisted State", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    // Reset window width to a standard desktop screen before each test
    window.innerWidth = 1024;
  });

  it("should default to open (true) on initial desktop render", () => {
    render(
      <SidebarProvider>
        <TestComponent />
      </SidebarProvider>
    );
    expect(screen.getByTestId("status").textContent).toBe("open");
    expect(screen.getByTestId("mobile-status").textContent).toBe("desktop");
  });

  it("should respect initial props if explicitly provided", () => {
    render(
      <SidebarProvider initialSidebarOpen={false} initialIsMobile={true}>
        <TestComponent />
      </SidebarProvider>
    );
    expect(screen.getByTestId("status").textContent).toBe("closed");
    expect(screen.getByTestId("mobile-status").textContent).toBe("mobile");
  });

  it("should hydrate state from localStorage if a preference exists", () => {
    // stellarlend_sidebar_v1:collapsed = true means the sidebar is closed
    localStorage.setItem("stellarlend_sidebar_v1:collapsed", "true");
    
    render(
      <SidebarProvider>
        <TestComponent />
      </SidebarProvider>
    );

    expect(screen.getByTestId("status").textContent).toBe("closed");
  });

  it("should persist state to localStorage when toggled on desktop", () => {
    render(
      <SidebarProvider>
        <TestComponent />
      </SidebarProvider>
    );

    const toggleBtn = screen.getByTestId("toggle-btn");
    
    // Toggle closes it
    act(() => {
      toggleBtn.click();
    });
    expect(screen.getByTestId("status").textContent).toBe("closed");
    expect(localStorage.getItem("stellarlend_sidebar_v1:collapsed")).toBe("true");

    // Toggle opens it
    act(() => {
      toggleBtn.click();
    });
    expect(screen.getByTestId("status").textContent).toBe("open");
    expect(localStorage.getItem("stellarlend_sidebar_v1:collapsed")).toBe("false");
  });

  it("should persist state to localStorage when closeSidebar is called on desktop", () => {
    render(
      <SidebarProvider>
        <TestComponent />
      </SidebarProvider>
    );

    const closeBtn = screen.getByTestId("close-btn");
    
    act(() => {
      closeBtn.click();
    });
    expect(screen.getByTestId("status").textContent).toBe("closed");
    expect(localStorage.getItem("stellarlend_sidebar_v1:collapsed")).toBe("true");
  });

  it("should force sidebar closed on mobile screens and skip storage write", () => {
    window.innerWidth = 500; // Mobile width trigger

    render(
      <SidebarProvider>
        <TestComponent />
      </SidebarProvider>
    );

    expect(screen.getByTestId("mobile-status").textContent).toBe("mobile");
    expect(screen.getByTestId("status").textContent).toBe("closed");
    // Should NOT write to localStorage just because the screen resized
    expect(localStorage.getItem("stellarlend_sidebar_v1:collapsed")).toBeNull();
  });

  it("should handle storage exceptions gracefully (Private Browsing Safeguard)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError or SecurityError");
    });
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <SidebarProvider>
        <TestComponent />
      </SidebarProvider>
    );

    const closeBtn = screen.getByTestId("close-btn");
    
    // Action should still succeed internally even if storage engine is broken
    act(() => {
      closeBtn.click();
    });
    
    expect(screen.getByTestId("status").textContent).toBe("closed");
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it("should throw an error if useSidebar is invoked outside its Provider boundary", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<TestComponent />)).toThrowError(
      "useSidebar must be used within a SidebarProvider"
    );

    consoleErrorSpy.mockRestore();
  });
});