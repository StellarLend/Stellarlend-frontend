import type { Meta, StoryObj } from "@storybook/react";
import AssetSelector from "./AssetSelector";
import { ASSETS } from "@/lib/assets";

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
