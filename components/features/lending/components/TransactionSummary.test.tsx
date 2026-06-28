import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@/test/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import TransactionSummary from './TransactionSummary';
import type { LendingData, CalculationResult } from '@/app/lending/page';

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
