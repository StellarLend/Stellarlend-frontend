import React from 'react';
import { render, screen } from '@testing-library/react';
import FastSecure from './FastSecure';

beforeAll(() => {
  class MockIntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-ignore - test env global
  global.IntersectionObserver = MockIntersectionObserver as any;
});

describe('FastSecure', () => {
  it('renders the hero image with the correct src', () => {
    render(<FastSecure />);

    const img = screen.getByRole('img', { name: /secure defi lending platform/i });
    expect(img).toHaveAttribute('src', '/images/fast-secure.svg');
  });

  it('renders all three trust features', () => {
    render(<FastSecure />);

    expect(screen.getByText('Audited Smart Contracts')).toBeInTheDocument();
    expect(screen.getByText('3-Second Settlements')).toBeInTheDocument();
    expect(screen.getByText('Non-Custodial')).toBeInTheDocument();
  });

  it('renders the security stats section', () => {
    render(<FastSecure />);

    expect(screen.getByText('$2M+')).toBeInTheDocument();
    expect(screen.getByText('Total Value Locked')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Security Incidents')).toBeInTheDocument();
  });

  it('contains a Learn About Security link', () => {
    render(<FastSecure />);

    const link = screen.getByRole('link', { name: /learn about security/i });
    expect(link).toHaveAttribute('href', '/security');
  });
});
