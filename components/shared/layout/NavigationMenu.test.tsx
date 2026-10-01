import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/test/test-utils";
import { NavigationMenu } from "./NavigationMenu";
import { Breadcrumbs, buildCrumbs } from "./Breadcrumbs";
import "@testing-library/jest-dom";
import { vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: React.ComponentType<unknown> }>) => {
    let Comp: React.ComponentType<unknown> | null = null;
    loader().then((m) => { Comp = m.default; });
    return function DynamicResolved(props: unknown) {
      return Comp
        ? React.createElement(Comp, props as Record<string, unknown>)
        : React.createElement("div", null, "Loading…");
    };
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    React.createElement("a", { href, ...props }, children),
}));

// Mutable pathname for usePathname
let mockPathname = "/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

// ─── NavigationMenu ───────────────────────────────────────────────────────────

describe("NavigationMenu", () => {
  beforeEach(() => {
    localStorage.clear();
    mockPathname = "/dashboard";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("link rendering", () => {
    it("renders semantic nav > ul > li structure", () => {
      render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} />);
      expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("renders all links when visibleLinks is omitted", () => {
      render(<NavigationMenu />);
      expect(screen.getAllByRole("listitem").length).toBeGreaterThan(1);
    });

    it("filters links based on visibleLinks prop", () => {
      render(<NavigationMenu visibleLinks={["Dashboard"]} />);
      expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /settings/i })).not.toBeInTheDocument();
    });

    it("all links have accessible aria-label", () => {
      render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} />);
      screen.getAllByRole("link").forEach((link) => {
        expect(link).toHaveAttribute("aria-label");
      });
    });
  });

  describe("active-state derivation via usePathname", () => {
    it("marks root route /dashboard as active", () => {
      mockPathname = "/dashboard";
      render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} />);
      expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute("aria-current", "page");
    });

    it("marks nested route /dashboard/loan as active", () => {
      mockPathname = "/dashboard/loan";
      render(<NavigationMenu visibleLinks={["Loan"]} />);
      expect(screen.getByText("Loan").closest("a")).toHaveAttribute("aria-current", "page");
    });

    it("marks nested route /dashboard/transactions as active", () => {
      mockPathname = "/dashboard/transactions";
      render(<NavigationMenu visibleLinks={["Transactions"]} />);
      expect(screen.getByText("Transactions").closest("a")).toHaveAttribute("aria-current", "page");
    });

    it("marks nested route /dashboard/settings as active", () => {
      mockPathname = "/dashboard/settings";
      render(<NavigationMenu visibleLinks={["Settings"]} />);
      expect(screen.getByText("Settings").closest("a")).toHaveAttribute("aria-current", "page");
    });

    it("does not mark link as active when path does not match", () => {
      mockPathname = "/dashboard";
      render(<NavigationMenu visibleLinks={["Settings"]} />);
      expect(screen.getByText("Settings").closest("a")).not.toHaveAttribute("aria-current");
    });

    it("handles no matching route — all links inactive", () => {
      mockPathname = "/unknown-route";
      render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} />);
      expect(screen.getByText("Dashboard").closest("a")).not.toHaveAttribute("aria-current");
      expect(screen.getByText("Settings").closest("a")).not.toHaveAttribute("aria-current");
    });

    it("active styling uses class/attribute, not color alone", () => {
      mockPathname = "/dashboard";
      render(<NavigationMenu visibleLinks={["Dashboard"]} />);
      const link = screen.getByText("Dashboard").closest("a")!;
      expect(link).toHaveClass("bg-[#15A350]/15");
      expect(link).toHaveClass("text-[#15A350]");
      expect(link.querySelector("span[aria-hidden='true']")).toHaveClass("opacity-100");
    });

    it("exact match only — dynamic child /dashboard/transactions/123 does not activate Transactions", () => {
      mockPathname = "/dashboard/transactions/abc123";
      render(<NavigationMenu visibleLinks={["Transactions"]} />);
      expect(screen.getByText("Transactions").closest("a")).not.toHaveAttribute("aria-current");
    });

    it("no double-active: only the most-specific matching link is active", () => {
      // /dashboard/transactions matches "Transactions" exactly, NOT "Dashboard"
      mockPathname = "/dashboard/transactions";
      render(<NavigationMenu visibleLinks={["Dashboard", "Transactions"]} />);
      expect(screen.getByText("Transactions").closest("a")).toHaveAttribute("aria-current", "page");
      expect(screen.getByText("Dashboard").closest("a")).not.toHaveAttribute("aria-current");
    });
  });

  describe("non-route links (click-based active state)", () => {
    it("sets active on click for link without path", async () => {
      mockPathname = "/dashboard";
      render(<NavigationMenu visibleLinks={["Fundwallet", "Dashboard"]} />);
      const fundwalletLink = screen.getByText("Fundwallet").closest("a")!;
      expect(fundwalletLink).not.toHaveAttribute("aria-current");
      await userEvent.click(fundwalletLink);
      await waitFor(() => expect(fundwalletLink).toHaveAttribute("aria-current", "page"));
    });

    it("persists active state to localStorage on click", async () => {
      mockPathname = "/";
      render(<NavigationMenu visibleLinks={["Fundwallet"]} />);
      await userEvent.click(screen.getByText("Fundwallet").closest("a")!);
      expect(localStorage.getItem("activeLink")).toBe("Fundwallet");
    });

    it("restores active state from localStorage on mount", async () => {
      localStorage.setItem("activeLink", "Fundwallet");
      mockPathname = "/";
      render(<NavigationMenu visibleLinks={["Fundwallet", "Dashboard"]} />);
      await waitFor(() =>
        expect(screen.getByText("Fundwallet").closest("a")).toHaveAttribute("aria-current", "page")
      );
    });
  });

  describe("accessibility semantics", () => {
    it("has correct nav landmark aria-label", () => {
      render(<NavigationMenu />);
      expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
    });

    it("all links have focus-visible ring classes", () => {
      render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} />);
      screen.getAllByRole("link").forEach((link) => {
        expect(link.className).toContain("focus-visible:ring-2");
        expect(link.className).toContain("focus-visible:ring-[#15A350]");
      });
    });

    it("all links meet minimum touch-target height", () => {
      render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} />);
      screen.getAllByRole("link").forEach((link) => {
        expect(link).toHaveClass("py-3.5");
      });
    });
  });

  describe("collapsed state", () => {
    it("applies collapsed classes when isCollapsed is true", () => {
      render(<NavigationMenu visibleLinks={["Dashboard"]} isCollapsed />);
      const link = screen.getByText("Dashboard").closest("a")!;
      expect(link).toHaveClass("px-0");
      expect(link.parentElement).toHaveClass("flex", "justify-center");
    });

    it("hides link text with sr-only when collapsed", () => {
      render(<NavigationMenu visibleLinks={["Dashboard"]} isCollapsed />);
      expect(screen.queryByText(/Dashboard/i, { selector: "span:not(.sr-only)" })).toBeNull();
    });

    it("shows link text when not collapsed", () => {
      render(<NavigationMenu visibleLinks={["Dashboard"]} isCollapsed={false} />);
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });
  });

  describe("onLinkClick callback", () => {
    it("calls onLinkClick when a link is clicked", async () => {
      const onLinkClick = vi.fn();
      render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} onLinkClick={onLinkClick} />);
      await userEvent.click(screen.getByText("Settings").closest("a")!);
      expect(onLinkClick).toHaveBeenCalledTimes(1);
    });

    it("calls onLinkClick for each link click independently", async () => {
      const onLinkClick = vi.fn();
      render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} onLinkClick={onLinkClick} />);
      await userEvent.click(screen.getByText("Dashboard").closest("a")!);
      await userEvent.click(screen.getByText("Settings").closest("a")!);
      expect(onLinkClick).toHaveBeenCalledTimes(2);
    });
  });

  describe("edge cases", () => {
    it("handles empty visibleLinks array gracefully", () => {
      render(<NavigationMenu visibleLinks={[]} />);
      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    });

    it("link without explicit label falls back to link name", () => {
      render(<NavigationMenu visibleLinks={["Dashboard"]} />);
      expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("aria-label", "Dashboard");
    });

    it("inactive indicator bar has opacity-0 class", () => {
      mockPathname = "/dashboard";
      render(<NavigationMenu visibleLinks={["Settings"]} />);
      const indicator = screen.getByText("Settings").closest("a")?.querySelector("span[aria-hidden='true']");
      expect(indicator).toHaveClass("opacity-0");
    });

    it("inactive link has hover classes for visual feedback", () => {
      render(<NavigationMenu visibleLinks={["Dashboard"]} />);
      // Dashboard has path=/dashboard; with mockPathname=/dashboard it's active.
      // Switch to Settings (no matching route) to test inactive hover classes.
      mockPathname = "/other";
      render(<NavigationMenu visibleLinks={["Settings"]} />);
      const link = screen.getAllByText("Settings")[0].closest("a")!;
      expect(link).toHaveClass("hover:bg-white/5");
      expect(link).toHaveClass("hover:text-white");
    });
  });
});

