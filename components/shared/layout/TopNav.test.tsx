import { render, screen } from '@testing-library/react';
import TopNav from './TopNav';

describe('TopNav Accessibility', () => {
  it('renders notification button with proper aria-label', () => {
    render(<TopNav />);
    
    const notificationButtons = screen.getAllByLabelText('View notifications');
    expect(notificationButtons).toHaveLength(2); // Desktop and mobile versions
    
    notificationButtons.forEach(button => {
      expect(button).toHaveAttribute('aria-label', 'View notifications');
      expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-white', 'focus:ring-opacity-50');
    });
  });

  it('renders profile button with proper aria-label', () => {
    render(<TopNav />);
    
    const profileButtons = screen.getAllByLabelText('View profile');
    expect(profileButtons).toHaveLength(2); // Desktop and mobile versions
    
    profileButtons.forEach(button => {
      expect(button).toHaveAttribute('aria-label', 'View profile');
      expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-white', 'focus:ring-opacity-50');
    });
  });

  it('renders sidebar toggle with proper accessibility attributes', () => {
    render(<TopNav />);
    
    const sidebarToggle = screen.getByLabelText('Toggle sidebar');
    expect(sidebarToggle).toBeInTheDocument();
    expect(sidebarToggle).toHaveAttribute('aria-label', 'Toggle sidebar');
  });

  it('all icon buttons have proper button roles', () => {
    render(<TopNav />);
    
    const buttons = screen.getAllByRole('button');
    // Should include: sidebar toggle, notification buttons (2), profile buttons (2), network selector, wallet address
    expect(buttons.length).toBeGreaterThanOrEqual(6);
    
    buttons.forEach(button => {
      expect(button.tagName).toBe('BUTTON');
    });
  });

  it('network selector and wallet buttons have accessible content', () => {
    render(<TopNav />);
    
    // Network selector should have accessible text content
    const networkSelector = screen.getByText('Stellar');
    expect(networkSelector).toBeInTheDocument();
    
    // Wallet address should be accessible
    const walletAddress = screen.getByText('Ga2j6...f5g3');
    expect(walletAddress).toBeInTheDocument();
  });
});
