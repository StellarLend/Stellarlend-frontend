import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "../skeleton";

describe("Skeleton", () => {
  it("renders an accessible busy container with a localized label", () => {
    render(
      <Skeleton label="Loading...">
        <Skeleton className="h-4 w-24" />
      </Skeleton>
    );

    const container = screen.getByRole("status");
    expect(container).toHaveAttribute("aria-busy", "true");
    expect(container).toHaveAttribute("aria-label", "Loading...");
  });

  it("hides decorative skeleton blocks from assistive technology", () => {
    const { container } = render(<Skeleton className="h-8 w-32" />);

    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstChild).toHaveClass("animate-pulse");
  });
});
