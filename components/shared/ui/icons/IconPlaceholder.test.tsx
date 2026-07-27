import { render, screen } from "@testing-library/react";
import { IconPlaceholder } from "./IconPlaceholder";
import { describe, it, expect } from "vitest";

describe("IconPlaceholder", () => {
  it("renders with default props", () => {
    render(<IconPlaceholder />);
    const placeholder = document.querySelector(".animate-pulse");
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveClass("bg-gray-200", "rounded");
  });

  it("applies custom className", () => {
    render(<IconPlaceholder className="custom-class" />);
    const placeholder = document.querySelector(".animate-pulse");
    expect(placeholder).toHaveClass("custom-class");
  });

  it("applies custom width and height", () => {
    render(<IconPlaceholder width="32" height="32" />);
    const placeholder = document.querySelector(".animate-pulse");
    expect(placeholder).toHaveStyle({ width: "32", height: "32" });
  });

  it("has aria-hidden attribute", () => {
    render(<IconPlaceholder />);
    const placeholder = document.querySelector(".animate-pulse");
    expect(placeholder).toHaveAttribute("aria-hidden", "true");
  });
});
