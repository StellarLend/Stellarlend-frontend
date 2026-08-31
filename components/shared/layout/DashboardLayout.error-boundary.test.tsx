import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import DashboardLayout from "./DashboardLayout";

let shouldSideNavThrow = false;
let shouldTopNavThrow = false;

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

describe("DashboardLayout error boundaries", () => {
  beforeEach(() => {
    shouldSideNavThrow = false;
    shouldTopNavThrow = false;
  });

  it("keeps the main content visible if SideNav throws during render", () => {
    shouldSideNavThrow = true;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <DashboardLayout>
        <div data-testid="dashboard-child">Dashboard content</div>
      </DashboardLayout>,
    );

    expect(screen.getByTestId("sidenav-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("mock-topnav")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-child")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("keeps the main content visible if TopNav throws during render", () => {
    shouldTopNavThrow = true;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <DashboardLayout>
        <div data-testid="dashboard-child">Dashboard content</div>
      </DashboardLayout>,
    );

    expect(screen.getByTestId("mock-sidenav")).toBeInTheDocument();
    expect(screen.getByTestId("topnav-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-child")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});