import React from 'react';
import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  // ─── Happy-path (existing coverage) ─────────────────────────────────────────

  it("renders the title as a level 1 heading by default", () => {
    render(<PageHeader title="Dashboard" />);

    const heading = screen.getByRole("heading", { level: 1, name: "Dashboard" });
    expect(heading).toBeInTheDocument();
  });

  it("renders the optional description and links it to the heading via aria-describedby", () => {
    render(
      <PageHeader
        title="Lending & Borrowing"
        description="Earn interest by lending your assets or borrow against your collateral."
      />
    );

    const heading = screen.getByRole("heading", { name: "Lending & Borrowing" });
    const description = screen.getByText(/Earn interest by lending/);
    expect(description).toBeInTheDocument();

    const descriptionId = description.getAttribute("id");
    expect(descriptionId).toBeTruthy();
    expect(heading.parentElement?.parentElement).toHaveAttribute(
      "aria-describedby",
      descriptionId!
    );
  });

  it("omits the description paragraph when none is provided", () => {
    const { container } = render(<PageHeader title="Account" />);
    expect(container.querySelector("p")).toBeNull();
  });

  it("renders action slot content alongside the title", () => {
    render(
      <PageHeader
        title="Transactions"
        actions={<button type="button">Export CSV</button>}
      />
    );

    expect(screen.getByRole("button", { name: "Export CSV" })).toBeInTheDocument();
  });

  it("applies dark tone classes by default and switches to light tone when requested", () => {
    const { rerender } = render(<PageHeader title="Dashboard" description="desc" />);
    let heading = screen.getByRole("heading", { name: "Dashboard" });
    let description = screen.getByText("desc");
    expect(heading.className).toContain("text-white");
    expect(description.className).toContain("text-white/80");

    rerender(<PageHeader title="Account" description="profile" tone="light" />);
    heading = screen.getByRole("heading", { name: "Account" });
    description = screen.getByText("profile");
    expect(heading.className).toContain("text-slate-900");
    expect(description.className).toContain("text-slate-500");
  });

  it("renders the heading at level 2 when `as='h2'` is provided", () => {
    render(<PageHeader title="Sub Section" as="h2" />);
    expect(screen.getByRole("heading", { level: 2, name: "Sub Section" })).toBeInTheDocument();
  });

  it("uses a stable id derived from the title and connects it to the banner", () => {
    render(<PageHeader title="My Page" description="hello" />);
    const heading = screen.getByRole("heading", { name: "My Page" });
    expect(heading).toHaveAttribute("id", "page-header-my-page");

    const banner = screen.getByRole("banner");
    expect(banner).toHaveAttribute("aria-labelledby", "page-header-my-page");
    expect(banner).toHaveAttribute("aria-describedby", "page-header-my-page-description");
  });

  it("respects an explicit id override", () => {
    render(<PageHeader title="Custom" id="custom-id" description="d" />);
    expect(screen.getByRole("heading", { name: "Custom" })).toHaveAttribute("id", "custom-id");
    expect(screen.getByText("d")).toHaveAttribute("id", "custom-id-description");
  });

  it("merges the consumer-provided className onto the root", () => {
    render(<PageHeader title="Page" className="custom-class" />);
    expect(screen.getByRole("banner").className).toContain("custom-class");
  });

  // ─── Failure-path & boundary coverage ────────────────────────────────────────

  it("omits aria-describedby on banner when description is absent", () => {
    render(<PageHeader title="No Desc" />);
    const banner = screen.getByRole("banner");
    // aria-describedby must not be present (or must be undefined) when no description
    expect(banner).not.toHaveAttribute("aria-describedby");
  });

  it("derives id correctly from a title with multiple consecutive spaces", () => {
    render(<PageHeader title="  Spaced   Title  " />);
    const heading = screen.getByRole("heading", { name: /spaced/i });
    // multiple whitespace sequences replaced by single dash each
    expect(heading.getAttribute("id")).toMatch(/^page-header-/);
    expect(heading.getAttribute("id")).not.toContain(" ");
  });

  it("derives id correctly from a title with uppercase characters", () => {
    render(<PageHeader title="My DASHBOARD" />);
    const heading = screen.getByRole("heading", { name: "My DASHBOARD" });
    expect(heading).toHaveAttribute("id", "page-header-my-dashboard");
  });

  it("renders with an empty className prop without breaking layout classes", () => {
    render(<PageHeader title="Clean" className="" />);
    const banner = screen.getByRole("banner");
    expect(banner.className).toContain("mb-8");
  });

  it("renders actions wrapper only when actions prop is provided", () => {
    const { rerender, container } = render(<PageHeader title="No Actions" />);
    // No actions → no extra wrapper div
    expect(container.querySelectorAll("div").length).toBeGreaterThanOrEqual(1);
    const withoutActions = container.querySelectorAll("div").length;

    rerender(<PageHeader title="With Actions" actions={<button>Act</button>} />);
    const withActions = container.querySelectorAll("div").length;
    expect(withActions).toBeGreaterThan(withoutActions);
  });

  it("renders multiple actions in the slot without error", () => {
    render(
      <PageHeader
        title="Multi"
        actions={
          <>
            <button type="button">Action A</button>
            <button type="button">Action B</button>
          </>
        }
      />
    );
    expect(screen.getByRole("button", { name: "Action A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action B" })).toBeInTheDocument();
  });

  it("explicit id override propagates correctly to description id", () => {
    render(<PageHeader title="Override" id="my-override" description="some desc" />);
    const descEl = screen.getByText("some desc");
    expect(descEl).toHaveAttribute("id", "my-override-description");
    expect(screen.getByRole("banner")).toHaveAttribute("aria-describedby", "my-override-description");
  });

  it("re-renders with different props without stale ids or content", () => {
    const { rerender } = render(<PageHeader title="First" description="First desc" />);
    rerender(<PageHeader title="Second" description="Second desc" />);
    expect(screen.getByRole("heading", { name: "Second" })).toHaveAttribute(
      "id",
      "page-header-second"
    );
    expect(screen.getByText("Second desc")).toBeInTheDocument();
    expect(screen.queryByText("First desc")).toBeNull();
  });

  it("switching from description to no description removes the paragraph", () => {
    const { rerender, container } = render(<PageHeader title="Toggle" description="Visible" />);
    expect(container.querySelector("p")).not.toBeNull();
    rerender(<PageHeader title="Toggle" />);
    expect(container.querySelector("p")).toBeNull();
  });

  it("root element has role=banner for landmark accessibility", () => {
    render(<PageHeader title="Landmark" />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("heading is always connected to banner via aria-labelledby", () => {
    render(<PageHeader title="Connected" />);
    const banner = screen.getByRole("banner");
    const heading = screen.getByRole("heading", { name: "Connected" });
    expect(banner).toHaveAttribute("aria-labelledby", heading.getAttribute("id"));
  });

  it("applies both default and additional className without duplicating base classes", () => {
    render(<PageHeader title="Class Test" className="extra-a extra-b" />);
    const cls = screen.getByRole("banner").className;
    expect(cls).toContain("extra-a");
    expect(cls).toContain("extra-b");
    expect(cls).toContain("mb-8");
  });

  it("renders h1 by default when as prop is omitted", () => {
    render(<PageHeader title="Default Tag" />);
    const heading = screen.getByRole("heading", { name: "Default Tag" });
    expect(heading.tagName).toBe("H1");
  });
});