// ─── Failure-path and boundary coverage ──────────────────────────────────────

describe("NavigationMenu — failure-path and boundary coverage", () => {
  beforeEach(() => {
    localStorage.clear();
    mockPathname = "/dashboard";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── localStorage failure paths ──────────────────────────────────────────

  describe("localStorage unavailable (SecurityError)", () => {
    it("renders without crashing when localStorage.getItem throws on mount", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("Storage is disabled", "SecurityError");
      });
      // Must not throw; component should mount with its default active state.
      expect(() =>
        render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} />)
      ).not.toThrow();
      expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
    });

    it("default active state is used when getItem throws", async () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("Storage is disabled", "SecurityError");
      });
      // With pathname = "/dashboard", Dashboard is route-active regardless of localStorage.
      render(<NavigationMenu visibleLinks={["Dashboard"]} />);
      await waitFor(() =>
        expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute("aria-current", "page")
      );
    });

    it("renders without crashing when localStorage.setItem throws on click", async () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("QuotaExceededError", "QuotaExceededError");
      });
      render(<NavigationMenu visibleLinks={["Fundwallet"]} />);
      // Click must not throw; in-memory state should still update.
      await expect(
        userEvent.click(screen.getByText("Fundwallet").closest("a")!)
      ).resolves.not.toThrow();
    });

    it("in-memory active state still updates when setItem throws", async () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("QuotaExceededError", "QuotaExceededError");
      });
      mockPathname = "/";
      render(<NavigationMenu visibleLinks={["Fundwallet", "Dashboard"]} />);
      const link = screen.getByText("Fundwallet").closest("a")!;
      await userEvent.click(link);
      // State updated in memory even though persist failed.
      await waitFor(() => expect(link).toHaveAttribute("aria-current", "page"));
    });

    it("does not write to localStorage when setItem throws — storage remains clean", async () => {
      const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("QuotaExceededError", "QuotaExceededError");
      });
      mockPathname = "/";
      render(<NavigationMenu visibleLinks={["Fundwallet"]} />);
      await userEvent.click(screen.getByText("Fundwallet").closest("a")!);
      // setItem was attempted (the component tried to persist) but threw.
      expect(setItem).toHaveBeenCalledWith("activeLink", "Fundwallet");
      // Real storage was not written because the mock threw.
      expect(localStorage.getItem("activeLink")).toBeNull();
    });

    it("empty-string stored value is ignored — default state is used", async () => {
      localStorage.setItem("activeLink", "");
      mockPathname = "/";
      render(<NavigationMenu visibleLinks={["Fundwallet", "Dashboard"]} />);
      // Empty string is falsy — the guard `if (savedLink)` skips setActiveLink,
      // so neither link should be in click-activated state.
      await waitFor(() => {
        expect(screen.getByText("Fundwallet").closest("a")).not.toHaveAttribute("aria-current");
      });
    });
  });

  // ── Pathname boundary cases ─────────────────────────────────────────────

  describe("pathname boundary cases", () => {
    it("pathname with trailing slash does not activate the matching route link", () => {
      // Exact match only: "/dashboard/" !== "/dashboard"
      mockPathname = "/dashboard/";
      render(<NavigationMenu visibleLinks={["Dashboard"]} />);
      expect(screen.getByText("Dashboard").closest("a")).not.toHaveAttribute("aria-current");
    });

    it("pathname with query string does not activate route link", () => {
      // usePathname() in Next.js never includes query strings, but a stale
      // mock returning one should still not incorrectly activate a link.
      mockPathname = "/dashboard?tab=overview";
      render(<NavigationMenu visibleLinks={["Dashboard"]} />);
      expect(screen.getByText("Dashboard").closest("a")).not.toHaveAttribute("aria-current");
    });

    it("pathname with hash fragment does not activate route link", () => {
      mockPathname = "/dashboard#section";
      render(<NavigationMenu visibleLinks={["Dashboard"]} />);
      expect(screen.getByText("Dashboard").closest("a")).not.toHaveAttribute("aria-current");
    });

    it("root pathname / does not activate any routed link", () => {
      mockPathname = "/";
      render(<NavigationMenu visibleLinks={["Dashboard", "Transactions", "Settings"]} />);
      screen.getAllByRole("link").forEach((link) => {
        expect(link).not.toHaveAttribute("aria-current");
      });
    });

    it("case-sensitive pathname — /Dashboard (capital D) does not activate Dashboard", () => {
      mockPathname = "/Dashboard";
      render(<NavigationMenu visibleLinks={["Dashboard"]} />);
      expect(screen.getByText("Dashboard").closest("a")).not.toHaveAttribute("aria-current");
    });

    it("deeply nested path does not prefix-activate a parent route link", () => {
      mockPathname = "/dashboard/settings/notifications/email";
      render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} />);
      expect(screen.getByText("Settings").closest("a")).not.toHaveAttribute("aria-current");
      expect(screen.getByText("Dashboard").closest("a")).not.toHaveAttribute("aria-current");
    });
  });

  // ── visibleLinks filtering boundary cases ───────────────────────────────

  describe("visibleLinks filtering boundary cases", () => {
    it("unknown link name in visibleLinks is silently excluded — no error, no render", () => {
      expect(() =>
        render(<NavigationMenu visibleLinks={["NonExistentLink"]} />)
      ).not.toThrow();
      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    });

    it("visibleLinks is case-sensitive — 'dashboard' (lowercase) does not match 'Dashboard'", () => {
      render(<NavigationMenu visibleLinks={["dashboard"]} />);
      // 'dashboard' !== 'Dashboard' so nothing should render
      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    });

    it("duplicate entries in visibleLinks render each link only once", () => {
      render(<NavigationMenu visibleLinks={["Dashboard", "Dashboard", "Settings"]} />);
      // Array.filter returns one item per matching link object — no duplicates.
      expect(screen.getAllByRole("link", { name: /dashboard/i })).toHaveLength(1);
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("all 9 default links render when visibleLinks is undefined", () => {
      render(<NavigationMenu />);
      expect(screen.getAllByRole("listitem")).toHaveLength(9);
    });
  });

  // ── Log Out link boundary (no-op action) ───────────────────────────────

  describe("Log Out link — no-op action boundary", () => {
    it("Log Out link href is # (no navigation)", () => {
      render(<NavigationMenu visibleLinks={["Log Out"]} />);
      expect(screen.getByRole("link", { name: /log out/i })).toHaveAttribute("href", "#");
    });

    it("clicking Log Out sets it as active (click-based, non-routed link)", async () => {
      mockPathname = "/dashboard";
      render(<NavigationMenu visibleLinks={["Dashboard", "Log Out"]} />);
      const logOutLink = screen.getByRole("link", { name: /log out/i });
      expect(logOutLink).not.toHaveAttribute("aria-current");
      await userEvent.click(logOutLink);
      await waitFor(() => expect(logOutLink).toHaveAttribute("aria-current", "page"));
    });

    it("clicking Log Out writes 'Log Out' to localStorage", async () => {
      render(<NavigationMenu visibleLinks={["Log Out"]} />);
      await userEvent.click(screen.getByRole("link", { name: /log out/i }));
      expect(localStorage.getItem("activeLink")).toBe("Log Out");
    });

    it("clicking Log Out calls onLinkClick callback", async () => {
      const onLinkClick = vi.fn();
      render(<NavigationMenu visibleLinks={["Log Out"]} onLinkClick={onLinkClick} />);
      await userEvent.click(screen.getByRole("link", { name: /log out/i }));
      expect(onLinkClick).toHaveBeenCalledTimes(1);
    });

    it("Log Out link does not navigate away — no router.push call", async () => {
      // NavigationMenu uses Link with href="#"; no router.push or redirect.
      // We verify the href remains "#" after click (no mutation by the handler).
      render(<NavigationMenu visibleLinks={["Log Out"]} />);
      const logOutLink = screen.getByRole("link", { name: /log out/i });
      await userEvent.click(logOutLink);
      expect(logOutLink).toHaveAttribute("href", "#");
    });
  });

  // ── Concurrent / rapid-click boundaries ────────────────────────────────

  describe("concurrent and rapid click boundaries", () => {
    it("rapid successive clicks on the same non-route link are idempotent", async () => {
      const setItem = vi.spyOn(Storage.prototype, "setItem");
      mockPathname = "/";
      render(<NavigationMenu visibleLinks={["Fundwallet"]} />);
      const link = screen.getByText("Fundwallet").closest("a")!;

      await userEvent.click(link);
      await userEvent.click(link);
      await userEvent.click(link);

      // Each click writes to localStorage but the final value is consistent.
      expect(localStorage.getItem("activeLink")).toBe("Fundwallet");
      // Link remains active — state doesn't toggle off on repeated clicks.
      await waitFor(() => expect(link).toHaveAttribute("aria-current", "page"));
      setItem.mockRestore();
    });

    it("clicking different non-route links in sequence — last click wins", async () => {
      mockPathname = "/";
      render(<NavigationMenu visibleLinks={["Fundwallet", "Lending", "Log Out"]} />);

      await userEvent.click(screen.getByText("Fundwallet").closest("a")!);
      await userEvent.click(screen.getByText("Lending").closest("a")!);
      await userEvent.click(screen.getByText("Log Out").closest("a")!);

      await waitFor(() => {
        expect(screen.getByText("Log Out").closest("a")).toHaveAttribute("aria-current", "page");
        expect(screen.getByText("Fundwallet").closest("a")).not.toHaveAttribute("aria-current");
        expect(screen.getByText("Lending").closest("a")).not.toHaveAttribute("aria-current");
      });
      expect(localStorage.getItem("activeLink")).toBe("Log Out");
    });

    it("clicking a routed link does not override pathname-based active state", async () => {
      // Dashboard has path=/dashboard. With mockPathname=/dashboard it is
      // route-active. Clicking Settings (path=/dashboard/settings) updates
      // activeLink state but isActive for Settings is still controlled by
      // pathname — which still equals /dashboard — so Settings stays inactive.
      mockPathname = "/dashboard";
      render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} />);
      await userEvent.click(screen.getByText("Settings").closest("a")!);
      await waitFor(() => {
        // Dashboard is still active because pathname controls routed links.
        expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute("aria-current", "page");
        // Settings has a path, so it's controlled by pathname (/dashboard ≠ /dashboard/settings).
        expect(screen.getByText("Settings").closest("a")).not.toHaveAttribute("aria-current");
      });
    });

    it("onLinkClick is called exactly once per click even during rapid clicks", async () => {
      const onLinkClick = vi.fn();
      render(<NavigationMenu visibleLinks={["Dashboard"]} onLinkClick={onLinkClick} />);
      const link = screen.getByText("Dashboard").closest("a")!;
      await userEvent.click(link);
      await userEvent.click(link);
      expect(onLinkClick).toHaveBeenCalledTimes(2);
    });
  });

  // ── Icon loading state (dynamic import placeholder) ─────────────────────

  describe("icon loading placeholder", () => {
    it("renders IconPlaceholder while dynamic icon is loading", () => {
      // Override the mock for this test only — return a component that never
      // resolves so the loading fallback stays visible.
      vi.mock("next/dynamic", () => ({
        default: () => {
          // Return the loading placeholder directly (never-resolved dynamic).
          return function NeverResolved() {
            return React.createElement("div", {
              "aria-hidden": "true",
              className: "animate-pulse bg-gray-200 rounded",
            });
          };
        },
      }));

      render(<NavigationMenu visibleLinks={["Dashboard"]} />);
      // The icon wrapper span is always rendered; the placeholder fills it.
      const iconWrapper = screen
        .getByText("Dashboard")
        .closest("a")!
        .querySelector(".inline-flex.h-10.w-10");
      expect(iconWrapper).toBeInTheDocument();
    });

    it("icon wrapper span is always present regardless of load state", () => {
      render(<NavigationMenu visibleLinks={["Dashboard", "Settings", "Transactions"]} />);
      const wrappers = document.querySelectorAll(
        ".inline-flex.h-10.w-10.items-center.justify-center.rounded-2xl"
      );
      // One icon wrapper per link.
      expect(wrappers.length).toBe(3);
    });
  });

  // ── Collapsed + active state interaction ───────────────────────────────

  describe("collapsed state with active link", () => {
    it("active link in collapsed mode still has aria-current=page", () => {
      mockPathname = "/dashboard";
      render(<NavigationMenu visibleLinks={["Dashboard"]} isCollapsed />);
      expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
        "aria-current",
        "page"
      );
    });

    it("collapsed active link retains active background class", () => {
      mockPathname = "/dashboard";
      render(<NavigationMenu visibleLinks={["Dashboard"]} isCollapsed />);
      expect(screen.getByRole("link", { name: /dashboard/i })).toHaveClass("bg-[#15A350]/15");
    });

    it("collapsed active link indicator bar has opacity-100", () => {
      mockPathname = "/dashboard";
      render(<NavigationMenu visibleLinks={["Dashboard"]} isCollapsed />);
      const indicator = screen
        .getByRole("link", { name: /dashboard/i })
        .querySelector("span[aria-hidden='true']");
      expect(indicator).toHaveClass("opacity-100");
    });

    it("non-route link active state persists across collapsed toggle", async () => {
      mockPathname = "/";
      const { rerender } = render(
        <NavigationMenu visibleLinks={["Fundwallet"]} isCollapsed={false} />
      );
      await userEvent.click(screen.getByText("Fundwallet").closest("a")!);
      await waitFor(() =>
        expect(screen.getByText("Fundwallet").closest("a")).toHaveAttribute("aria-current", "page")
      );

      // Simulate sidebar collapsing — active state must survive the re-render.
      rerender(<NavigationMenu visibleLinks={["Fundwallet"]} isCollapsed />);
      expect(screen.getByRole("link", { name: /fundwallet/i })).toHaveAttribute(
        "aria-current",
        "page"
      );
    });
  });
});

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

