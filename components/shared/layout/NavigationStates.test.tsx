import React from "react";
import { render, screen, afterEach, waitFor } from "@/test/test-utils";
import Sidebar from "./Sidebar";
import NavLink from "./NavLink";
import { SideNav } from "./SideNav";
import { SidebarProvider } from "@/context/SidebarContext";
import "@testing-library/jest-dom";
import { vi } from "vitest";

const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

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

afterEach(() => {
  vi.clearAllMocks();
});

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
    mockUsePathname.mockReturnValue("/dashboard");
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
    mockUsePathname.mockReturnValue("/other");
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
