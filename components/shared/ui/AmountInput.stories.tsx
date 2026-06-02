import type { Meta, StoryObj } from '@storybook/react';
import { AmountInput } from './AmountInput';

const meta: Meta<typeof AmountInput> = {
  title: 'Components/Shared/UI/AmountInput',
  component: AmountInput,
  argTypes: {
    onChange: { action: 'changed' },
    onMax: { action: 'max clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof AmountInput>;

export const Default: Story = {
  args: {
    value: 1234.56,
    onChange: () => {},
    precision: 2,
    label: 'Amount',
  },
};

export const WithUnit: Story = {
  args: {
    value: 1234.56,
    onChange: () => {},
    precision: 2,
    label: 'Amount',
    unit: 'XLM',
  },
};

export const WithMax: Story = {
  args: {
    value: 100,
    onChange: () => {},
    precision: 2,
    label: 'Amount',
    max: 1000,
    onMax: () => {},
  },
};

export const HighPrecision: Story = {
  args: {
    value: 1234.5678,
    onChange: () => {},
    precision: 4,
    label: 'Amount',
  },
};
