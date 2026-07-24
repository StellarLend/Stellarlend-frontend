import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DashboardLayout from "./DashboardLayout";

let shouldSideNavThrow = false;
let shouldTopNavThrow = false;

// Mock the SideNav and TopNav components so we can test composition and error states easily
vi.mock("./SideNav", () => ({
  SideNav: () => {
    if (shouldSideNavThrow) {
      throw new Error("SideNav render error");
    }
    return <div data-testid="mock-sidenav">SideNav</div>;
  },
}));

vi.mock("@/components/shared/layout/TopNav", () => ({
  default: () => {
    if (shouldTopNavThrow) {
      throw new Error("TopNav render error");
    }
    return <div data-testid="mock-topnav">TopNav</div>;
  },
}));

describe("DashboardLayout", () => {
  beforeEach(() => {
    shouldSideNavThrow = false;
    shouldTopNavThrow = false;
  });

  it("renders SideNav, TopNav, and children together", () => {
    render(
      <DashboardLayout>
        <div data-testid="test-child">Dashboard Content</div>
      </DashboardLayout>
    );

    expect(screen.getByTestId("mock-sidenav")).toBeInTheDocument();
    expect(screen.getByTestId("mock-topnav")).toBeInTheDocument();
    expect(screen.getByTestId("test-child")).toBeInTheDocument();
    expect(screen.getByText("Dashboard Content")).toBeInTheDocument();
  });

  it("does not crash and renders children if SideNav throws an error", () => {
    shouldSideNavThrow = true;

    // Mock console.error to suppress error logging during the throwing test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <DashboardLayout>
        <div data-testid="test-child-sidenav-error">Dashboard Content with SideNav error</div>
      </DashboardLayout>
    );

    expect(screen.getByTestId("sidenav-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("mock-topnav")).toBeInTheDocument();
    expect(screen.getByTestId("test-child-sidenav-error")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("does not crash and renders children if TopNav throws an error", () => {
    shouldTopNavThrow = true;

    // Mock console.error to suppress error logging during the throwing test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <DashboardLayout>
        <div data-testid="test-child-topnav-error">Dashboard Content with TopNav error</div>
      </DashboardLayout>
    );

    expect(screen.getByTestId("mock-sidenav")).toBeInTheDocument();
    expect(screen.getByTestId("topnav-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("test-child-topnav-error")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});

