import React from 'react';
import { render, screen, fireEvent } from '@/test/test-utils';
import TransactionSummary from './TransactionSummary';
import type { LendingData, CalculationResult } from '@/lib/lending/types';

describe('TransactionSummary — copy to clipboard failure', () => {
  const baseLendData: LendingData = {
    asset: 'XLM',
    amount: 1000,
    interestRate: 8.5,
    duration: 30,
  };

  const baseCalculation: CalculationResult = {
    totalEarnings: 21.0,
    dailyEarnings: 0.7,
    totalRepayment: 1021,
    monthlyPayment: 1021,
  };

  it('shows error toast when clipboard write fails', async () => {
    // Mock navigator.clipboard.writeText to reject
    const mockWriteText = jest.spyOn(navigator.clipboard, 'writeText').mockImplementation(() => {
      return Promise.reject(new Error('Copy failed'));
    });

    render(
      <TransactionSummary data={baseLendData} calculation={baseCalculation} type="lend" />
    );

    const copyButton = screen.getByRole('button', { name: /copy transaction summary to clipboard/i });
    fireEvent.click(copyButton);

    // Wait for async state update
    const errorToast = await screen.findByText('Copy Failed');
    expect(errorToast).toBeTruthy();

    mockWriteText.mockRestore();
  });
});

describe('TransactionSummary — boundary conditions', () => {
  const baseData: LendingData = {
    asset: 'XLM',
    amount: Number.MAX_SAFE_INTEGER,
    interestRate: 0,
    duration: 0,
  };

  const baseCalc: CalculationResult = {
    totalEarnings: Number.MAX_SAFE_INTEGER,
    dailyEarnings: Number.MAX_SAFE_INTEGER,
    totalRepayment: Number.MAX_SAFE_INTEGER,
    monthlyPayment: Number.MAX_SAFE_INTEGER,
  };

  it('renders without crashing for extreme numeric values', () => {
    render(
      <TransactionSummary data={baseData} calculation={baseCalc} type="lend" />
    );
    // Verify that the component rendered the amount label
    expect(screen.getByText(/\d+/)).toBeTruthy();
  });

  it('shows empty state when amount is NaN', () => {
    const badData = { ...baseData, amount: NaN } as unknown as LendingData;
    render(
      <TransactionSummary data={badData} calculation={null} type="lend" />
    );
    expect(screen.getByText(/summary will appear here/i)).toBeTruthy();
  });
});
