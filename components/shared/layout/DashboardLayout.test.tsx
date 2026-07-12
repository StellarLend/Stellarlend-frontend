import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";
import DashboardLayout from "./DashboardLayout";

vi.mock("./SideNav", () => ({
  SideNav: () => <nav data-testid="side-nav">SideNav</nav>,
}));

vi.mock("./TopNav", () => ({
  default: () => <header data-testid="top-nav">TopNav</header>,
}));

describe("DashboardLayout", () => {
  it("composes SideNav, TopNav, and main content regions", () => {
    render(
      <DashboardLayout>
        <p>Dashboard body</p>
      </DashboardLayout>,
    );

    expect(screen.getByTestId("side-nav")).toBeTruthy();
    expect(screen.getByTestId("top-nav")).toBeTruthy();
    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.getByText("Dashboard body")).toBeTruthy();
  });

  it("renders children inside the main landmark", () => {
    render(
      <DashboardLayout>
        <section aria-label="positions">Positions panel</section>
      </DashboardLayout>,
    );

    const main = screen.getByRole("main");
    expect(main.querySelector('[aria-label="positions"]')).toBeTruthy();
  });
});
