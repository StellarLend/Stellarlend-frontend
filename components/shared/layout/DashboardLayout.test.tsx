/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

/**
 * DashboardLayout.test.tsx
 *
 * RTL suite for `components/shared/layout/DashboardLayout.tsx`.
 * Imports match TopNav.test.tsx exactly.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { SidebarProvider } from "@/context/SidebarContext";
import { WalletProvider } from "@/context/WalletContext";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import DashboardLayout from "./DashboardLayout";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    pathname: "/dashboard",
  }),
  usePathname: () => "/dashboard",
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
  }) => <img src={src} alt={alt} width={width} height={height} />,
}));

vi.mock("@/components/shared/layout/NotificationBell", () => ({
  default: () => (
    <button type="button" aria-label="View notifications">
      🔔
    </button>
  ),
}));

vi.mock("@/components/shared/layout/NavigationMenu", () => ({
  NavigationMenu: ({ isCollapsed }: { isCollapsed: boolean }) => (
    <nav
      aria-label="Primary navigation"
      data-collapsed={String(isCollapsed)}
    >
      <a href="/dashboard">Dashboard</a>
      <a href="/lending">Lending</a>
    </nav>
  ),
}));

// ── Render helper ─────────────────────────────────────────────────────────────

const renderLayout = (
  children: React.ReactNode = null,
  sidebarOpen = true,
  isMobile = false,
) =>
  render(
    <WalletProvider>
      <SidebarProvider
        initialSidebarOpen={sidebarOpen}
        initialIsMobile={isMobile}
      >
        <DashboardLayout>{children}</DashboardLayout>
      </SidebarProvider>
    </WalletProvider>,
  );

const stubFetch = () =>
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
  );

// ── 1. Landmark regions ───────────────────────────────────────────────────────

describe("DashboardLayout — landmark regions", () => {
  beforeEach(() => { window.sessionStorage.clear(); stubFetch(); });
  afterEach(() => vi.unstubAllGlobals());

  it("renders a <header> landmark wrapping TopNav", () => {
    renderLayout(<p>Content</p>);
    expect(document.querySelector("header")).not.toBeNull();
  });

  it("renders TopNav search input inside the header", () => {
    renderLayout(<p>Content</p>);
    expect(
      screen.getByPlaceholderText(/search for token, asset, wallet address/i),
    ).toBeInTheDocument();
  });

  it("renders a <nav> landmark with aria-label Primary navigation", () => {
    renderLayout(<p>Content</p>);
    expect(
      screen.getByRole("navigation", { name: /primary navigation/i }),
    ).toBeInTheDocument();
  });

  it("nav landmark contains at least one link", () => {
    renderLayout(<p>Content</p>);
    const nav = screen.getByRole("navigation", { name: /primary navigation/i });
    expect(nav.querySelectorAll("a").length).toBeGreaterThan(0);
  });

  it("renders a <main> landmark", () => {
    renderLayout(<p>Content</p>);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("main landmark has flex-1 class", () => {
    renderLayout(<p>Content</p>);
    expect(screen.getByRole("main")).toHaveClass("flex-1");
  });
});

// ── 2. Children slot ──────────────────────────────────────────────────────────

describe("DashboardLayout — children slot", () => {
  beforeEach(() => { window.sessionStorage.clear(); stubFetch(); });
  afterEach(() => vi.unstubAllGlobals());

  it("renders text children inside the main slot", () => {
    renderLayout(<p>Hello dashboard</p>);
    expect(screen.getByText("Hello dashboard")).toBeInTheDocument();
  });

  it("children are inside the <main> element", () => {
    renderLayout(<p data-testid="slot-child">Slot child</p>);
    expect(screen.getByRole("main")).toContainElement(
      screen.getByTestId("slot-child"),
    );
  });

  it("renders multiple children", () => {
    renderLayout(<><p>Child one</p><p>Child two</p><p>Child three</p></>);
    expect(screen.getByText("Child one")).toBeInTheDocument();
    expect(screen.getByText("Child two")).toBeInTheDocument();
    expect(screen.getByText("Child three")).toBeInTheDocument();
  });

  it("renders deeply nested children", () => {
    renderLayout(<section><article><p data-testid="deep-child">Deep</p></article></section>);
    expect(screen.getByTestId("deep-child")).toBeInTheDocument();
  });

  it("main is present and empty when children is undefined", () => {
    renderLayout(undefined);
    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    expect(main).toBeEmptyDOMElement();
  });

  it("main is present when children is null", () => {
    renderLayout(null);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});

// ── 3. Skip-to-content ────────────────────────────────────────────────────────

describe("DashboardLayout — skip-to-content", () => {
  beforeEach(() => { window.sessionStorage.clear(); stubFetch(); });
  afterEach(() => vi.unstubAllGlobals());

  it("renders a skip-to-content link", () => {
    renderLayout(<p>Content</p>);
    expect(
      screen.getByRole("link", { name: /skip to (main )?content/i }),
    ).toBeInTheDocument();
  });

  it("skip link href points to #main-content", () => {
    renderLayout(<p>Content</p>);
    expect(
      screen.getByRole("link", { name: /skip to (main )?content/i }),
    ).toHaveAttribute("href", "#main-content");
  });

  it("main has id=main-content for the skip link target", () => {
    renderLayout(<p>Content</p>);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("skip link is the first focusable element", () => {
    renderLayout(<p>Content</p>);
    const skipLink = screen.getByRole("link", { name: /skip to (main )?content/i });
    const focusable = document.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    expect(focusable[0]).toBe(skipLink);
  });
});

// ── 4. SidebarContext — expanded ──────────────────────────────────────────────

describe("DashboardLayout — SidebarContext expanded", () => {
  beforeEach(() => { window.sessionStorage.clear(); stubFetch(); });
  afterEach(() => vi.unstubAllGlobals());

  it("nav landmark is present when expanded", () => {
    renderLayout(<p>Content</p>, true, false);
    expect(
      screen.getByRole("navigation", { name: /primary navigation/i }),
    ).toBeInTheDocument();
  });

  it("NavigationMenu receives isCollapsed=false when expanded", () => {
    renderLayout(<p>Content</p>, true, false);
    expect(
      screen.getByRole("navigation", { name: /primary navigation/i }),
    ).toHaveAttribute("data-collapsed", "false");
  });

  it("outer wrapper has flex class", () => {
    const { container } = renderLayout(<p>Content</p>, true, false);
    expect(container.firstChild).toHaveClass("flex");
  });
});

// ── 5. SidebarContext — collapsed ─────────────────────────────────────────────

describe("DashboardLayout — SidebarContext collapsed", () => {
  beforeEach(() => { window.sessionStorage.clear(); stubFetch(); });
  afterEach(() => vi.unstubAllGlobals());

  it("NavigationMenu receives isCollapsed=true when collapsed", () => {
    renderLayout(<p>Content</p>, false, false);
    expect(
      screen.getByRole("navigation", { name: /primary navigation/i }),
    ).toHaveAttribute("data-collapsed", "true");
  });

  it("main slot is accessible when sidebar is collapsed", () => {
    renderLayout(<p data-testid="c-child">Child</p>, false, false);
    expect(screen.getByRole("main")).toContainElement(
      screen.getByTestId("c-child"),
    );
  });

  it("nav and main landmarks present in collapsed state", () => {
    renderLayout(<p>Content</p>, false, false);
    expect(
      screen.getByRole("navigation", { name: /primary navigation/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});

// ── 6. Mobile viewport ────────────────────────────────────────────────────────

describe("DashboardLayout — mobile viewport", () => {
  beforeEach(() => { window.sessionStorage.clear(); stubFetch(); });
  afterEach(() => vi.unstubAllGlobals());

  it("main landmark renders on mobile", () => {
    renderLayout(<p>Mobile content</p>, false, true);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("children render in main slot on mobile", () => {
    renderLayout(<p data-testid="mob-child">Mobile child</p>, false, true);
    expect(screen.getByRole("main")).toContainElement(
      screen.getByTestId("mob-child"),
    );
  });

  it("header landmark renders on mobile", () => {
    renderLayout(<p>Content</p>, false, true);
    expect(document.querySelector("header")).not.toBeNull();
  });
});

// ── 7. Structural composition ─────────────────────────────────────────────────

describe("DashboardLayout — structural composition", () => {
  beforeEach(() => { window.sessionStorage.clear(); stubFetch(); });
  afterEach(() => vi.unstubAllGlobals());

  it("outer wrapper has flex class", () => {
    const { container } = renderLayout(<p>Content</p>);
    expect(container.firstChild).toHaveClass("flex");
  });

  it("content column has w-full and min-h-screen", () => {
    renderLayout(<p>Content</p>);
    const contentColumn = screen.getByRole("main").parentElement;
    expect(contentColumn).toHaveClass("w-full");
    expect(contentColumn).toHaveClass("min-h-screen");
  });

  it("main is a direct child of the content column", () => {
    renderLayout(<p>Content</p>);
    const main = screen.getByRole("main");
    expect(main.parentElement?.querySelector("main")).toBe(main);
  });

  it("header is sibling of main inside content column", () => {
    renderLayout(<p>Content</p>);
    const contentColumn = screen.getByRole("main").parentElement;
    expect(contentColumn?.querySelector("header")).not.toBeNull();
  });
});

// ── 8. Edge cases ─────────────────────────────────────────────────────────────

describe("DashboardLayout — edge cases", () => {
  beforeEach(() => { window.sessionStorage.clear(); stubFetch(); });
  afterEach(() => vi.unstubAllGlobals());

  it("does not throw when children is undefined", () => {
    expect(() => renderLayout(undefined)).not.toThrow();
  });

  it("does not throw when children is null", () => {
    expect(() => renderLayout(null)).not.toThrow();
  });

  it("does not throw when children is empty fragment", () => {
    expect(() => renderLayout(<></>)).not.toThrow();
  });

  it("main landmark always present regardless of children", () => {
    renderLayout(undefined);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("nav landmark always present regardless of children", () => {
    renderLayout(undefined);
    expect(
      screen.getByRole("navigation", { name: /primary navigation/i }),
    ).toBeInTheDocument();
  });
});
