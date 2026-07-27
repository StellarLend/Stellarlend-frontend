import React from 'react';
import { render, screen } from '@testing-library/react';
import SecurityPage from './page';

vi.mock('@/components/shared/layout/TopNav', () => {
  const MockHeader = () => <header data-testid="mock-header" />;
  MockHeader.displayName = 'MockHeader';
  return { default: MockHeader };
});

vi.mock('@/components/marketing/Footer', () => {
  const MockFooter = () => <footer data-testid="mock-footer" />;
  MockFooter.displayName = 'MockFooter';
  return { default: MockFooter };
});

describe('SecurityPage', () => {
  it('renders the Security page heading', () => {
    render(<SecurityPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Security' }),
    ).toBeInTheDocument();
  });

  it('documents the audited, non-custodial security posture referenced elsewhere in the app', () => {
    render(<SecurityPage />);

    expect(screen.getByText(/audited smart contracts/i)).toBeInTheDocument();
    expect(screen.getByText(/non-custodial/i)).toBeInTheDocument();
  });

  it('provides a way to report a vulnerability', () => {
    render(<SecurityPage />);

    const reportLink = screen.getByRole('link', { name: /contact@stellarlend\.com/i });
    expect(reportLink).toHaveAttribute('href', 'mailto:contact@stellarlend.com');
  });

  it('renders the shared header and footer', () => {
    render(<SecurityPage />);

    expect(screen.getByTestId('mock-header')).toBeInTheDocument();
    expect(screen.getByTestId('mock-footer')).toBeInTheDocument();
  });
});
