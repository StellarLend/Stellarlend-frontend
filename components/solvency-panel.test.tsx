import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SolvencyPanel, defaultSolvencyPanelLabels } from './solvency-panel';
import type { SolvencyMetrics } from '@/lib/solvency';

const metrics: SolvencyMetrics = {
  insuranceFund: 5000000n,
  insuranceShareBps: 1250n,
  badDebt: 4000000n,
  totalSupply: 400000000n,
  coverageRatio: 1.25,
  coverageLabel: '125.00%',
  insuranceFundDisplay: '$5.000000',
  badDebtDisplay: '$4.000000',
  insuranceShareDisplay: '12.50%',
};

describe('SolvencyPanel', () => {
  it('renders a compact panel with key metrics', () => {
    render(<SolvencyPanel metrics={metrics} writeOffs={[]} compact labels={defaultSolvencyPanelLabels} />);

    expect(screen.getByText('Insurance fund')).toBeInTheDocument();
    expect(screen.getByText('Coverage')).toBeInTheDocument();
    expect(screen.getAllByText('125.00%').length).toBeGreaterThan(0);
  });

  it('renders the detailed event list and empty-state copy', () => {
    const { rerender } = render(<SolvencyPanel metrics={metrics} writeOffs={[]} detailed labels={defaultSolvencyPanelLabels} />);

    expect(screen.getByText('No write-off history')).toBeInTheDocument();

    rerender(
      <SolvencyPanel
        metrics={metrics}
        writeOffs={[
          { amount: 2000000n, insuranceUsed: 1200000n, reserveUsed: 600000n, socialized: 200000n, timestamp: '2025-01-12T00:00:00Z' },
        ]}
        detailed
        labels={defaultSolvencyPanelLabels}
      />
    );

    expect(screen.getByText('Write-off history')).toBeInTheDocument();
    expect(screen.getAllByText('Socialized').length).toBeGreaterThan(0);
  });
});
