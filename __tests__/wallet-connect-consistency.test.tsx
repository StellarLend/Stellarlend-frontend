import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/lib/config', () => ({
  __esModule: true,
  default: {
    stellar: {
      network: 'TESTNET',
    },
  },
}));

const mockConnectWallet = jest.fn();
joest.mock('@/lib/wallet/connectHandshake', () => ({
  __esModule: true,
  connectWallet: (...args: unknown[]) => mockConnectWallet(...args),
  isValidStellarAddress: (addr: string) =>
    typeof addr === 'string' && /^G[A-Z0-9]{2}[A-Z0-9]{54}$/.test(addr),
}));

joest.mock('@/lib/security/safe-redirect', () => ({
  __esModule: true,
  safeRedirectPath: (path: string) => path,
}));

jest.mock('@/lib/auth/session-boundary', () => ({
  __esModule: true,
  validateClientSessionResponse: (data: any) => data,
  assertWalletMatchesSession: () => undefined,
}));

import { WalletProvider, useWalletContext } from '@/context/WalletContext';
import { useWalletConnection } from '@/hooks/useWalletConnection';

const ContextConsumer = () => {
  const { connect, error, status } = useWalletContext();
  return (
    <div>
      <button data-testid="context-connect" onClick={() => connect()}>
        Connect via context
      </button>
      <span data-testid="context-status">{status}</span>
      {error && <span data-testid="context-error">{error}</span>}
    </div>
  );
};

const HookConsumer = () => {
  const { connect, error, status } = useWalletConnection();
  return (
    <div>
      <button data-testid="hook-connect" onClick={() => connect()}>
        Connect via hook
      </button>
      <span data-testid="hook-status">{status}</span>
      {error && <span data-testid="hook-error">{error}</span>}
    </div>
  );
};

describe('wallet connect consistency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectWallet.mockReset();
    sessionStorage.clear();
    global.fetch = jest.fn() as unknown as typeof fetch;
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });
  });

  it('rejects an invalid public key identically from both entry points', async () => {
    const invalidAddress = 'not-a-valid-stellar-address';
    mockConnectWallet.mockRejectedValue(new Error('Invalid public key'));

    render(
      <WalletProvider>
        <ContextConsumer />
        <HookConsumer />
      </WalletProvider>
    );

    fireEvent.click(screen.getByTestId('context-connect'));
    fireEvent.click(screen.getByTestId('hook-connect'));

    await waitFor(() => {
      expect(screen.getByTestId('context-status')).toHaveTextContent('error');
      expect(screen.getByTestId('hook-status')).toHaveTextContent('error');
    });

    expect(screen.getByTestId('context-error')).toHaveTextContent('Invalid public key');
    expect(screen.getByTestId('hook-error')).toHaveTextContent('Invalid public key');
    expect(mockConnectWallet).toHaveBeenCalledTimes(2);
  });
});
