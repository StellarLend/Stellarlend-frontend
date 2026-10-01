/**
 * @file WalletGate.error.test.tsx
 *
 * Issue #1445 — the wallet gate must tell the user *why* connecting failed.
 *
 * The existing `WalletGate.test.tsx` asserts the error span renders when it is
 * handed to the component as static hook state. That does not cover the flow the
 * issue actually describes: the user clicks "Connect wallet to continue", the
 * Freighter provider is missing (or the SEP-10 challenge/verify step fails), the
 * hook stores the message in `error` and re-renders — and the gate has to react
 * to that transition.
 *
 * The harness below models the real `useWalletConnection` contract (async
 * `connect()`, message stored in `error` on failure) so the assertions exercise
 * an actual failed connect rather than a pre-seeded prop.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { WalletGate } from './WalletGate';
import { useWalletConnection } from '@/hooks/useWalletConnection';

vi.mock('@/hooks/useWalletConnection', () => ({
  useWalletConnection: vi.fn(),
}));

/**
 * Mirrors how `useWalletConnection.connect()` behaves on failure: the rejection
 * is caught in the hook and its message is written to `error`, which re-renders
 * the gate with `isConnected === false`.
 */
function WalletGateWithFailingConnect({ failureMessage }: { failureMessage: string }) {
  const [error, setError] = useState<string | null>(null);

  (useWalletConnection as any).mockReturnValue({
    isConnected: false,
    isLoading: false,
    error,
    connect: () => {
      setError(failureMessage);
    },
  });

  return (
    <WalletGate>
      <div>Protected content</div>
    </WalletGate>
  );
}

describe('WalletGate — failed connection is surfaced to the user', () => {
  it('shows no error before the user attempts to connect', () => {
    render(<WalletGateWithFailingConnect failureMessage="Freighter not detected" />);

    expect(screen.queryByTestId('wallet-error')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the failure message after connect() fails', async () => {
    const user = userEvent.setup();
    render(<WalletGateWithFailingConnect failureMessage="Freighter not detected" />);

    await user.click(screen.getByRole('button', { name: /connect wallet to continue/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Freighter not detected');
    expect(screen.getByTestId('wallet-error')).toBe(alert);
  });

  it('announces the failure accessibly and links it to the connect button', async () => {
    const user = userEvent.setup();
    render(<WalletGateWithFailingConnect failureMessage="SEP-10 challenge verification failed" />);

    await user.click(screen.getByRole('button', { name: /connect wallet to continue/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('id', 'wallet-gate-error');
    expect(alert).toHaveTextContent('SEP-10 challenge verification failed');

    const button = screen.getByRole('button', { name: /connect wallet to continue/i });
    expect(button).toHaveAttribute('aria-describedby', 'wallet-gate-error');
  });

  it('keeps the protected content hidden until the wallet is connected', async () => {
    const user = userEvent.setup();
    render(<WalletGateWithFailingConnect failureMessage="Freighter not detected" />);

    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /connect wallet to continue/i }));
    await screen.findByRole('alert');

    // A failed connect must not reveal the gated content.
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
});
