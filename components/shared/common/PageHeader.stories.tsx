import type { Meta, StoryObj } from "@storybook/react";
import { PageHeader } from "./PageHeader";

const meta: Meta<typeof PageHeader> = {
  title: "Shared/Common/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
  argTypes: {
    tone: {
      control: "select",
      options: ["dark", "light"],
    },
    as: {
      control: "select",
      options: ["h1", "h2"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

const DarkBackground = (Story: React.ComponentType) => (
  <div className="bg-[#15A350] p-8">
    <Story />
  </div>
);

const LightBackground = (Story: React.ComponentType) => (
  <div className="bg-slate-50 p-8">
    <Story />
  </div>
);

export const Dashboard: Story = {
  args: {
    title: "Dashboard",
    description: "Track lending, borrowing, and collateral health at a glance.",
    tone: "dark",
  },
  decorators: [DarkBackground],
};

export const WithActions: Story = {
  args: {
    title: "Transactions",
    description: "All on-chain activity tied to your account.",
    tone: "dark",
    actions: (
      <button
        type="button"
        className="rounded-lg border border-[#71B48D] bg-[#15A350] px-4 py-2 text-sm font-semibold text-white"
      >
        Export CSV
      </button>
    ),
  },
  decorators: [DarkBackground],
};

export const Lending: Story = {
  args: {
    title: "Lending & Borrowing",
    description: "Earn interest by lending your assets or borrow against your collateral.",
    tone: "dark",
  },
  decorators: [
    (Story) => (
      <div className="bg-gradient-to-b from-green-700 to-black p-8">
        <Story />
      </div>
    ),
  ],
};

export const AccountLight: Story = {
  args: {
    title: "Profile",
    description: "Manage personal details, security, and notification preferences.",
    tone: "light",
  },
  decorators: [LightBackground],
};

export const TitleOnly: Story = {
  args: {
    title: "Settings",
    tone: "light",
  },
  decorators: [LightBackground],
};
