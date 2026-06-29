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
