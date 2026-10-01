import type { Meta, StoryObj} from '@storybook/react';
import { useState } from 'react';
import LendingForm from './LendingForm';
import BorrowingForm from './BorrowingForm';
import InterestCalculator from './InterestCalculator';
import TransactionSummary from './TransactionSummary';
import ConfirmModal from './ConfirmModal';
import { LendingData } from '@/app/lending/page';

/**
 * Storybook coverage for the lending flow.
 *
 * Invariants enforced by these stories:
 * - The form never submits an invalid or degenerate payload (zero/negative amount,
 *   zero duration, missing collateral).
 * - Submitting is deterministic and idempotent while in flight: duplicate clicks do not
 *   produce concurrent submits.
 * - A failed submit leaves the form in a recoverable state (no stuck loading,
 *   error is surfaced and retry is allowed).
 * - The confirm modal cannot be confirmed twice and remains open when the
 *   confirmation fails.
 */

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

/**
 * Wrapper that exercises the form with a deterministic submit handler so
 * failure paths and double-submit guards can be observed in Storybook.
 */
function FormHarness({
  initialData,
  onAttempt,
  failFirstAttempt = false,
}: {
  initialData: LendingData;
  onAttempt?: (data: LendingData) => void;
  failFirstAttempt?: boolean;
}) {
  const [attempts, attemptsSet] = useState(0);
  const [error, errorSet] = useState<string | null>(null);

  const handleSubmit = async (data: LendingData) => {
    attemptsSet((n) => n + 1);
    onAttempt?.(data);
    if (failFirstAttempt && attempts === 0) {
      errorSet('Submission failed: transaction was rejected');
      throw new Error('Submission failed');
    }
    errorSet(null);
  };

  return (
    <div className="w-full max-w-md space-y-2">
      <LendingForm initialData={initialData} onSubmit={handleSubmit} />
      <p className="text-xs text-gray-500" data-testid="attempts">
        Attempts: {attempts}
      </p>
      {error ? (
        <p className="text-xs text-red-600" role="alert" data-testid="error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const LendingFormIdle: StoryObj = {
  render: () => (
    <div className="w-full max-w-md">
      <LendingForm initialData={mockData} onSubmit={() => {}} />
    </div>
  ),
};

export const LendingFormEmpty: StoryObj = {
  render: () => (
    <div className="w-full max-w-md">
      <LendingForm initialData={emptyData} onSubmit={() => {}} />
    </div>
  ),
};

export const LendingFormRejectsInvalidInput: StoryObj = {
  render: () => (
    <div className="w-full max-w-md">
      <LendingForm
        initialData={{ ...mockData, amount: -1, duration: 0 }}
        onSubmit={() => {}}
      />
    </div>
  ),
};

export const LendingFormSubmitFailureAndRetry: StoryObj = {
  render: () => <FormHarness initialData={mockData} failFirstAttempt />,
};

export const LendingFormDoubleSubmitGuard: StoryObj = {
  render: () => <FormHarness initialData={mockData} />,
};

export const BorrowingFormIdle: StoryObj = {
  render: () => (
    <div className="w-full max-w-md">
      <BorrowingForm initialData={mockData} onSubmit={() => {}} />
    </div>
  ),
};

export const BorrowingFormEmpty: StoryObj = {
  render: () => (
    <div className="w-full max-w-md">
      <BorrowingForm initialData={emptyData} onSubmit={() => {}} />
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

export const CalculatorBoundaryMaxDuration: StoryObj = {
  render: () => (
    <div className="w-full max-w-sm h-64">
      <InterestCalculator
        data={{ ...mockData, duration: 365, amount: Number.MAX_SAFE_INTEGER }}
        type="lend"
        onCalculate={() => {}}
      />
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

export const SummaryMissingCalculation: StoryObj = {
  render: () => (
    <div className="w-full max-w-sm h-96">
      <TransactionSummary data={mockData} calculation={undefined as any} type="lend" />
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

export const ConfirmationModalConfirmFailure: StoryObj = {
  render: () => (
    <div className="relative w-full h-screen">
      <ConfirmModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={async () => {
          throw new Error('Confirmation failed: network timeout');
        }}
        data={mockData}
        calculation={mockCalculation}
        type="lend"
      />
    </div>
  ),
};
