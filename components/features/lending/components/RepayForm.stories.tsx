import type { Meta, StoryObj } from "@storybook/react";
import RepayForm from "./RepayForm";
import type { BorrowPosition } from "@/hooks/usePositions";

const mockPositions: BorrowPosition[] = [
  { id: "borrow-XLM", asset: "XLM", amount: 1500, healthFactor: 1.5, nextDue: "in 4 days" },
  { id: "borrow-USDC", asset: "USDC", amount: 500, healthFactor: 2.1 },
];

const meta: Meta<typeof RepayForm> = {
  title: "Features/Lending/RepayForm",
  component: RepayForm,
  parameters: {
    layout: "centered",
  },
};
export default meta;

type Story = StoryObj<typeof RepayForm>;

export const Default: Story = {
  args: {
    positions: mockPositions,
    onSubmit: (data) => console.log("Submit Repayment:", data),
  },
};

export const Loading: Story = {
  args: {
    positions: undefined, // Will trigger live fetch path in UI, showing skeletons if mocked appropriately
    onSubmit: (data) => console.log("Submit Repayment:", data),
  },
  parameters: {
    // If we mock the network in storybook, we can simulate slow load, but passing undefined will showcase skeleton in storybook when the API hasn't loaded.
  },
};

export const Empty: Story = {
  args: {
    positions: [],
    onSubmit: (data) => console.log("Submit Repayment:", data),
  },
};
