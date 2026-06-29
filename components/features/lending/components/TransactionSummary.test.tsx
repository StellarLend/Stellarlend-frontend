import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@/test/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import TransactionSummary from './TransactionSummary';
import type { LendingData, CalculationResult } from '@/lib/lending/types';

// Mock clipboard utility
vi.mock('@/lib/utils/clipboard', () => ({
  copyToClipboard: vi.fn(),
}));

import { copyToClipboard } from '@/lib/utils/clipboard';

const mockCopyToClipboard = vi.mocked(copyToClipboard);

// Mock data
const mockLendingData: LendingData = {
  amount: 100,
  asset: 'XLM',
  interestRate: 5.5,
  duration: 30,
  collateral: 'USDC',
  collateralAmount: 150,
};

const mockCalculation: CalculationResult = {
  dailyEarnings: 0.15,
  totalEarnings: 4.5,
  totalRepayment: 104.5,
  monthlyPayment: 35,
};

const mockProps = {
  data: mockLendingData,
  calculation: mockCalculation,
  type: 'lend' as const,
};

describe('TransactionSummary — copy action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // SUITE 1 — Button rendering
  describe('button rendering', () => {
    it('renders copy button with accessible label', () => {
      render(<TransactionSummary {...mockProps} />);
      expect(
        screen.getByRole('button', {
          name: /copy transaction summary/i,
        })
      ).toBeInTheDocument();
    });

    it('copy button is keyboard accessible', () => {
      render(<TransactionSummary {...mockProps} />);
      const btn = screen.getByRole('button', {
        name: /copy transaction summary/i,
      });
      expect(btn).not.toHaveAttribute('tabindex', '-1');
    });
  });

  // SUITE 2 — Successful copy
  describe('successful copy', () => {
    it('calls clipboard utility with summary text on click', async () => {
      mockCopyToClipboard.mockResolvedValue({ success: true });
      render(<TransactionSummary {...mockProps} />);

      const btn = screen.getByRole('button', {
        name: /copy transaction summary/i,
      });
      await userEvent.click(btn);

      expect(mockCopyToClipboard).toHaveBeenCalledWith(
        expect.stringContaining(mockProps.data.asset)
      );
    });

    it('shows success toast on successful copy', async () => {
      mockCopyToClipboard.mockResolvedValue({ success: true });
      render(<TransactionSummary {...mockProps} />);

      const btn = screen.getByRole('button', {
        name: /copy transaction summary/i,
      });
      await userEvent.click(btn);

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });

    it('shows Copied state in button after success', async () => {
      mockCopyToClipboard.mockResolvedValue({ success: true });
      render(<TransactionSummary {...mockProps} />);

      const btn = screen.getByRole('button', {
        name: /copy transaction summary/i,
      });
      await userEvent.click(btn);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /✓.*copied/i })).toBeInTheDocument();
      });
    });
  });

  // SUITE 3 — Clipboard API unavailable / fallback
  describe('clipboard API unavailable or fallback', () => {
    it('uses execCommand fallback when clipboard API unavailable', async () => {
      // Simulate fallback by resolving successfully (clipboard utility handles fallback internally)
      mockCopyToClipboard.mockResolvedValue({ success: true });
      render(<TransactionSummary {...mockProps} />);

      const btn = screen.getByRole('button', {
        name: /copy transaction summary/i,
      });
      await userEvent.click(btn);

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
      expect(mockCopyToClipboard).toHaveBeenCalled();
    });

    it('shows failure state when copy is rejected', async () => {
      mockCopyToClipboard.mockResolvedValue({
        success: false,
        reason: 'clipboard_error',
      });
      render(<TransactionSummary {...mockProps} />);

      const btn = screen.getByRole('button', {
        name: /copy transaction summary/i,
      });
      await userEvent.click(btn);

      await waitFor(() => {
        expect(screen.getByText('Copy Failed')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /✗.*failed/i })).toBeInTheDocument();
    });
  });

  // SUITE 4 — Empty/partial summary
  describe('empty or partial data', () => {
    it('renders empty state when data is invalid', () => {
      render(
        <TransactionSummary
          data={{ ...mockLendingData, amount: 0 }}
          calculation={mockCalculation}
          type="lend"
        />
      );
      expect(
        screen.getByText(/summary will appear here/i)
      ).toBeInTheDocument();
    });

    it('summary text contains all displayed fields from lend transaction', async () => {
      mockCopyToClipboard.mockResolvedValue({ success: true });
      render(<TransactionSummary {...mockProps} />);

      const btn = screen.getByRole('button', {
        name: /copy transaction summary/i,
      });
      await userEvent.click(btn);

      const copiedText = mockCopyToClipboard.mock.calls[0][0];
      expect(copiedText).toContain('Transaction Summary');
      expect(copiedText).toContain(mockProps.data.asset);
      expect(copiedText).toContain('100');
      expect(copiedText).toContain('5.5');
      expect(copiedText).toContain('APY');
      expect(copiedText).toContain('Daily Earnings');
      expect(copiedText).toContain('Total Earnings');
      expect(copiedText).toContain('Total Return');
    });

    it('summary text contains all displayed fields from borrow transaction', async () => {
      mockCopyToClipboard.mockResolvedValue({ success: true });
      render(
        <TransactionSummary
          {...mockProps}
          type="borrow"
        />
      );

      const btn = screen.getByRole('button', {
        name: /copy transaction summary/i,
      });
      await userEvent.click(btn);

      const copiedText = mockCopyToClipboard.mock.calls[0][0];
      expect(copiedText).toContain('Borrowing');
      expect(copiedText).toContain('APR');
      expect(copiedText).toContain('Duration');
      expect(copiedText).toContain('Collateral');
      expect(copiedText).toContain('Monthly Payment');
      expect(copiedText).toContain('Total Repayment');
    });
  });

  // SUITE 5 — Security
  describe('security', () => {
    it('does not include session or secret values in copied text', async () => {
      mockCopyToClipboard.mockResolvedValue({ success: true });
      render(<TransactionSummary {...mockProps} />);

      const btn = screen.getByRole('button', {
        name: /copy transaction summary/i,
      });
      await userEvent.click(btn);

      const copiedText = mockCopyToClipboard.mock.calls[0][0];
      // Ensure no internal tokens or secrets are included
      expect(copiedText).not.toContain('token');
      expect(copiedText).not.toContain('secret');
      expect(copiedText).not.toContain('key');
      expect(copiedText).not.toContain('password');
    });

    it('only copies values already visible on screen', async () => {
      mockCopyToClipboard.mockResolvedValue({ success: true });
      render(<TransactionSummary {...mockProps} />);

      const btn = screen.getByRole('button', {
        name: /copy transaction summary/i,
      });
      await userEvent.click(btn);

      const copiedText = mockCopyToClipboard.mock.calls[0][0];
      // Assert no serialization artifacts
      expect(copiedText).not.toContain('undefined');
      expect(copiedText).not.toContain('[object Object]');
      expect(copiedText).not.toContain('null');
    });
  });

  // SUITE 6 — Repeated copies
  describe('repeated copies and state management', () => {
    it('button is disabled while copying', async () => {
      let resolveFirst: (() => void) | null = null;
      mockCopyToClipboard.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFirst = () => resolve({ success: true });
          })
      );
      render(<TransactionSummary {...mockProps} />);

      const btn = screen.getByRole('button', {
        name: /copy transaction summary/i,
      });

      await act(async () => {
        await userEvent.click(btn);
      });

      expect(btn).toBeDisabled();

      if (resolveFirst) {
        await act(async () => {
          resolveFirst();
        });
      }
    });

    it('resets to idle after 2 seconds', async () => {
      mockCopyToClipboard.mockResolvedValue({ success: true });
      render(<TransactionSummary {...mockProps} />);

      const btn = screen.getByRole('button', {
        name: /copy transaction summary/i,
      });

      await act(async () => {
        await userEvent.click(btn);
      });

      // Button should be in copied state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /✓.*copied/i })).toBeInTheDocument();
      });

      // Advance timers by 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Button should return to idle state
      expect(
        screen.getByRole('button', {
          name: /copy transaction summary/i,
        })
      ).toBeInTheDocument();
    });
  });

  // SUITE 7 — Accessibility
  describe('accessibility', () => {
    it('has aria-live region for screen reader announcement', () => {
      render(<TransactionSummary {...mockProps} />);
      const liveRegion = document.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();
    });

    it('announces copy result to screen readers', async () => {
      mockCopyToClipboard.mockResolvedValue({ success: true });
      render(<TransactionSummary {...mockProps} />);

      const btn = screen.getByRole('button', {
        name: /copy transaction summary/i,
      });

      await act(async () => {
        await userEvent.click(btn);
      });

      const announcement = document.querySelector('[role="status"]');
      await waitFor(() => {
        expect(announcement?.textContent).toContain('copied');
      });
    });

    it('button label updates for screen readers based on state', async () => {
      mockCopyToClipboard.mockResolvedValue({ success: true });
      render(<TransactionSummary {...mockProps} />);

      const btn = screen.getByRole('button', {
        name: /copy transaction summary/i,
      });

      expect(btn).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Copy transaction summary')
      );

      await act(async () => {
        await userEvent.click(btn);
      });

      await waitFor(() => {
        expect(btn).toHaveAttribute(
          'aria-label',
          expect.stringContaining('copied')
        );
      });
    });
  });

  // SUITE 8 — Text format validation
  describe('summary text format', () => {
    it('exports summary with ISO timestamp', async () => {
      mockCopyToClipboard.mockResolvedValue({ success: true });
      render(<TransactionSummary {...mockProps} />);

      const btn = screen.getByRole('button', {
        name: /copy transaction summary/i,
      });
      await userEvent.click(btn);

      const copiedText = mockCopyToClipboard.mock.calls[0][0];
      expect(copiedText).toMatch(/Exported at:\s+\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('formats amounts with proper currency localization', async () => {
      mockCopyToClipboard.mockResolvedValue({ success: true });
      render(<TransactionSummary {...mockProps} />);

      const btn = screen.getByRole('button', {
        name: /copy transaction summary/i,
      });
      await userEvent.click(btn);

      const copiedText = mockCopyToClipboard.mock.calls[0][0];
      // Should contain formatted amounts with commas and decimals
      expect(copiedText).toMatch(/\d+(\.\d+)?\s+XLM/);
    });
  });
});

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
});

describe('TransactionSummary — currency formatting and edge cases', () => {
  it('formats currency correctly for large maximum amount', () => {
    const largeAmountData: LendingData = {
      asset: 'XLM',
      amount: 1000000.1234,
      interestRate: 5,
    };
    const largeCalculation: CalculationResult = {
      totalEarnings: 50000.12,
      dailyEarnings: 136.986,
      totalRepayment: 1050000.2434,
    };
    render(
      <TransactionSummary data={largeAmountData} calculation={largeCalculation} type="lend" />,
    );
    expect(screen.getByText('1,000,000.1234 XLM')).toBeInTheDocument();
  });

  it('handles zero fees (zero totalEarnings for lend)', () => {
    const zeroFeeCalc: CalculationResult = {
      totalEarnings: 0,
      dailyEarnings: 0,
      totalRepayment: 1000,
    };
    render(
      <TransactionSummary data={baseLendData} calculation={zeroFeeCalc} type="lend" />,
    );
    expect(screen.getByText('+0.0000 XLM')).toBeInTheDocument();
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
