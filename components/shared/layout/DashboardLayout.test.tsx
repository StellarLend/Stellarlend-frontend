import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardLayout from "./DashboardLayout";

vi.mock("./SideNav", () => ({
  SideNav: () => (
    <nav aria-label="Primary" data-testid="mock-sidenav">
      SideNav
    </nav>
  ),
}));

vi.mock("@/components/shared/layout/TopNav", () => ({
  default: () => <div data-testid="mock-topnav">TopNav</div>,
}));

describe("DashboardLayout — slot composition", () => {
  it("renders children into the main content region", () => {
    render(
      <DashboardLayout>
        <div data-testid="page-body">Markets page</div>
      </DashboardLayout>,
    );

    const main = screen.getByRole("main");
    expect(within(main).getByTestId("page-body")).toHaveTextContent(
      "Markets page",
    );
  });

  it("renders the header slot with TopNav", () => {
    render(
      <DashboardLayout>
        <span>content</span>
      </DashboardLayout>,
    );

    const header = screen.getByRole("banner");
    expect(within(header).getByTestId("mock-topnav")).toBeInTheDocument();
  });

  it("renders the sidebar navigation slot", () => {
    render(
      <DashboardLayout>
        <span>content</span>
      </DashboardLayout>,
    );

    expect(screen.getByTestId("mock-sidenav")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
  });

  it("renders an empty main region when no children are provided", () => {
    render(<DashboardLayout>{null}</DashboardLayout>);

    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    expect(main).toBeEmptyDOMElement();
  });

  it("keeps chrome slots present when children are omitted", () => {
    render(<DashboardLayout>{undefined}</DashboardLayout>);

    expect(screen.getByTestId("mock-sidenav")).toBeInTheDocument();
    expect(screen.getByTestId("mock-topnav")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});

describe("DashboardLayout — landmarks and skip link", () => {
  it("exposes a main landmark with the skip-target id", () => {
    render(
      <DashboardLayout>
        <p>body</p>
      </DashboardLayout>,
    );

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
  });

  it("renders a skip-to-content link that points at main", () => {
    render(
      <DashboardLayout>
        <p>body</p>
      </DashboardLayout>,
    );

    const skip = screen.getByRole("link", { name: /skip to main content/i });
    expect(skip).toHaveAttribute("href", "#main-content");
  });

  it("places the skip link before the chrome so keyboard users reach it first", () => {
    const { container } = render(
      <DashboardLayout>
        <p>body</p>
      </DashboardLayout>,
    );

    const skip = screen.getByRole("link", { name: /skip to main content/i });
    const sidenav = screen.getByTestId("mock-sidenav");
    // Document order: skip link precedes the sidebar.
    expect(
      skip.compareDocumentPosition(sidenav) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.firstElementChild?.contains(skip)).toBe(true);
  });

  it("composes header and main inside the primary column", () => {
    render(
      <DashboardLayout>
        <div data-testid="page-body">body</div>
      </DashboardLayout>,
    );

    const header = screen.getByRole("banner");
    const main = screen.getByRole("main");
    expect(header.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
