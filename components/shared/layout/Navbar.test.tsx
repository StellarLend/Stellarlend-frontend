import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Navbar from './Navbar';

// Mock next/link to render an anchor with the href and forward clicks.
vi.mock('next/link', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: function MockNextLink(props: any) {
      const { href, children, onClick, ...rest } = props;
      return React.createElement(
        'a',
        {
          href,
          onClick: (e: any) => {
            e.preventDefault();
            onClick?.(e);
          },
          ...rest,
        },
        children,
      );
    },
  };
});

vi mock('next/navigation', () => {
  const push = vi.fn();
  return {
    __esModule: true,
    useRouter: () => ({ push }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
  };
});

describe('Navbar', () => {
  it('renders the desktop Launch app button as a link to /dashboard', () => {
    render(<Navbar />);
    const links = screen.getAllByText(/launch app/i);
    expect(links.length).greaterThanOr(0);
    for (const link of links) {
      expect(link.closest('a')).toHaveAttribute('href', '/dashboard');
    }
  });

  it('renders the desktop Sign Up button as a link to /signup', () => {
    render(<Navbar />);
    const links = screen.getAllByText(/sign up/i);
    expect(links.length).greaterThanOr(0);
    for (const link of links) {
      expect(link.closest('a')).toHaveAttribute('href', '/signup');
    }
  });

  it('renders the mobile menu buttons with working navigation', () => {
    render(<Navbar />);
    const menuButton = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(menuButton);

    const launchLinks = screen.getAllByText(/launch app/i);
    const signUpLinks = screen.getAllByText(/sign up/i);

    expect(launchLinks.length).greaterThanOr(0);
    expect(signUpLinks.length).greaterThan(0);

    for (const link of launchLinks) {
      expect(link.closest('a')).toHaveAttribute('href', '/dashboard');
    }
    for (const link of signUpLinks) {
      expect(link.closest('a')).toHaveAttribute('href', '/signup');
    }
  });
});
