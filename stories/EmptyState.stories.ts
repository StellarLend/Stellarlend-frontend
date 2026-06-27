import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EmptyState } from "@/components/shared/common/EmptyState";

const meta: Meta<typeof EmptyState> = {
  title: "Shared/EmptyState",
  component: EmptyState,
};

export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: "No transactions yet",
    description:
      "Your transaction history will appear here once you lend, borrow, or settle payments on Stellarlend.",
    actionLabel: "Explore lending",
  },
};

export const WithoutAction: Story = {
  args: {
    title: "No profile data",
    description: "Complete your profile to unlock lending and borrowing features.",
  },
};
