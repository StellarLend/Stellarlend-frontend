import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import AssetSelector from "./AssetSelector";
import { ASSETS } from "@/lib/assets";

function AssetSelectorPlayStory() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState("XLM");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const filteredAssets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return ASSETS;

    return ASSETS.filter((asset) =>
      asset.symbol.toLowerCase().includes(query) ||
      asset.name.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  useEffect(() => {
    if (open) {
      searchInputRef.current?.focus();
    }
  }, [open]);

  const openSelector = () => setOpen(true);
  const closeSelector = () => setOpen(false);

  const handleTriggerKeyDown = async (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (
      event.key === "Enter" ||
      event.key === " " ||
      event.key === "ArrowDown"
    ) {
      event.preventDefault();
      openSelector();
    }
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSelector();
      triggerRef.current?.focus();
    }
  };

  const handleSelect = (asset: string) => {
    setSelectedAsset(asset);
    closeSelector();
    triggerRef.current?.focus();
  };

  return (
    <div className="space-y-4" style={{ width: 320 }}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="story-asset-selector"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        className="px-4 py-2 border rounded-md bg-white"
      >
        Selected asset: {selectedAsset}
      </button>

      {open && (
        <div className="space-y-3">
          <label htmlFor="asset-search" className="sr-only">
            Search assets
          </label>
          <input
            id="asset-search"
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Type to search..."
            className="w-full px-3 py-2 border rounded-md"
          />

          {filteredAssets.length === 0 ? (
            <div role="status" className="text-sm text-gray-500">
              No assets match your search.
            </div>
          ) : (
            <AssetSelector
              id="story-asset-selector"
              assets={filteredAssets}
              value={selectedAsset}
              onChange={handleSelect}
              onClose={() => {
                closeSelector();
                triggerRef.current?.focus();
              }}
              label="Choose an asset"
            />
          )}
        </div>
      )}
    </div>
  );
}

const meta: Meta<typeof AssetSelector> = {
  title: "Shared/UI/AssetSelector",
  component: AssetSelector,
};

export default meta;

type Story = StoryObj<typeof AssetSelector>;

export const Default: Story = {
  args: {
    assets: ASSETS,
    value: "XLM",
    onChange: () => {},
    label: "Select Asset",
  },
};

export const WithInterestRates: Story = {
  args: {
    assets: ASSETS,
    value: "BTC",
    onChange: () => {},
    label: "Borrow Asset",
    interestRates: {
      XLM: 12,
      USDC: 10.5,
      BTC: 8,
      ETH: 9.5,
    },
  },
};

export const KeyboardInteraction: Story = {
  render: () => <AssetSelectorPlayStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", {
      name: /Selected asset: XLM/i,
    });

    await userEvent.click(trigger);
    await expect(canvas.getByPlaceholderText(/Type to search/i)).toBeInTheDocument();

    const searchInput = canvas.getByPlaceholderText(/Type to search/i);
    await userEvent.type(searchInput, "bt");
    await expect(canvas.getByText(/Bitcoin/i)).toBeInTheDocument();

    const btcOption = canvas.getByRole("option", { name: /BTC/i });
    await expect(btcOption).toBeInTheDocument();

    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    await expect(canvas.getByRole("button", {
      name: /Selected asset: BTC/i,
    })).toBeInTheDocument();

    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    await expect(trigger).toHaveFocus();
  },
};
