import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('renders error message when wallet connection fails', () => {
    const connectMock = vi.fn();
    (useWalletConnection as any).mockReturnValue({
      isConnected: false,
      isLoading: false,
      connect: connectMock,
      error: 'Freighter not detected',
    });

    render(
      <WalletGate>
        <div>Content</div>
      </WalletGate>
    );

    expect(screen.getByTestId('wallet-error')).toHaveTextContent('Freighter not detected');
  });

  it('disables the connect button while isLoading is true', () => {
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
    const connectButton = screen.getByRole('button', { name: /Connect wallet to continue/i });
    expect(connectButton).toBeDisabled();
  });

  it('user cannot trigger connect when loading', async () => {
    const connectMock = vi.fn();
    (useWalletConnection as any).mockReturnValue({
      isConnected: false,
      isLoading: true,
      connect: connectMock,
    });

    render(
      <WalletGate>
        <div>Content</div>
      </WalletGate>
    );

    const connectButton = screen.getByRole('button', { name: /Connect wallet to continue/i });
    await userEvent.click(connectButton);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('rapid double-click results in only one connect attempt', async () => {
    const connectMock = vi.fn();
    (useWalletConnection as any).mockReturnValue({
      isConnected: false,
      isLoading: false,
      connect: connectMock,
    });

    render(
      <WalletGate>
        <div>Content</div>
      </WalletGate>
    );

    const connectButton = screen.getByRole('button', { name: /Connect wallet to continue/i });
    await userEvent.dblClick(connectButton);
    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it('existing non-loading behavior still works', async () => {
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

    const connectButton = screen.getByRole('button', { name: 'Connect me' });
    expect(connectButton).toBeEnabled();
    await userEvent.click(connectButton);
    expect(connectMock).toHaveBeenCalled();
  });
});