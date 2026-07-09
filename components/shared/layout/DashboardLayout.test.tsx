import { render, screen, within } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";
import DashboardLayout from "./DashboardLayout";

vi.mock("@/components/shared/layout/TopNav", () => ({
  default: () => <header data-testid="top-nav">Top navigation</header>,
}));

vi.mock("./SideNav", () => ({
  SideNav: () => (
    <nav aria-label="Dashboard navigation" data-testid="side-nav">
      Sidebar navigation
    </nav>
  ),
}));

describe("DashboardLayout", () => {
  it("renders sidebar, top navigation, and page content slots", () => {
    render(
      <DashboardLayout>
        <section>
          <h1>Portfolio overview</h1>
          <p>Account health and balances</p>
        </section>
      </DashboardLayout>,
    );

    expect(screen.getByTestId("side-nav")).toHaveTextContent(
      "Sidebar navigation",
    );
    expect(screen.getByTestId("top-nav")).toHaveTextContent("Top navigation");
    expect(screen.getByRole("heading", { name: /portfolio overview/i }))
      .toBeInTheDocument();
    expect(screen.getByText(/account health and balances/i)).toBeInTheDocument();
  });

  it("places children inside the main landmark", () => {
    render(
      <DashboardLayout>
        <button type="button">Review position</button>
      </DashboardLayout>,
    );

    const main = screen.getByRole("main");

    expect(within(main).getByRole("button", { name: /review position/i }))
      .toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /dashboard navigation/i }))
      .toBeInTheDocument();
  });
});
