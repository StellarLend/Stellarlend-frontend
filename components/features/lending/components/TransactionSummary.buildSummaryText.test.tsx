import { describe, it, expect, vi } from 'vitest';
import type { LendingData, CalculationResult } from '@/lib/lending/types';

// buildSummaryText calls the shared formatCurrency helper purely to render
// a value string; its exact currency formatting is not what this test
// suite is about (and is affected by a separate, pre-existing bug in
// lib/utils/format.ts). Mock it with a deterministic formatter so these
// tests only exercise buildSummaryText's own label/column logic.
vi.mock('@/lib/utils/format', () => ({
  formatCurrency: (value: number) => value.toFixed(2),
}));

import { buildSummaryText, padLabel, SUMMARY_LABEL_WIDTH } from './TransactionSummary';

const lendData: LendingData = {
  asset: 'XLM',
  amount: 1000,
  interestRate: 8.5,
  duration: 30,
};

const borrowData: LendingData = {
  asset: 'XLM',
  amount: 1000,
  interestRate: 12,
  duration: 30,
  collateral: 'USDC',
  collateralAmount: 1500,
};

const calculation: CalculationResult = {
  totalEarnings: 21.0,
  dailyEarnings: 0.7,
  totalRepayment: 1021,
  monthlyPayment: 1021,
};

/** Lines that look like `Label:<padding>value`, i.e. every "field" row. */
function labelLines(text: string): string[] {
  return text.split('\n').filter((line) => /^[A-Za-z ]+:\s/.test(line) || /^[A-Za-z ]+:$/.test(line));
}

describe('padLabel', () => {
  it('pads a short label to SUMMARY_LABEL_WIDTH characters', () => {
    expect(padLabel('Type:')).toBe('Type:'.padEnd(SUMMARY_LABEL_WIDTH));
    expect(padLabel('Type:').length).toBe(SUMMARY_LABEL_WIDTH);
  });

  it('pads every label used in the summary to the exact same width', () => {
    const labels = [
      'Type:',
      'Asset:',
      'Amount:',
      'Interest Rate:',
      'Duration:',
      'Start Date:',
      'End Date:',
      'Ratio:',
      'Daily Earnings:',
      'Total Earnings:',
      'Total Return:',
      'Monthly Payment:',
      'Total Interest:',
      'Total Repayment:',
      'Exported at:',
    ];

    for (const label of labels) {
      expect(padLabel(label).length).toBe(SUMMARY_LABEL_WIDTH);
    }
  });

  it('does not truncate a label longer than the column width', () => {
    // Regression guard for the original bug: a new label whose length
    // differs from the hand-picked ones must never silently misalign or
    // lose characters — padEnd only ever adds padding, never removes it.
    const longLabel = 'Estimated Annual Percentage Yield:';
    expect(longLabel.length).toBeGreaterThan(SUMMARY_LABEL_WIDTH);
    expect(padLabel(longLabel)).toBe(longLabel);
  });
});

describe('buildSummaryText column alignment', () => {
  it('aligns every field row in a lend summary to the same column', () => {
    const text = buildSummaryText(lendData, calculation, 'lend');
    const lines = labelLines(text);

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const label = line.match(/^[A-Za-z ]+:\s*/)![0];
      expect(label.length).toBe(SUMMARY_LABEL_WIDTH);
    }
  });

  it('aligns every field row in a borrow summary, including the Collateral block', () => {
    const text = buildSummaryText(borrowData, calculation, 'borrow');
    const lines = labelLines(text);

    expect(lines.some((l) => l.startsWith('Ratio:'))).toBe(true);
    for (const line of lines) {
      const label = line.match(/^[A-Za-z ]+:\s*/)![0];
      expect(label.length).toBe(SUMMARY_LABEL_WIDTH);
    }
  });

  it('keeps alignment for a repay-style summary with no calculation block', () => {
    const text = buildSummaryText(
      { asset: 'XLM', amount: 500, interestRate: 12 },
      null,
      'repay',
    );
    const lines = labelLines(text);

    for (const line of lines) {
      const label = line.match(/^[A-Za-z ]+:\s*/)![0];
      expect(label.length).toBe(SUMMARY_LABEL_WIDTH);
    }
  });

  it('regression: a hypothetical new, longer line item still starts its value at a predictable column instead of silently misaligning', () => {
    // Simulates the exact failure mode the issue describes: a future label
    // added to the summary whose length differs from the existing ones.
    // Because alignment is computed via padLabel/padEnd rather than
    // hand-counted spaces, the new line's value still starts exactly at
    // SUMMARY_LABEL_WIDTH (for any label under that width) with zero
    // additional bookkeeping required at the call site.
    const newLabel = 'Bonus Rewards:';
    const line = `${padLabel(newLabel)}42.00`;

    expect(line.indexOf('42.00')).toBe(SUMMARY_LABEL_WIDTH);
  });
});
