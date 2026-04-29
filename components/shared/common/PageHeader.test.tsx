import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
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
});
