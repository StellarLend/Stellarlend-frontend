cat > src/components/Pagination/Pagination.stories.tsx << 'EOF'
import type { Meta, StoryObj } from '@storybook/react';
import { expect } from '@storybook/test';
import { Pagination } from './Pagination';


const meta: Meta<typeof Pagination> = {
  title: 'Design System/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    componentSubtitle: 'Navigation for paginated content',
  },
  argTypes: {
    totalPages: { control: 'number' },
    currentPage: { control: 'number' },
    variant: {
      control: 'select',
      options: ['compact', 'full'],
      table: { defaultValue: { summary: 'full' } },
    },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    error: { control: 'boolean' },
    onPageChange: { action: 'page changed' },
  },
};

export default meta;
type Story = StoryObj<typeof Pagination>;

export const Default: Story = {
  args: {
    totalPages: 10,
    currentPage: 1,
    variant: 'full',
  },
};

export const MiddlePage: Story = {
  args: {
    totalPages: 20,
    currentPage: 10,
    variant: 'full',
  },
  parameters: { docs: { storyDescription: 'Current page in the middle of a long range' } },
};

export const LastPage: Story = {
  args: {
    totalPages: 10,
    currentPage: 10,
    variant: 'full',
  },
  parameters: { docs: { storyDescription: 'Next button should be disabled' } },
};

export const Compact: Story = {
  args: {
    totalPages: 10,
    currentPage: 5,
    variant: 'compact',
  },
  parameters: { docs: { storyDescription: 'Minimal variant for tight spaces' } },
};

export const Hover: Story = {
  args: {
    totalPages: 5,
    currentPage: 1,
  },
  parameters: { pseudo: { hover: true } },
};

export const Focus: Story = {
  args: {
    totalPages: 5,
    currentPage: 3,
  },
  parameters: { pseudo: { focus: true } },
};

export const Disabled: Story = {
  args: {
    totalPages: 1,
    currentPage: 1,
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const buttons = canvasElement.querySelectorAll('button');
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  },
};

export const Loading: Story = {
  args: {
    totalPages: 10,
    currentPage: 1,
    loading: true,
  },
  play: async ({ canvasElement }) => {
    const skeleton = canvasElement.querySelector('[data-testid="pagination-skeleton"]');
    expect(skeleton).toBeInTheDocument();
  },
};

export const Error: Story = {
  args: {
    totalPages: 10,
    currentPage: 99,
    error: true,
  },
  parameters: {
    docs: { storyDescription: 'Invalid page number selected' },
  },
};

export const StateMatrix: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs text-slate-500 mb-2">Full Variant</p>
        <Pagination totalPages={10} currentPage={1} variant="full" />
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-2">Compact Variant</p>
        <Pagination totalPages={10} currentPage={5} variant="compact" />
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-2">Disabled</p>
        <Pagination totalPages={5} currentPage={1} disabled />
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-2">Loading</p>
        <Pagination totalPages={10} currentPage={1} loading />
      </div>
    </div>
  ),
};