import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/test/test-utils";
import { NavigationMenu } from "./NavigationMenu";
import "@testing-library/jest-dom";
import { vi } from "vitest";

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
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => {
    return React.createElement("a", { href, ...props }, children);
  },
}));

describe("NavigationMenu", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
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
      const links = screen.getAllByRole("link");
      links.forEach((link) => {
        expect(link).toHaveAttribute("aria-label");
      });
    });
  });

  describe("active-state derivation for routes", () => {
    it("marks root route /dashboard as active", async () => {
      vi.stubGlobal("window", { location: { pathname: "/dashboard" } });
      render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} />);
      await waitFor(() => {
        const dashboardLink = screen.getByText("Dashboard").closest("a");
        expect(dashboardLink).toHaveAttribute("aria-current", "page");
      });
    });

    it("marks nested route /dashboard/loan as active", async () => {
      vi.stubGlobal("window", { location: { pathname: "/dashboard/loan" } });
      render(<NavigationMenu visibleLinks={["Loan"]} />);
      await waitFor(() => {
        const loanLink = screen.getByText("Loan").closest("a");
        expect(loanLink).toHaveAttribute("aria-current", "page");
      });
    });

    it("marks nested route /dashboard/transactions as active", async () => {
      vi.stubGlobal("window", { location: { pathname: "/dashboard/transactions" } });
      render(<NavigationMenu visibleLinks={["Transactions"]} />);
      await waitFor(() => {
        const transactionsLink = screen.getByText("Transactions").closest("a");
        expect(transactionsLink).toHaveAttribute("aria-current", "page");
      });
    });

    it("marks nested route /dashboard/settings as active", async () => {
      vi.stubGlobal("window", { location: { pathname: "/dashboard/settings" } });
      render(<NavigationMenu visibleLinks={["Settings"]} />);
      await waitFor(() => {
        const settingsLink = screen.getByText("Settings").closest("a");
        expect(settingsLink).toHaveAttribute("aria-current", "page");
      });
    });

    it("does not mark link as active when path does not match", async () => {
      vi.stubGlobal("window", { location: { pathname: "/dashboard" } });
      render(<NavigationMenu visibleLinks={["Settings"]} />);
      await waitFor(() => {
        const settingsLink = screen.getByText("Settings").closest("a");
        expect(settingsLink).not.toHaveAttribute("aria-current");
      });
    });

    it("handles no active route - all links inactive", async () => {
      vi.stubGlobal("window", { location: { pathname: "/unknown-route" } });
      render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} />);
      await waitFor(() => {
        const dashboardLink = screen.getByText("Dashboard").closest("a");
        const settingsLink = screen.getByText("Settings").closest("a");
        expect(dashboardLink).not.toHaveAttribute("aria-current");
        expect(settingsLink).not.toHaveAttribute("aria-current");
      });
    });

    it("active styling uses class/attribute not color alone", async () => {
      vi.stubGlobal("window", { location: { pathname: "/dashboard" } });
      render(<NavigationMenu visibleLinks={["Dashboard"]} />);
      await waitFor(() => {
        const link = screen.getByText("Dashboard").closest("a");
        expect(link).toHaveClass("bg-[#15A350]/15");
        expect(link).toHaveClass("text-[#15A350]");
        const indicator = link?.querySelector("span[aria-hidden='true']");
        expect(indicator).toHaveClass("opacity-100");
      });
    });
  });

  describe("non-route links (click-based active state)", () => {
    it("sets active class on click for link without path", async () => {
      vi.stubGlobal("window", { location: { pathname: "/dashboard" } });
      render(<NavigationMenu visibleLinks={["Fundwallet", "Dashboard"]} />);
      
      const fundwalletLink = screen.getByText("Fundwallet").closest("a");
      expect(fundwalletLink).not.toHaveAttribute("aria-current");
      
      await userEvent.click(fundwalletLink!);
      
      await waitFor(() => {
        expect(fundwalletLink).toHaveAttribute("aria-current", "page");
      });
    });

    it("persists active state to localStorage on click", async () => {
      vi.stubGlobal("window", { location: { pathname: "/" } });
      render(<NavigationMenu visibleLinks={["Fundwallet", "Dashboard"]} />);
      
      const fundwalletLink = screen.getByText("Fundwallet").closest("a");
      await userEvent.click(fundwalletLink!);
      
      expect(localStorage.getItem("activeLink")).toBe("Fundwallet");
    });

    it("restores active state from localStorage on mount", async () => {
      localStorage.setItem("activeLink", "Fundwallet");
      vi.stubGlobal("window", { location: { pathname: "/" } });
      render(<NavigationMenu visibleLinks={["Fundwallet", "Dashboard"]} />);
      
      await waitFor(() => {
        const fundwalletLink = screen.getByText("Fundwallet").closest("a");
        expect(fundwalletLink).toHaveAttribute("aria-current", "page");
      });
    });

    it("click-based active state overrides route-based for non-path links", async () => {
      vi.stubGlobal("window", { location: { pathname: "/dashboard/loan" } });
      render(<NavigationMenu visibleLinks={["Fundwallet", "Loan"]} />);
      
      const fundwalletLink = screen.getByText("Fundwallet").closest("a");
      const loanLink = screen.getByText("Loan").closest("a");
      
      await userEvent.click(fundwalletLink!);
      
      await waitFor(() => {
        expect(fundwalletLink).toHaveAttribute("aria-current", "page");
        expect(loanLink).not.toHaveAttribute("aria-current");
      });
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
      const link = screen.getByText("Dashboard").closest("a");
      expect(link).toHaveClass("px-0");
      expect(link?.parentElement).toHaveClass("flex", "justify-center");
    });

    it("applies expanded classes when isCollapsed is false", () => {
      render(<NavigationMenu visibleLinks={["Dashboard"]} isCollapsed={false} />);
      const link = screen.getByText("Dashboard").closest("a");
      expect(link).not.toHaveClass("px-0");
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
      vi.stubGlobal("window", { location: { pathname: "/dashboard" } });
      const onLinkClick = vi.fn();
      render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} onLinkClick={onLinkClick} />);
      await userEvent.click(screen.getByText("Settings").closest("a")!);
      expect(onLinkClick).toHaveBeenCalledTimes(1);
    });

    it("calls onLinkClick for each link click independently", async () => {
      vi.stubGlobal("window", { location: { pathname: "/dashboard" } });
      const onLinkClick = vi.fn();
      render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} onLinkClick={onLinkClick} />);
      await userEvent.click(screen.getByText("Dashboard").closest("a")!);
      await userEvent.click(screen.getByText("Settings").closest("a")!);
      expect(onLinkClick).toHaveBeenCalledTimes(2);
    });
  });

  describe("edge cases", () => {
    it("handles dynamic segment route", async () => {
      vi.stubGlobal("window", { location: { pathname: "/dashboard/loan/123" } });
      render(<NavigationMenu visibleLinks={["Loan"]} />);
      await waitFor(() => {
        const loanLink = screen.getByText("Loan").closest("a");
        expect(loanLink).not.toHaveAttribute("aria-current", "page");
      });
    });

    it("handles multiple candidate matches - uses exact match", async () => {
      vi.stubGlobal("window", { location: { pathname: "/dashboard" } });
      render(<NavigationMenu visibleLinks={["Dashboard", "Cash and receipt", "Notification"]} />);
      
      await waitFor(() => {
        const dashboardLinks = screen.getAllByText("Dashboard").filter(el => el.closest("a")?.hasAttribute("aria-current"));
        expect(dashboardLinks.length).toBe(1);
      });
    });

    it("handles empty visibleLinks array gracefully", () => {
      render(<NavigationMenu visibleLinks={[]} />);
      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    });

    it("link without explicit label falls back to link name", () => {
      render(<NavigationMenu visibleLinks={["Dashboard"]} />);
      const link = screen.getByRole("link", { name: /dashboard/i });
      expect(link).toHaveAttribute("aria-label", "Dashboard");
    });

    it("inactive indicator bar has opacity-0 class", async () => {
      vi.stubGlobal("window", { location: { pathname: "/dashboard" } });
      render(<NavigationMenu visibleLinks={["Settings"]} />);
      await waitFor(() => {
        const indicator = screen.getByText("Settings").closest("a")?.querySelector("span[aria-hidden='true']");
        expect(indicator).toHaveClass("opacity-0");
      });
    });

    it("inactive link has hover classes for visual feedback", () => {
      render(<NavigationMenu visibleLinks={["Dashboard"]} />);
      const link = screen.getByText("Dashboard").closest("a");
      expect(link).toHaveClass("hover:bg-white/5");
      expect(link).toHaveClass("hover:text-white");
    });
  });
});