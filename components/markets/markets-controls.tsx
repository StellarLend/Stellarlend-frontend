"use client";
/**
 * MarketsControls
 *
 * The search / sort / mine-only filter bar above the markets table.
 * Fully presentational; all state lives in markets-app.tsx.
 */

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { parseMarketSort, type MarketSortKey } from "@/lib/markets";

export type MarketsControlsProps = {
  searchInput: string;
  sortBy: MarketSortKey;
  mineOnly: boolean;
  onSearchChange: (value: string) => void;
  onSortChange: (value: MarketSortKey) => void;
  onMineChange: (value: boolean) => void;
};

export function MarketsControls({
  searchInput,
  sortBy,
  mineOnly,
  onSearchChange,
  onSortChange,
  onMineChange,
}: MarketsControlsProps) {
  const t = useTranslations("market");
  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 sm:max-w-xs">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("controls.searchPlaceholder")}
          aria-label={t("controls.searchLabel")}
          className="w-full"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="mut whitespace-nowrap">{t("controls.sortLabel")}</span>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(parseMarketSort(e.target.value))}
            aria-label={t("controls.sortLabel")}
            className="rounded-lg border border-[var(--line)] bg-transparent px-3 py-1.5 text-sm"
          >
            <option value="default">{t("controls.sortDefault")}</option>
            <option value="supplyApy">{t("controls.sortSupplyApy")}</option>
            <option value="borrowApy">{t("controls.sortBorrowApy")}</option>
            <option value="utilization">{t("controls.sortUtilization")}</option>
          </select>
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => onMineChange(e.target.checked)}
            aria-label={t("controls.myPositionsOnly")}
          />
          <span>{t("controls.myPositionsOnly")}</span>
        </label>
      </div>
    </Card>
  );
}
