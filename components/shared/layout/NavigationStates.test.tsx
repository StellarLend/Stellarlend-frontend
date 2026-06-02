import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { vi } from "vitest";
import NavLink from "./NavLink";
import { NavigationMenu } from "./NavigationMenu";
import { SideNav } from "./SideNav";
import Sidebar from "./Sidebar";

// ─── Mock next/navigation ────────────────────────────────────────────────────
const mockPathname = vi.fn(() => "/dashboard");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// ─── Mock framer-motion (SideNav uses it) ────────────────────────────────────
vi.mock("framer-motion", () => ({
  motion: {
    aside: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <aside {...props}>{children}</aside>
    ),
  },
}));

// ─── Mock SidebarContext ──────────────────────────────────────────────────────
vi.mock("@/context/SidebarContext", () => ({
  useSidebar: () => ({
    isSidebarOpen: true,
    closeSidebar: vi.fn(),
    isMobile: true,
    toggleSidebar: vi.fn(),
  }),
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ─── NavLink ─────────────────────────────────────────────────────────────────
describe("NavLink", () => {
  it("renders an anchor for hash hrefs", () => {
    render(<NavLink href="#section">Section</NavLink>);
    expect(screen.getByRole("link", { name: "Section" }).tagName).toBe("A");
  });

  it("marks active when pathname matches href", () => {
    mockPathname.mockReturnValue("/dashboard");
    render(<NavLink href="/dashboard">Dashboard</NavLink>);
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("aria-current", "page");
  });

  it("does not mark active when pathname differs", () => {
    mockPathname.mockReturnValue("/other");
    render(<NavLink href="/dashboard">Dashboard</NavLink>);
    expect(screen.getByRole("link", { name: /dashboard/i })).not.toHaveAttribute("aria-current");
  });

  it("isActive prop overrides pathname detection", () => {
    mockPathname.mockReturnValue("/other");
    render(<NavLink href="/dashboard" isActive>Dashboard</NavLink>);
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("aria-current", "page");
  });

  it("has focus-visible ring classes", () => {
    render(<NavLink href="/dashboard">Dashboard</NavLink>);
    const link = screen.getByRole("link", { name: /dashboard/i });
    expect(link.className).toContain("focus-visible:ring-2");
    expect(link.className).toContain("focus-visible:ring-[#15A350]");
  });

  it("meets minimum touch-target height (py-3.5)", () => {
    render(<NavLink href="/dashboard">Dashboard</NavLink>);
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveClass("py-3.5");
  });

  it("returns null and warns when href is empty", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // @ts-expect-error intentional bad prop
    const { container } = render(<NavLink href="">Bad</NavLink>);
    expect(container.firstChild).toBeNull();
    expect(warn).toHaveBeenCalledWith("NavLink requires a valid href prop.");
    warn.mockRestore();
  });

  it("accepts optional className without error", () => {
    render(<NavLink href="/dashboard" className="extra-class">Dashboard</NavLink>);
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveClass("extra-class");
  });
});

// ─── NavigationMenu ───────────────────────────────────────────────────────────
describe("NavigationMenu", () => {
  beforeEach(() => mockPathname.mockReturnValue("/dashboard"));

  it("renders semantic nav > ul > li structure", () => {
    render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} />);
    expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("marks the current path as aria-current=page", () => {
    render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} />);
    expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Settings").closest("a")).not.toHaveAttribute("aria-current");
  });

  it("does NOT use localStorage for active state", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    render(<NavigationMenu visibleLinks={["Dashboard"]} />);
    expect(getItem).not.toHaveBeenCalled();
    getItem.mockRestore();
  });

  it("calls onLinkClick when a link is clicked", () => {
    const onLinkClick = vi.fn();
    render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} onLinkClick={onLinkClick} />);
    fireEvent.click(screen.getByText("Settings").closest("a")!);
    expect(onLinkClick).toHaveBeenCalledTimes(1);
  });

  it("all links have focus-visible ring classes", () => {
    render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} />);
    screen.getAllByRole("link").forEach((link) => {
      expect(link.className).toContain("focus-visible:ring-2");
      expect(link.className).toContain("focus-visible:ring-[#15A350]");
    });
  });

  it("all links meet minimum touch-target height (py-3.5)", () => {
    render(<NavigationMenu visibleLinks={["Dashboard", "Settings"]} />);
    screen.getAllByRole("link").forEach((link) => {
      expect(link).toHaveClass("py-3.5");
    });
  });

  it("renders all links when visibleLinks is omitted", () => {
    render(<NavigationMenu />);
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(1);
  });
});

// ─── SideNav ─────────────────────────────────────────────────────────────────
describe("SideNav", () => {
  it("renders the close button with aria-label and focus-visible ring", () => {
    render(<SideNav />);
    const closeBtn = screen.getByRole("button", { name: /close sidebar/i });
    expect(closeBtn).toBeInTheDocument();
    expect(closeBtn.className).toContain("focus-visible:ring-2");
    expect(closeBtn.className).toContain("focus-visible:ring-[#15A350]");
  });
});

// ─── Sidebar ─────────────────────────────────────────────────────────────────
describe("Sidebar", () => {
  it("renders with correct navigation role", () => {
    render(<Sidebar />);
    expect(screen.getByRole("navigation", { name: /sidebar navigation/i })).toBeInTheDocument();
  });
});
