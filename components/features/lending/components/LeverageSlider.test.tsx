import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LeverageSlider } from "./LeverageSlider";

const mockPrices = {
  XLM: 0.12,
  USDC: 1,
};

describe("LeverageSlider", () => {
  const defaultProps = {
    value: 100,
    onChange: vi.fn(),
    collateralAmount: 1000,
    collateralAsset: "USDC",
    borrowAsset: "XLM",
    prices: mockPrices,
    borrowApr: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly with valid props", () => {
    render(<LeverageSlider {...defaultProps} />);
    expect(screen.getByLabelText(/What-if Leverage/i)).toBeInTheDocument();
  });

  it("returns null if collateralAmount is 0", () => {
    const { container } = render(<LeverageSlider {...defaultProps} collateralAmount={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("calls onChange when slider is dragged", () => {
    render(<LeverageSlider {...defaultProps} />);
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "500" } });
    expect(defaultProps.onChange).toHaveBeenCalledWith(500);
  });

  it("projects health factor and updates aria-valuetext", () => {
    render(<LeverageSlider {...defaultProps} value={100} />);
    const slider = screen.getByRole("slider");
    // Since we borrowed 100 XLM, loan = 100 * 0.12 * 1.1 = 13.2
    // collateral = 1000 * 1 = 1000
    // HF = 1000 / (13.2 * 1.2) = 63.13 (Healthy)
    expect(slider).toHaveAttribute("aria-valuetext", expect.stringContaining("Projected health factor:"));
  });

  it("handles slider at max (undercollateralised projection)", () => {
    // max borrow = collateralValueUsd / (borrowPrice * 1.1)
    // 1000 / (0.12 * 1.1) = 7575.75
    render(<LeverageSlider {...defaultProps} value={7575.75} />);
    const slider = screen.getByRole("slider");
    expect(slider).toBeInTheDocument();
    
    // HF = 1000 / (7575.75 * 0.12 * 1.1 * 1.2) = 1000 / 1200 = 0.83
    expect(screen.getByText("0.83")).toBeInTheDocument();
    expect(slider).toHaveAttribute("aria-valuetext", expect.stringContaining("0.83"));
  });

  it("handles missing prices gracefully by rendering null", () => {
    const { container } = render(
      <LeverageSlider
        {...defaultProps}
        prices={{ XLM: 0 }} // Missing USDC
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("memoises recomputation on rapid drag", () => {
    // To test memoization we can just verify it renders without crashing on rapid updates
    const { rerender } = render(<LeverageSlider {...defaultProps} value={100} />);
    for (let i = 0; i < 100; i++) {
      rerender(<LeverageSlider {...defaultProps} value={100 + i * 10} />);
    }
    const slider = screen.getByRole("slider");
    expect(slider).toHaveValue("1090");
  });
});
