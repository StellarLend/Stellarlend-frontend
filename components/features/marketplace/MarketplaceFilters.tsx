/**
 * MarketplaceFilters
 *
 * Bounded filter controls for the marketplace. Inputs are constrained (max
 * length, min/max ranges) and validated inline so an out-of-bounds filter is
 * reported to the user instead of silently clamped or sent to the server.
 * Filter semantics are enforced by `lib/marketplace/invariants`.
 */

import React, { useMemo } from "react";

import { MARKETPLACE_BOUNDS } from "@/types/marketplace";
import type { MarketplaceFilters } from "@/types/marketplace";
import Button from "@/components/shared/ui/Button";
import { Input } from "@/components/shared/ui/Input";

export interface MarketplaceFiltersProps {
  value: MarketplaceFilters;
  errors?: Record<string, string>;
  disabled?: boolean;
  onChange: (patch: Partial<MarketplaceFilters>) => void;
  onApply: () => void;
  onReset: () => void;
}

const MAX_DIGITS = String(MARKETPLACE_BOUNDS.MAX_FILTER_PRICE).length;

function isOutOfRange(value?: string): boolean {
  if (value === undefined || value === "") return false;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return true;
  return numeric <= 0 || numeric > Number(MARKETPLACE_BOUNDS.MAX_FILTER_PRICE);
}

function validateRange(min?: string, max?: string): string | undefined {
  if (
    min !== undefined &&
    max !== undefined &&
    min !== "" &&
    max !== "" &&
    Number(min) > Number(max)
  ) {
    return "Minimum price cannot be greater than maximum price.";
  }
  return undefined;
}

export function MarketplaceFilters({
  value,
  errors = {},
  disabled = false,
  onChange,
  onApply,
  onReset,
}: MarketplaceFiltersProps): React.JSX.Element {
  const minOutOfRange = isOutOfRange(value.minPrice);
  const maxOutOfRange = isOutOfRange(value.maxPrice);
  const rangeError = validateRange(value.minPrice, value.maxPrice);

  const minError = errors.minPrice ?? (minOutOfRange ? "Enter a positive price." : undefined);
  const maxError =
    errors.maxPrice ?? (maxOutOfRange ? "Price exceeds the allowed maximum." : undefined);
  const rangeErrorField = minError ? undefined : (rangeError ?? maxError);

  // Any server-side validation error (e.g. an unknown asset) that is not tied
  // to a specific inline price field is surfaced in a general alert below.
  const generalError = Object.entries(errors).find(
    ([key, value]) => key !== "minPrice" && key !== "maxPrice" && Boolean(value),
  )?.[1];
  const hasServerError = Object.values(errors).some(Boolean);

  const applyDisabled =
    disabled ||
    Boolean(minError) ||
    Boolean(maxError) ||
    Boolean(rangeError) ||
    hasServerError;

  const priceRowError = rangeErrorField ?? undefined;

  const options = useMemo(
    () => ({
      asset: MARKETPLACE_BOUNDS.ALLOWED_ASSETS,
      category: MARKETPLACE_BOUNDS.ALLOWED_CATEGORIES,
    }),
    [],
  );

  return (
    <form
      className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4"
      aria-label="Marketplace listing filters"
      onSubmit={(event) => {
        event.preventDefault();
        if (!applyDisabled) onApply();
      }}
    >
      <fieldset disabled={disabled} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <legend className="text-sm font-semibold text-gray-800">Price range</legend>

        <Input
          id="marketplace-min-price"
          name="min-price"
          label="Min price"
          type="text"
          inputMode="decimal"
          maxLength={MAX_DIGITS}
          placeholder="0.00"
          value={value.minPrice ?? ""}
          error={minError ?? priceRowError}
          aria-invalid={minOutOfRange || Boolean(minError) ? "true" : "false"}
          onChange={(event) => onChange({ minPrice: event.target.value })}
        />

        <Input
          id="marketplace-max-price"
          name="max-price"
          label="Max price"
          type="text"
          inputMode="decimal"
          maxLength={MAX_DIGITS}
          placeholder="0.00"
          value={value.maxPrice ?? ""}
          error={maxError}
          aria-invalid={maxOutOfRange || Boolean(maxError) ? "true" : "false"}
          onChange={(event) => onChange({ maxPrice: event.target.value })}
        />

        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
          Asset
          <select
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900"
            value={value.asset ?? ""}
            onChange={(event) => onChange({ asset: event.target.value || undefined })}
          >
            <option value="">All assets</option>
            {options.asset.map((asset) => (
              <option key={asset} value={asset}>
                {asset}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
          Category
          <select
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900"
            value={value.category ?? ""}
            onChange={(event) => onChange({ category: event.target.value || undefined })}
          >
            <option value="">All categories</option>
            {options.category.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
          Availability
          <select
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900"
            value={value.availability ?? "available"}
            onChange={(event) =>
              onChange({ availability: event.target.value as "available" | "all" })
            }
          >
            <option value="available">Available only</option>
            <option value="all">All</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
          Sort by
          <select
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900"
            value={value.sort ?? "newest"}
            onChange={(event) =>
              onChange({ sort: event.target.value as MarketplaceFilters["sort"] })
            }
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
          Page size
          <select
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900"
            value={value.pageSize ?? MARKETPLACE_BOUNDS.DEFAULT_PAGE_SIZE}
            onChange={(event) => onChange({ pageSize: Number(event.target.value) })}
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      {(rangeError || generalError) && (
        <p className="text-xs text-red-500" role="alert">
          {rangeError ?? generalError}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={applyDisabled}>
          Apply filters
        </Button>
        <Button type="button" variant="secondary" onClick={onReset} disabled={disabled}>
          Reset
        </Button>
      </div>
    </form>
  );
}