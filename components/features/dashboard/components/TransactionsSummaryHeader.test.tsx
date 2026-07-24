import { render, screen } from '@testing-library/react';
import { TransactionsSummaryHeader } from './TransactionsSummaryHeader';
import { describe, it, expect } from 'vitest';

describe('TransactionsSummaryHeader', () => {
  it('renders loading state correctly', () => {
    render(<TransactionsSummaryHeader inflow={0} outflow={0} net={0} isLoading={true} />);
    expect(screen.getByText('Loading summary...')).toBeInTheDocument();
  });

  it('renders totals correctly', () => {
    render(<TransactionsSummaryHeader inflow={1000} outflow={500} net={500} isLoading={false} />);
    
    // Check inflow
    expect(screen.getByText('Total Inflow')).toBeInTheDocument();
    expect(screen.getByText('1,000.00')).toBeInTheDocument();
    
    // Check outflow
    expect(screen.getByText('Total Outflow')).toBeInTheDocument();
    expect(screen.getByText('500.00')).toBeInTheDocument();
    
    // Check net
    expect(screen.getByText('Net')).toBeInTheDocument();
    expect(screen.getByText('500.00')).toBeInTheDocument();
  });
  
  it('renders negative net correctly', () => {
    render(<TransactionsSummaryHeader inflow={500} outflow={1000} net={-500} isLoading={false} />);
    
    const netValue = screen.getByText('-500.00');
    expect(netValue).toBeInTheDocument();
    expect(netValue.classList.contains('text-red-600')).toBe(true);
  });
});
