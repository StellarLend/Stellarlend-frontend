import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Skeleton,
  TransactionRowSkeleton,
  TransactionCardSkeleton,
  TransactionsSkeleton,
} from "@/components/shared/common/Skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "Shared/Common/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
Shared loading-placeholder primitive.

**Consistent with** the \`animate-pulse\` pattern in \`InterestCalculator.tsx\`.

**Reduced-motion:** The \`motion-reduce:animate-none\` class suppresses the pulse
animation when the user has \`prefers-reduced-motion: reduce\` set in their OS.

### Loading / empty / error sequencing (alongside EmptyState)

| State | Component |
|---|---|
| \`loading === true\` | \`<TransactionsSkeleton />\` |
| \`loading === false && transactions.length === 0\` | \`<EmptyState />\` |
| \`loading === false && error\` | error message / retry UI |
| \`loading === false && transactions.length > 0\` | table rows |
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

// ----------------------------------------------------------------------------
// Primitive
// ----------------------------------------------------------------------------

export const Default: Story = {
  args: { className: "h-4 w-48" },
};

export const Circle: Story = {
  args: { className: "h-10 w-10 rounded-full" },
  name: "Circle (avatar)",
};

// ----------------------------------------------------------------------------
// Compositions
// ----------------------------------------------------------------------------

export const DesktopTableRow: StoryObj<typeof TransactionRowSkeleton> = {
  render: () => (
    <table className="min-w-full text-sm border">
      <thead>
        <tr className="bg-gray-50 text-gray-500 border-b">
          <th className="py-3 px-4 text-left font-semibold">Transaction Type</th>
          <th className="py-3 px-4 text-left font-semibold">Amount</th>
          <th className="py-3 px-4 text-left font-semibold">Asset</th>
          <th className="py-3 px-4 text-left font-semibold">Date</th>
          <th className="py-3 px-4 text-left font-semibold">Status</th>
        </tr>
      </thead>
      <tbody>
        <TransactionRowSkeleton index={0} />
        <TransactionRowSkeleton index={1} />
        <TransactionRowSkeleton index={2} />
      </tbody>
    </table>
  ),
  name: "Desktop table rows",
};

export const MobileCard: StoryObj<typeof TransactionCardSkeleton> = {
  render: () => (
    <div className="max-w-sm space-y-4">
      <TransactionCardSkeleton index={0} />
      <TransactionCardSkeleton index={1} />
    </div>
  ),
  name: "Mobile card",
};

export const FullTransactionsSkeleton: StoryObj<typeof TransactionsSkeleton> = {
  render: () => <TransactionsSkeleton count={6} />,
  name: "Full transactions skeleton (6 rows)",
};
