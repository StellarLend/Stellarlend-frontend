import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import LendingForm from './LendingForm';
import BorrowingForm from './BorrowingForm';
import InterestCalculator from './InterestCalculator';
import TransactionSummary from './TransactionSummary';
import ConfirmModal from './ConfirmModal';
import type { LendingData } from '@/app/lending/page';

const mockData: LendingData = {
  asset: 'XLM',
  amount: 1000,
  interestRate: 8.5,
  duration: 30,
  collateral: 'USDC',
  collateralAmount: 1500,
};

const emptyData: LendingData = {
  asset: '',
  amount: 0,
  interestRate: 0,
  duration: 0,
  collateral: '',
  collateralAmount: 0,
};

const boundaryData: LendingData = {
  asset: 'XLM',
  amount: Number.MAX_SAFE_INTEGER,
  interestRate: 100,
  duration: 365,
  collateral: 'USDC',
  collateralAmount: Number.MAX_SAFE_INTEGER,
};

const mockCalculation = {
  totalEarnings: 85,
  dailyEarnings: 2.8,
  monthlyPayment: 100,
  totalRepayment: 1085,
};

const mockCalculationZero = {
  totalEarnings: 0,
  dailyEarnings: 0,
  monthlyPayment: 0,
  totalRepayment: 0,
};

describe('LendingFlow - success paths', () => {
  it('renders LendingForm with valid initial data', () => {
    const onSubmit = vi.fn();
    render(<LendingForm initialData={mockData} onSubmit={onSubmit} />);
    expect(screen.getByText(/XLM/i)).toBeDefined();
  });

  it('renders BorrowingForm with valid initial data', () => {
    const onSubmit = vi.fn();
    render(<BorrowingForm initialData={mockData} onSubmit={onSubmit} />);
    expect(screen.getByText(/USDC/i)).toBeDefined();
  });

  it('renders InterestCalculator with valid data', () => {
    const onCalculate = vi.fn();
    render(<InterestCalculator data={mockData} type="lend" onCalculate={onCalculate} />);
    expect(screen.getByText(/8.5/)).toBeDefined();
  });

  it('renders TransactionSummary with valid calculation', () => {
    render(<TransactionSummary data={mockData} calculation={mockCalculation} type="lend" />);
    expect(screen.getByText(/85/)).toBeDefined();
  });
});

describe('LendingFlow - boundary cases', () => {
  it('renders InterestCalculator with empty data without crashing', () => {
    const onCalculate = vi.fn();
    render(<InterestCalculator data={emptyData} type="lend" onCalculate={onCalculate} />);
    expect(screen.getByText(/0/)).toBeDefined();
  });

  it('renders TransactionSummary with null calculation and empty data', () => {
    render(<TransactionSummary data={emptyData} calculation={null} type="lend" />);
    expect(screen.getByText(/0/)).toBeDefined();
  });

  it('renders TransactionSummary with zero calculation', () => {
    render(<TransactionSummary data={mockData} calculation={mockCalculationZero} type="lend" />);
    expect(screen.getByText(/0/)).toBeDefined();
  });

  it('renders InterestCalculator with boundary max values', () => {
    const onCalculate = vi.fn();
    render(<InterestCalculator data={boundaryData} type="lend" onCalculate={onCalculate} />);
    expect(screen.getByText(/100/)).toBeDefined();
  });
});

describe('LendingFlow - failure paths', () => {
  it('ConfirmModal handles confirm rejection without crashing', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('transaction failed'));
    const onClose = vi.fn();
    render(
      <ConfirmModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        data={mockData}
        calculation={mockCalculation}
        type="lend"
      />,
    );
    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
  });

  it('ConfirmModal does not call onConfirm when closed without confirmation', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        data={mockData}
        calculation={mockCalculation}
        type="lend"
      />,
    );
    const closeBtn = screen.getByRole('button', { name: /cancel|close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('LendingForm does not submit with invalid empty data', () => {
    const onSubmit = vi.fn();
    render(<LendingForm initialData={emptyData} onSubmit={onSubmit} />);
    const submitBtn = screen.queryByRole('button', { name: /submit|confirm/i });
    if (submitBtn) {
      fireEvent.click(submitBtn);
    }
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('LendingFlow - retry and concurrency', () => {
  it('ConfirmModal allows retry after failure', async () => {
    const onConfirm = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    render(
      <ConfirmModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        data={mockData}
        calculation={mockCalculation}
        type="lend"
      />,
    );
    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
  });

  it('ConfirmModal prevents concurrent confirmations from double click', async () => {
    let resolveConfirm: () => void = () => {};
    const onConfirm = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve as () => void;
        }),
    );
    const onClose = vi.fn();
    render(
      <ConfirmModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        data={mockData}
        calculation={mockCalculation}
        type="lend"
      />,
    );
    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    resolveConfirm();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('LendingFlow - regression guards', () => {
  it('preserves mockData immutability across renders', () => {
    const snapshot = { ...mockData };
    const onSubmit = vi.fn();
    const { unmount } = render(<LendingForm initialData={mockData} onSubmit={onSubmit} />);
    unmount();
    expect(mockData).toEqual(snapshot);
  });

  it('renders ConfirmModal in closed state without error', () => {
    render(
      <ConfirmModal
        isOpen={false}
        onClose={() => {}}
        onConfirm={async () => {}}
        data={mockData}
        calculation={mockCalculation}
        type="lend"
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
