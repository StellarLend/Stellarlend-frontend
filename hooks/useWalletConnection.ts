import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import config from '@/lib/config';
import { safeRedirectPath } from '@/lib/security/safe-redirect';
import { connectWallet, type StellarNetwork } from '@/lib/wallet/connectHandshake';
import {
  assertWalletMatchesSession,
  validateClientSessionResponse,
} from '@/lib/auth/session-boundary';

export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type { StellarNetwork };

export const useWalletConnection = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<WalletStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const router = useRouter();

  const network: StellarNetwork =
    config.stellar.network.toUpperCase() === 'MAINNET' ||
    config.stellar.network.toUpperCase() === 'PUBLIC'
      ? 'PUBLIC'
      : 'TESTNET';

  const clearWalletIdentity = useCallback(() => {
    setAddress(null);
    sessionStorage.removeItem('walletAddress');
  }, []);

  const clearWalletState = useCallback(() => {
    clearWalletIdentity();
    setStatus('disconnected');
  }, [clearWalletIdentity]);

  // Rehydrate state on mount
  useEffect(() => {
    const rehydrate = async () => {
      // Treat storage as a candidate only. The server session must confirm it
      // before sensitive UI/actions are considered connected.
      const storedAddress = sessionStorage.getItem('walletAddress');

      // Fetch session from server to verify/sync.
      try {
        const response = await fetch('/api/auth/session');
        if (response.ok) {
          const data = await response.json();
          const session = validateClientSessionResponse(data, network);
          assertWalletMatchesSession(storedAddress, session.walletAddress);

          setAddress(session.walletAddress);
          setStatus('connected');
          sessionStorage.setItem('walletAddress', session.walletAddress);
        } else {
          clearWalletState();
        }
      } catch (err) {
        console.error('Failed to fetch session during rehydration:', err);
        clearWalletState();
      } finally {
        setIsInitializing(false);
      }
    };

    rehydrate();
  }, [clearWalletState, network]);

  const connect = useCallback(async () => {
    if (status === 'connecting') return;
    setStatus('connecting');
    setError(null);

    try {
      const verifiedAddress = await connectWallet(network);
      setAddress(verifiedAddress);
      setStatus('connected');
      sessionStorage.setItem('walletAddress', verifiedAddress);

      const returnUrl = new URL(window.location.href).searchParams.get('returnUrl');
      if (returnUrl) {
        router.push(safeRedirectPath(returnUrl));
      }
    } catch (err: any) {
      console.error('Wallet connection failed:', err);
      setError(err.message || 'Wallet connection failed');
      setStatus('error');
      clearWalletIdentity();
    }
  }, [status, network, router, clearWalletIdentity]);

  const disconnect = useCallback(async () => {
    setError(null);
    try {
      await fetch('/api/auth/session', {
        method: 'DELETE',
      });
    } catch (err: any) {
      console.error('Logout failed during disconnect:', err);
    } finally {
      // Always clear local state on disconnect to ensure the user is logged out locally
      clearWalletState();
    }

    const returnUrl = new URL(window.location.href).searchParams.get('returnUrl');
    if (returnUrl) {
      router.push(safeRedirectPath(returnUrl));
    }
  }, [clearWalletState, router]);

  return {
    address,
    walletAddress: address,
    network,
    status,
    error,
    isConnected: status === 'connected',
    isLoading: isInitializing || status === 'connecting',
    connect,
    disconnect,
  };
};
