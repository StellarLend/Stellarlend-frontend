import type { Meta, StoryObj } from '@storybook/react';
import LendingForm from './LendingForm';
import BorrowingForm from './BorrowingForm';
import InterestCalculator from './InterestCalculator';
import TransactionSummary from './TransactionSummary';
import ConfirmModal from './ConfirmModal';
import { LendingData } from '@/app/lending/page';

const mockData: LendingData = {
  asset: 'XLM',
  amount: 1000,
  interestRate: 8.5,
  duration: 30,
  collateral: 'USDC',
  collateralAmount: 1500,
};

const emptyData: LendingData = {
  asset: 'XLM',
  amount: 0,
  interestRate: 0,
  duration: 0,
  collateral: '',
  collateralAmount: 0,
};

const mockCalculation = {
  totalEarnings: 85,
  dailyEarnings: 2.8,
  monthlyPayment: 100,
  totalRepayment: 1085,
};

const meta: Meta = {
  title: 'Features/Lending',
  parameters: {
    layout: 'centered',
  },
};
export default meta;

export const LendingFormIdle: StoryObj = {
  render: () => (
    <div className="w-full max-w-md">
      <LendingForm initialData={mockData} onSubmit={console.log} />
    </div>
  ),
};

export const BorrowingFormIdle: StoryObj = {
  render: () => (
    <div className="w-full max-w-md">
      <BorrowingForm initialData={mockData} onSubmit={console.log} />
    </div>
  ),
};

export const CalculatorEmpty: StoryObj = {
  render: () => (
    <div className="w-full max-w-sm h-64">
      <InterestCalculator data={emptyData} type="lend" onCalculate={() => {}} />
    </div>
  ),
};

export const CalculatorLoading: StoryObj = {
  render: () => (
    <div className="w-full max-w-sm h-64">
      <InterestCalculator data={{ ...mockData, amount: 100 }} type="lend" onCalculate={() => {}} />
    </div>
  ),
};

export const CalculatorSuccess: StoryObj = {
  render: () => (
    <div className="w-full max-w-sm h-64">
      <InterestCalculator data={mockData} type="lend" onCalculate={() => {}} />
    </div>
  ),
};

export const SummaryEmpty: StoryObj = {
  render: () => (
    <div className="w-full max-w-sm h-96">
      <TransactionSummary data={emptyData} calculation={null} type="lend" />
    </div>
  ),
};

export const SummaryLoading: StoryObj = {
  render: () => (
    <div className="w-full max-w-sm h-96">
      <TransactionSummary data={mockData} calculation={null} type="lend" />
    </div>
  ),
};

export const SummarySuccess: StoryObj = {
  render: () => (
    <div className="w-full max-w-sm h-96">
      <TransactionSummary data={mockData} calculation={mockCalculation} type="lend" />
    </div>
  ),
};

export const ConfirmationModal: StoryObj = {
  render: () => (
    <div className="relative w-full h-screen">
      <ConfirmModal 
        isOpen={true} 
        onClose={() => {}} 
        onConfirm={async () => new Promise(resolve => setTimeout(resolve, 1000))} 
        data={mockData} 
        calculation={mockCalculation} 
        type="lend" 
      />
    </div>
  ),
};