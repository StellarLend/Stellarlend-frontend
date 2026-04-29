import type { Meta, StoryObj } from "@storybook/react";
import { StatusBadge } from "./StatusBadge";

const meta: Meta<typeof StatusBadge> = {
  title: "Shared/UI/StatusBadge",
  component: StatusBadge,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["success", "pending", "failed", "neutral"],
    },
    size: {
      control: "select",
      options: ["sm", "md"],
    },
    label: { control: "text" },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Color-safe status badge for transaction states. Always renders an icon alongside the label so meaning is not conveyed by color alone, and exposes an explicit `aria-label` for screen readers (`role=\"status\"`).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof StatusBadge>;

export const Success: Story = {
  args: { variant: "success" },
};

export const Pending: Story = {
  args: { variant: "pending" },
};

export const Failed: Story = {
  args: { variant: "failed" },
};

export const Neutral: Story = {
  args: { variant: "neutral", label: "Unknown" },
};

export const CustomLabel: Story = {
  args: { variant: "pending", label: "Awaiting confirmation" },
};

export const MediumSize: Story = {
  args: { variant: "success", size: "md" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <StatusBadge variant="success" />
      <StatusBadge variant="pending" />
      <StatusBadge variant="failed" />
      <StatusBadge variant="neutral" />
    </div>
  ),
};

export const InTableRow: Story = {
  render: () => (
    <table className="min-w-[420px] border text-sm">
      <thead>
        <tr className="bg-gray-50 text-gray-500">
          <th className="px-4 py-2 text-left">Transaction</th>
          <th className="px-4 py-2 text-left">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-t">
          <td className="px-4 py-2">Deposit · #TXN12345</td>
          <td className="px-4 py-2">
            <StatusBadge variant="success" />
          </td>
        </tr>
        <tr className="border-t">
          <td className="px-4 py-2">Loan Payment · #TXN12346</td>
          <td className="px-4 py-2">
            <StatusBadge variant="pending" />
          </td>
        </tr>
        <tr className="border-t">
          <td className="px-4 py-2">Lend Funds · #TXN12349</td>
          <td className="px-4 py-2">
            <StatusBadge variant="failed" />
          </td>
        </tr>
      </tbody>
    </table>
  ),
};
