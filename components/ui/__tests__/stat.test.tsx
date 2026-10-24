import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Stat } from "../stat";

describe("Stat component", () => {
  it("renders label and value using label and value props", () => {
    render(<Stat label="Collateral" value="$1,234.56" />);
    expect(screen.getByText("Collateral")).toBeInTheDocument();
    expect(screen.getByText("$1,234.56")).toBeInTheDocument();
  });

  it("supports backwards-compatible k and v props", () => {
    render(<Stat k="Borrowed" v="$500.00" />);
    expect(screen.getByText("Borrowed")).toBeInTheDocument();
    expect(screen.getByText("$500.00")).toBeInTheDocument();
  });

  it("applies positive tone class and screen reader announcement", () => {
    render(<Stat label="Health" value="1.54" tone="positive" />);
    const srLabel = screen.getByText("(positive)");
    expect(srLabel).toHaveClass("sr-only");
    expect(screen.getByText(/1.54/)).toHaveClass("text-emerald-400");
  });

  it("applies danger tone class and screen reader announcement", () => {
    render(<Stat label="Health" value="0.95" tone="danger" />);
    const srLabel = screen.getByText("(danger)");
    expect(srLabel).toHaveClass("sr-only");
    expect(screen.getByText(/0.95/)).toHaveClass("text-red-400");
  });

  it("applies warning tone class and screen reader announcement", () => {
    render(<Stat label="Risk" value="Medium" tone="warning" />);
    const srLabel = screen.getByText("(warning)");
    expect(srLabel).toHaveClass("sr-only");
    expect(screen.getByText(/Medium/)).toHaveClass("text-amber-400");
  });

  it("does not render screen reader tone label for neutral tone", () => {
    render(<Stat label="Total" value="10" tone="neutral" />);
    expect(screen.queryByText(/positive|warning|danger/)).not.toBeInTheDocument();
  });
});
