import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MatchPoolRatioButton, SharePresets } from "./liquidity-controls";

describe("liquidity controls", () => {
  it("matches the pool ratio using rounded-up token units", () => {
    const onMatch = vi.fn();
    render(<MatchPoolRatioButton amountA="1" decimalsA={0} decimalsB={0} reserveA={3n} reserveB={10n} onMatch={onMatch} />);
    fireEvent.click(screen.getByRole("button", { name: "Match pool ratio" }));
    expect(onMatch).toHaveBeenCalledWith("4");
  });

  it("Max selects all of the user's LP shares", () => {
    const onSelect = vi.fn();
    render(<SharePresets balance={987_654n} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Max" }));
    expect(onSelect).toHaveBeenCalledWith("987654");
  });
});
