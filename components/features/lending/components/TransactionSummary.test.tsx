import React from 'react';
import { render, screen, within } from '@/test/test-utils';
import { describe, it, expect } from 'vitest';
import TransactionSummary from './TransactionSummary';
import type { LendingData, CalculationResult } from '@/lib/lending/types';

const baseRepayData: LendingData = {
  asset: 'XLM',
  amount: 500,
  interestRate: 12,
  outstandingDebt: 1500,
  remainingDebt: 1000,
  healthFactorBefore: 1.5,
  healthFactorAfter: 2.25,
};

const baseWithdrawData: LendingData = {
  asset: 'XLM',
  amount: 500,
  interestRate: 0,
  outstandingDebt: 1500,
  remainingDebt: 4500,
  collateralAmount: 2250,
  healthFactorBefore: 1.85,
  healthFactorAfter: 1.67,
};

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

describe('TransactionSummary — empty state', () => {
  it('shows empty state when amount is 0 (repay)', () => {
    render(
      <TransactionSummary
        data={{ ...baseRepayData, amount: 0 }}
        calculation={null}
        type="repay"
      />,
    );
    expect(screen.getByText(/summary will appear here/i)).toBeTruthy();
  });

  it('shows empty state when amount is 0 (withdraw)', () => {
    render(
      <TransactionSummary
        data={{ ...baseWithdrawData, amount: 0 }}
        calculation={null}
        type="withdraw"
      />,
    );
    expect(screen.getByText(/summary will appear here/i)).toBeTruthy();
  });
});