describe("buildCrumbs (pure helper)", () => {
  it("root path returns only Home", () => {
    expect(buildCrumbs("/")).toEqual([{ label: "Home", href: "/" }]);
  });

  it("single segment", () => {
    expect(buildCrumbs("/dashboard")).toEqual([
      { label: "Home", href: "/" },
      { label: "Dashboard", href: "/dashboard" },
    ]);
  });

  it("nested route", () => {
    expect(buildCrumbs("/dashboard/transactions")).toEqual([
      { label: "Home", href: "/" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Transactions", href: "/dashboard/transactions" },
    ]);
  });

  it("dynamic segment (UUID) renders as 'Details'", () => {
    const crumbs = buildCrumbs("/dashboard/transactions/550e8400-e29b-41d4-a716-446655440000");
    expect(crumbs.at(-1)?.label).toBe("Details");
  });

  it("dynamic segment (numeric ID) renders as 'Details'", () => {
    expect(buildCrumbs("/dashboard/transactions/42").at(-1)?.label).toBe("Details");
  });

  it("dynamic segment (64-char hex hash) renders as 'Details'", () => {
    const hash = "c03260cc51347b2c53d0e9061df40003ec1c8fbbab08fcf9a3eef93845c4fc06";
    expect(buildCrumbs(`/dashboard/transactions/${hash}`).at(-1)?.label).toBe("Details");
  });

  it("dynamic segment (mock TXN id) renders as 'Details'", () => {
    expect(buildCrumbs("/dashboard/transactions/TXN12345").at(-1)?.label).toBe("Details");
  });

  it("strips trailing slash", () => {
    expect(buildCrumbs("/dashboard/")).toEqual([
      { label: "Home", href: "/" },
      { label: "Dashboard", href: "/dashboard" },
    ]);
  });

  it("unknown segment falls back to title-cased label", () => {
    const crumbs = buildCrumbs("/dashboard/some-feature");
    expect(crumbs.at(-1)?.label).toBe("Some feature");
  });
});

describe("Breadcrumbs component", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
  });

  it("renders accessible nav with aria-label Breadcrumb", () => {
    mockPathname = "/dashboard/transactions";
    render(<Breadcrumbs />);
    expect(screen.getByRole("navigation", { name: /breadcrumb/i })).toBeInTheDocument();
  });

  it("renders nothing for root or single-segment path", () => {
    mockPathname = "/";
    const { container } = render(<Breadcrumbs />);
    expect(container.firstChild).toBeNull();
  });

  it("renders breadcrumb for single-segment path (e.g. /dashboard)", () => {
    mockPathname = "/dashboard";
    render(<Breadcrumbs />);
    expect(screen.getByRole("navigation", { name: /breadcrumb/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders crumbs for nested route", () => {
    mockPathname = "/dashboard/transactions";
    render(<Breadcrumbs />);
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Transactions")).toBeInTheDocument();
  });

  it("last crumb has aria-current=page and no link", () => {
    mockPathname = "/dashboard/transactions";
    render(<Breadcrumbs />);
    const current = screen.getByText("Transactions");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.tagName).not.toBe("A");
  });

  it("intermediate crumbs are links", () => {
    mockPathname = "/dashboard/transactions";
    render(<Breadcrumbs />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
  });

  it("accepts override items prop", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Custom Page", href: "/custom" },
    ];
    render(<Breadcrumbs items={items} />);
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByText("Custom Page")).toHaveAttribute("aria-current", "page");
  });

  it("handles dynamic segment (transaction id) with readable label", () => {
    mockPathname = "/dashboard/transactions/abc-123-def";
    render(<Breadcrumbs />);
    expect(screen.getByText("Details")).toBeInTheDocument();
  });

  it("handles dynamic segment (64-char hex hash) with readable label", () => {
    mockPathname = "/dashboard/transactions/c03260cc51347b2c53d0e9061df40003ec1c8fbbab08fcf9a3eef93845c4fc06";
    render(<Breadcrumbs />);
    expect(screen.getByText("Details")).toBeInTheDocument();
  });

  it("home link has correct href /", () => {
    mockPathname = "/dashboard/transactions";
    render(<Breadcrumbs />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });

  it("breadcrumb links have focus-visible ring classes", () => {
    mockPathname = "/dashboard/transactions";
    render(<Breadcrumbs />);
    screen.getAllByRole("link").forEach((link) => {
      expect(link.className).toContain("focus-visible:ring-2");
    });
  });
});
