import { render, screen, fireEvent } from "@testing-library/react";
import Sidebar from "./Sidebar";
import NavLink from "./NavLink";
import { SideNav } from "./SideNav";
import { NavigationMenu } from "./NavigationMenu";
import "@testing-library/jest-dom";
import { vi } from "vitest";

describe("Navigation UI/UX", () => {
  it("Sidebar renders all nav items with correct roles", () => {
    render(<Sidebar />);
    expect(screen.getByRole("navigation", { name: /sidebar navigation/i })).toBeInTheDocument();
    expect(screen.getByText(/Profile Settings/i)).toBeInTheDocument();
    expect(screen.getByText(/Password/i)).toBeInTheDocument();
    expect(screen.getByText(/Notification/i)).toBeInTheDocument();
    expect(screen.getByText(/Verification/i)).toBeInTheDocument();
  });

  it("NavLink renders with active and focus styles", () => {
    render(<NavLink href="/dashboard" className="test-nav">Dashboard</NavLink>);
    const link = screen.getByText("Dashboard").closest("a");
    expect(link).toHaveClass("px-4");
    expect(link).toHaveClass("py-3.5");
    expect(link).toHaveClass("rounded-lg");
  });

  it("SideNav renders without crashing", () => {
    render(<SideNav />);
    expect(screen.getByText(/StellarLend/i)).toBeInTheDocument();
  });

  it("NavigationMenu uses correct semantic structure and aria-current for active states", () => {
    const handleLinkClick = vi.fn();
    // Pass specific visibleLinks to make the test predictable
    render(<NavigationMenu onLinkClick={handleLinkClick} visibleLinks={["Dashboard", "Settings"]} />);
    
    // 1. Ensure links are semantically nested inside list items
    const listItems = screen.getAllByRole("listitem");
    expect(listItems.length).toBe(2);
    
    const dashboardLink = screen.getByText("Dashboard").closest("a");
    const settingsLink = screen.getByText("Settings").closest("a");
    
    expect(dashboardLink).toBeInTheDocument();
    expect(settingsLink).toBeInTheDocument();
    
    // 2. Check accessibility active state on initial load
    expect(dashboardLink).toHaveAttribute("aria-current", "page");
    expect(settingsLink).not.toHaveAttribute("aria-current");
    
    // 3. Simulate keyboard/click navigation
    if (settingsLink) {
      fireEvent.click(settingsLink);
    }
    
    // Verify callbacks and state updates
    expect(handleLinkClick).toHaveBeenCalled();
    expect(settingsLink).toHaveAttribute("aria-current", "page");
    expect(dashboardLink).not.toHaveAttribute("aria-current");
    
    // 4. Verify new hit target padding is applied
    expect(settingsLink).toHaveClass("py-3.5");
  });
});
