"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { AssetInfo } from "@/lib/assets";
import { cn } from "@/lib/utils/cn";
import { Tooltip } from "@/components/atoms/Tooltip";
import { usePrices } from "@/hooks/usePrices";
import { ChevronDown, Search } from "lucide-react";

interface AssetSelectorProps {
  assets: AssetInfo[];
  value: string;
  onChange: (asset: string) => void;
  showBalance?: boolean;
  interestRates?: Record<string, number>;
  label?: string;
  id?: string;
  onClose?: () => void;
}

const TOKEN_COLORS: Record<string, string> = {
  XLM: "bg-blue-500",
  USDC: "bg-green-500",
  BTC: "bg-orange-500",
  ETH: "bg-purple-500",
};

/**
 * AssetSelector component.
 * Upgrade description: Provides an accessible dropdown to pick an asset.
 * Supports keyword navigation, type-to-search filtering, and screen-reader announcements.
 */
export default function AssetSelector({
  assets,
  value,
  onChange,
  showBalance = true,
  interestRates,
  label,
  id,
  onClose,
}: AssetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [announcement, setAnnouncement] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const selectedAsset = assets.find((a) => a.symbol === value) || assets[0];
  const assetSymbols = useMemo(
    () => assets.map((asset) => asset.symbol),
    [assets],
  );
  const { getPriceLabel, refresh } = usePrices(assetSymbols);

  useEffect(() => {
    if (isOpen) {
      void refresh();
    }
  }, [isOpen, refresh]);

  // Filter assets based on search query
  const filteredAssets = assets.filter(
    (asset) =>
      asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // When dropdown opens, focus search input and reset index
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      setActiveIndex(-1);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Accessibility screen reader announcement for filter results
  useEffect(() => {
    if (searchQuery) {
      setAnnouncement(
        `${filteredAssets.length} assets found for "${searchQuery}"`
      );
    } else {
      setAnnouncement("");
    }
  }, [searchQuery, filteredAssets.length]);

  const handleSelect = (symbol: string) => {
    onChange(symbol);
    setIsOpen(false);
    setAnnouncement(`Selected asset ${symbol}`);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) =>
          prev + 1 < filteredAssets.length ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) =>
          prev - 1 >= 0 ? prev - 1 : filteredAssets.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredAssets.length) {
          handleSelect(filteredAssets[activeIndex].symbol);
        } else if (filteredAssets.length > 0) {
          handleSelect(filteredAssets[0].symbol);
        }
        break;
      case "Tab":
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  // Scroll active option into view if needed
  useEffect(() => {
    if (activeIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex]);

  return (
    <div
      className="relative w-full text-left"
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-3">
          {label}
        </label>
      )}

      {/* Live Region for Screen Readers */}
      <div className="sr-only" aria-live="polite" role="status">
        {announcement}
      </div>

      {/* Dropdown Trigger */}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={label || "Asset selector"}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-6 h-6 rounded-full",
              TOKEN_COLORS[selectedAsset?.symbol] || "bg-gray-400"
            )}
          />
          <div className="flex flex-col text-left">
            <span className="font-bold text-gray-900">
              {selectedAsset?.symbol}
            </span>
            <span className="text-xs text-gray-500">{selectedAsset?.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {selectedAsset && interestRates?.[selectedAsset.symbol] && (
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
              {interestRates[selectedAsset.symbol]}% APR
            </span>
          )}
          <ChevronDown
            className={cn(
              "w-5 h-5 text-gray-400 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Dropdown Overlay */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white border-2 border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {/* Search Box */}
          <div className="p-3 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveIndex(-1);
              }}
              className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
              aria-label="Search assets"
            />
          </div>

          {/* Options Listbox */}
          <div
            ref={listboxRef}
            role="listbox"
            aria-label={label || "Asset selector"}
            className="max-h-60 overflow-y-auto p-2 space-y-1"
          >
            {filteredAssets.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500 font-medium">
                No assets found
              </div>
            ) : (
              filteredAssets.map((asset, index) => {
                const selected = value === asset.symbol;
                const active = index === activeIndex;

                return (
                  <Tooltip
                    key={asset.symbol}
                    content={getPriceLabel(asset.symbol)}
                    position="left"
                    delay={200}
                    wrapperClassName="block w-full"
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      id={`asset-option-${asset.symbol}`}
                      onClick={() => handleSelect(asset.symbol)}
                      className={cn(
                        "w-full p-3 rounded-lg text-left flex items-center justify-between transition-colors focus:outline-none text-sm cursor-pointer",
                        selected && "bg-blue-50 text-blue-900 font-semibold",
                        active && !selected && "bg-gray-100",
                        !active && !selected && "hover:bg-gray-50 text-gray-700"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-5 h-5 rounded-full",
                            TOKEN_COLORS[asset.symbol] || "bg-gray-400"
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="font-bold">{asset.symbol}</span>
                          <span className="text-xs opacity-75">
                            {asset.name}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        {interestRates?.[asset.symbol] && (
                          <span className="text-xs font-semibold text-blue-600 block mb-0.5">
                            {interestRates[asset.symbol]}% APR
                          </span>
                        )}
                        {showBalance && (
                          <span className="text-xs opacity-60 block">
                            Bal: {asset.balance.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </button>
                  </Tooltip>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
