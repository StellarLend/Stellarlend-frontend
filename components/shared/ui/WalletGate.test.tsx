import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WalletGate } from './WalletGate';
import { useWalletConnection } from '@/hooks/useWalletConnection';

vi.mock('@/hooks/useWalletConnection', () => ({
  useWalletConnection: vi.fn(),
}));

describe('WalletGate', () => {
  it('renders children when wallet is connected', () => {
    (useWalletConnection as any).mockReturnValue({
      isConnected: true,
      isLoading: false,
      connect: vi.fn(),
    });

    render(
      <WalletGate>
        <div>Content</div>
      </WalletGate>
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders fallback connect button when wallet is not connected', () => {
    const connectMock = vi.fn();
    (useWalletConnection as any).mockReturnValue({
      isConnected: false,
      isLoading: false,
      connect: connectMock,
    });

    render(
      <WalletGate fallbackText="Connect me">
        <div>Content</div>
      </WalletGate>
    );
    
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
    const connectButton = screen.getByRole('button', { name: 'Connect me' });
    fireEvent.click(connectButton);
    expect(connectMock).toHaveBeenCalled();
  });

  it('renders loading state', () => {
    (useWalletConnection as any).mockReturnValue({
      isConnected: false,
      isLoading: true,
      connect: vi.fn(),
    });

    render(
      <WalletGate>
        <div>Content</div>
      </WalletGate>
    );
    
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
    // Check for pulse animation class or something that indicates loading
    expect(screen.getByRole('button', { name: /Connect/i })).not.toBeInTheDocument();
  });
});