describe('TransactionSummary — loading state (lend/borrow only)', () => {
  it('shows loading skeleton for lend when calculation is null', () => {
    const { container } = render(
      <TransactionSummary data={baseLendData} calculation={null} type="lend" />,
    );
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('shows loading skeleton for borrow when calculation is null', () => {
    const { container } = render(
      <TransactionSummary
        data={{ ...baseLendData, interestRate: 12 }}
        calculation={null}
        type="borrow"
      />,
    );
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('does NOT show loading skeleton for repay when calculation is null', () => {
    const { container } = render(
      <TransactionSummary data={baseRepayData} calculation={null} type="repay" />,
    );
    expect(container.querySelector('.animate-pulse')).toBeFalsy();
  });

  it('does NOT show loading skeleton for withdraw when calculation is null', () => {
    const { container } = render(
      <TransactionSummary data={baseWithdrawData} calculation={null} type="withdraw" />,
    );
    expect(container.querySelector('.animate-pulse')).toBeFalsy();
  });
});

describe('TransactionSummary — lend/borrow unchanged', () => {
  it('renders lend summary with expected returns', () => {
    render(
      <TransactionSummary data={baseLendData} calculation={baseCalculation} type="lend" />,
    );
    expect(screen.getByText('Expected Returns')).toBeTruthy();
    expect(screen.getByText('Daily Earnings')).toBeTruthy();
    expect(screen.getByText('Total Earnings')).toBeTruthy();
    expect(screen.getByText('LEND')).toBeTruthy();
  });

  it('renders lend breakdown rows, signed earnings, and total return', () => {
    render(
      <TransactionSummary data={baseLendData} calculation={baseCalculation} type="lend" />,
    );

    expect(screen.getByText('Lending')).toBeInTheDocument();
    expect(screen.getByText('Asset')).toBeInTheDocument();
    expect(screen.getByText('XLM')).toBeInTheDocument();
    expect(screen.getByText('Interest Rate')).toBeInTheDocument();
    expect(screen.getByText('8.5% APY')).toBeInTheDocument();
    expect(screen.getByText('Daily Earnings')).toBeInTheDocument();
    expect(screen.getByText('+0.7000 USD')).toBeInTheDocument();
    expect(screen.getByText('Total Earnings')).toBeInTheDocument();
    expect(screen.getByText('+21.0000 USD')).toBeInTheDocument();
    expect(screen.getByText('Total Return')).toBeInTheDocument();
    expect(screen.getByText('1,021.0000 USD')).toBeInTheDocument();
  });

  it('renders borrow summary with repayment details', () => {
    render(
      <TransactionSummary
        data={{ ...baseLendData, interestRate: 12 }}
        calculation={baseCalculation}
        type="borrow"
      />,
    );
    expect(screen.getByText('Repayment Details')).toBeTruthy();
    expect(screen.getByText('Total Interest')).toBeTruthy();
    expect(screen.getByText('BORROW')).toBeTruthy();
  });

  it('renders borrow collateral, repayment rows, and repayment table totals', () => {
    const borrowData: LendingData = {
      asset: 'USDC',
      amount: 2500,
      interestRate: 10.5,
      duration: 45,
      collateral: 'XLM',
      collateralAmount: 5000,
    };
    const borrowCalculation: CalculationResult = {
      dailyEarnings: 0,
      totalEarnings: 125.55,
      monthlyPayment: 875.18,
      totalRepayment: 2625.55,
    };

    render(
      <TransactionSummary
        data={borrowData}
        calculation={borrowCalculation}
        type="borrow"
      />,
    );

    expect(screen.getByText('Borrowing')).toBeInTheDocument();
    expect(screen.getByText('10.5% APR')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('45 days')).toBeInTheDocument();
    expect(screen.getByText('Collateral')).toBeInTheDocument();
    expect(screen.getAllByText('XLM').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Monthly Payment')).toBeInTheDocument();
    expect(screen.getByText('875.1800 USD')).toBeInTheDocument();
    expect(screen.getAllByText('Total Interest').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('125.5500 USD').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Total Repayment').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2,625.5500 USD').length).toBeGreaterThanOrEqual(1);

    const table = screen.getByRole('table', { name: /repayment breakdown table/i });
    expect(within(table).getByText('Principal')).toBeInTheDocument();
    expect(within(table).getByText('2,500.0000 USD')).toBeInTheDocument();
  });
});

describe('TransactionSummary — repay type', () => {
  it('renders REPAY badge', () => {
    render(
      <TransactionSummary data={baseRepayData} calculation={null} type="repay" />,
    );
    expect(screen.getByText('REPAY')).toBeTruthy();
  });

  it('shows Repaying label', () => {
    render(
      <TransactionSummary data={baseRepayData} calculation={null} type="repay" />,
    );
    expect(screen.getByText('Repaying')).toBeTruthy();
  });

  it('renders Repayment Breakdown section', () => {
    render(
      <TransactionSummary data={baseRepayData} calculation={null} type="repay" />,
    );
    expect(screen.getByText('Repayment Breakdown')).toBeTruthy();
    expect(screen.getByText('Amount Repaid')).toBeTruthy();
    expect(screen.getByText('Remaining Debt')).toBeTruthy();
    expect(screen.getByText('New Health Factor')).toBeTruthy();
  });

  it('shows partial repay values correctly', () => {
    render(
      <TransactionSummary data={baseRepayData} calculation={null} type="repay" />,
    );
    expect(screen.getByText('2.25')).toBeTruthy();
  });

  it('shows "Debt cleared" for remaining debt when full repay (remainingDebt = 0)', () => {
    render(
      <TransactionSummary
        data={{ ...baseRepayData, remainingDebt: 0, healthFactorAfter: Infinity }}
        calculation={null}
        type="repay"
      />,
    );
    const clearedEls = screen.getAllByText('Debt cleared');
    expect(clearedEls.length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Debt cleared" for health factor when full repay (Infinity)', () => {
    render(
      <TransactionSummary
        data={{ ...baseRepayData, remainingDebt: 0, healthFactorAfter: Infinity }}
        calculation={null}
        type="repay"
      />,
    );
    const clearedEls = screen.getAllByText('Debt cleared');
    expect(clearedEls.length).toBeGreaterThanOrEqual(2);
  });

  it('renders correctly when calculation is provided alongside repay data', () => {
    render(
      <TransactionSummary
        data={baseRepayData}
        calculation={baseCalculation}
        type="repay"
      />,
    );
    expect(screen.getByText('Repayment Breakdown')).toBeTruthy();
    expect(screen.queryByText('Expected Returns')).toBeFalsy();
    expect(screen.queryByText('Repayment Details')).toBeFalsy();
  });
});

describe('TransactionSummary — withdraw type', () => {
  it('renders WITHDRAW badge', () => {
    render(
      <TransactionSummary data={baseWithdrawData} calculation={null} type="withdraw" />,
    );
    expect(screen.getByText('WITHDRAW')).toBeTruthy();
  });

  it('shows Withdrawing label', () => {
    render(
      <TransactionSummary data={baseWithdrawData} calculation={null} type="withdraw" />,
    );
    expect(screen.getByText('Withdrawing')).toBeTruthy();
  });

  it('renders Withdrawal Breakdown section', () => {
    render(
      <TransactionSummary data={baseWithdrawData} calculation={null} type="withdraw" />,
    );
    expect(screen.getByText('Withdrawal Breakdown')).toBeTruthy();
    expect(screen.getByText('Amount Redeemed')).toBeTruthy();
    expect(screen.getByText('Remaining Supply')).toBeTruthy();
  });

  it('shows health factor row when position has outstanding debt', () => {
    render(
      <TransactionSummary data={baseWithdrawData} calculation={null} type="withdraw" />,
    );
    expect(screen.getByText('New Health Factor')).toBeTruthy();
    expect(screen.getByText('1.67')).toBeTruthy();
  });

  it('hides health factor row when no outstanding debt', () => {
    render(
      <TransactionSummary
        data={{ ...baseWithdrawData, outstandingDebt: 0 }}
        calculation={null}
        type="withdraw"
      />,
    );
    expect(screen.queryByText('New Health Factor')).toBeFalsy();
  });

  it('shows remaining supply amount', () => {
    render(
      <TransactionSummary data={baseWithdrawData} calculation={null} type="withdraw" />,
    );
    expect(screen.getByText('Remaining Supply')).toBeTruthy();
  });

  it('does not render Expected Returns or Repayment Details for withdraw', () => {
    render(
      <TransactionSummary data={baseWithdrawData} calculation={null} type="withdraw" />,
    );
    expect(screen.queryByText('Expected Returns')).toBeFalsy();
    expect(screen.queryByText('Repayment Details')).toBeFalsy();
  });

  it('renders correctly when partial withdraw — position with no debt', () => {
    render(
      <TransactionSummary
        data={{
          ...baseWithdrawData,
          amount: 300,
          outstandingDebt: 0,
          remainingDebt: 4700,
          healthFactorAfter: 99,
        }}
        calculation={null}
        type="withdraw"
      />,
    );
    expect(screen.getByText('Withdrawal Breakdown')).toBeTruthy();
    expect(screen.queryByText('New Health Factor')).toBeFalsy();
  });
});
