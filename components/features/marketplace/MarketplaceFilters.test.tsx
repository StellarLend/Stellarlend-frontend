import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MarketplaceFilters } from "./MarketplaceFilters";
import type { MarketplaceFilters as MarketplaceFiltersValue } from "@/types/marketplace";

const baseValue: MarketplaceFiltersValue = {
  availability: "available",
  sort: "newest",
};

function renderFilters(overrides: {
  value?: MarketplaceFiltersValue;
  errors?: Record<string, string>;
  disabled?: boolean;
  onChange?: (patch: Partial<MarketplaceFiltersValue>) => void;
  onApply?: () => void;
  onReset?: () => void;
} = {}) {
  const onChange = overrides.onChange ?? vi.fn();
  const onApply = overrides.onApply ?? vi.fn();
  const onReset = overrides.onReset ?? vi.fn();
  render(
    <MarketplaceFilters
      value={overrides.value ?? baseValue}
      errors={overrides.errors}
      disabled={overrides.disabled}
      onChange={onChange}
      onApply={onApply}
      onReset={onReset}
    />,
  );
  return { onChange, onApply, onReset };
}

describe("MarketplaceFilters", () => {
  it("renders price, asset, category, availability, sort and page-size controls", () => {
    renderFilters();

    expect(screen.getByLabelText(/min price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/max price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/asset/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/availability/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sort by/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/page size/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply filters/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  it("reports a reversed price range and disables applying", () => {
    renderFilters({ value: { ...baseValue, minPrice: "9", maxPrice: "1" } });

    expect(screen.getByRole("alert")).toHaveTextContent(/minimum price cannot be greater/i);
    expect(screen.getByRole("button", { name: /apply filters/i })).toBeDisabled();
  });

  it("rejects a zero price as out of range", () => {
    renderFilters({ value: { ...baseValue, minPrice: "0" } });

    expect(screen.getByText(/enter a positive price/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply filters/i })).toBeDisabled();
  });

  it("applies filters when valid", () => {
    const { onApply } = renderFilters({ value: { ...baseValue, asset: "USDC" } });

    fireEvent.click(screen.getByRole("button", { name: /apply filters/i }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("surfaces server-provided filter errors", () => {
    renderFilters({ errors: { asset: "Unsupported asset." } });
    expect(screen.getByText(/unsupported asset/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply filters/i })).toBeDisabled();
  });

  it("resets when the reset button is pressed", () => {
    const { onReset } = renderFilters();
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("disables all controls when disabled", () => {
    renderFilters({
      value: { ...baseValue, asset: "XLM" },
      disabled: true,
      errors: {},
    });

    expect(screen.getByRole("button", { name: /apply filters/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /reset/i })).toBeDisabled();
    expect(screen.getByLabelText(/asset/i)).toBeDisabled();
    expect(screen.getByLabelText(/min price/i)).toBeDisabled();
  });
});