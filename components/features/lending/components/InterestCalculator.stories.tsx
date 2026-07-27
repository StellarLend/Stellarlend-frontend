import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import InterestCalculator from '@/components/features/lending/components/InterestCalculator';
import type { LendingData } from '@/lib/lending/types';

const meta: Meta<typeof InterestCalculator> = {
  title: 'Features/Lending/InterestCalculator',
  component: InterestCalculator,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof InterestCalculator>;

const sampleData: LendingData = {
  amount: 1000,
  interestRate: 5,
  duration: 30,
  // add other required fields if needed
};

export const Lend: Story = {
  args: {
    data: sampleData,
    type: 'lend',
    onCalculate: (result) => console.log('calc', result),
  },
};

export const Borrow: Story = {
  args: {
    data: sampleData,
    type: 'borrow',
    onCalculate: (result) => console.log('calc', result),
  },
};
