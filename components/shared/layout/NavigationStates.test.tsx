import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Sidebar from "./Sidebar";
import NavLink from "./NavLink";
import { SideNav } from "./SideNav";
import { NavigationMenu } from "./NavigationMenu";
import { SidebarProvider } from "@/context/SidebarContext";
import "@testing-library/jest-dom";
import { vi } from "vitest";
import NavLink from "./NavLink";
import { NavigationMenu } from "./NavigationMenu";
import { SideNav } from "./SideNav";
import Sidebar from "./Sidebar";

describe("Navigation UI/UX", () => {
  it("Sidebar renders all nav items with correct roles", () => {
    render(
      <SidebarProvider initialSidebarOpen={true} initialIsMobile={false}>
        <Sidebar />
      </SidebarProvider>
    );
    expect(screen.getByRole("navigation", { name: /sidebar navigation/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Profile Settings/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Password/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Notification/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Verification/i })).toBeInTheDocument();
  });

  it("marks active when pathname matches href", () => {
    mockPathname.mockReturnValue("/dashboard");
    render(<NavLink href="/dashboard">Dashboard</NavLink>);
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("aria-current", "page");
  });

  it("SideNav renders without crashing", () => {
    render(
      <SidebarProvider initialSidebarOpen={true} initialIsMobile={false}>
        <SideNav />
      </SidebarProvider>
    );
    expect(screen.getByText(/StellarLend/i)).toBeInTheDocument();
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
