import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import config from '@/lib/config';
import { safeRedirectPath } from '@/lib/security/safe-redirect';
import { connectWallet, type StellarNetwork } from '@/lib/wallet/connectHandshake';

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

  // Rehydrate state on mount
  useEffect(() => {
    const rehydrate = async () => {
      // 1. Read from sessionStorage first for immediate hydration
      const storedAddress = sessionStorage.getItem('walletAddress');
      if (storedAddress) {
        setAddress(storedAddress);
        setStatus('connected');
      }

      // 2. Fetch session from server to verify/sync
      try {
        const response = await fetch('/api/auth/session');
        if (response.ok) {
          const data = await response.json();
          const sessionAddress = data?.session?.user?.walletAddress;
          if (sessionAddress) {
            setAddress(sessionAddress);
            setStatus('connected');
            sessionStorage.setItem('walletAddress', sessionAddress);
          } else {
            // Server has no session, clear client state
            setAddress(null);
            setStatus('disconnected');
            sessionStorage.removeItem('walletAddress');
          }
        } else {
          // If session request fails (e.g., unauthorized), clear state
          setAddress(null);
          setStatus('disconnected');
          sessionStorage.removeItem('walletAddress');
        }
      } catch (err) {
        console.error('Failed to fetch session during rehydration:', err);
      } finally {
        setIsInitializing(false);
      }
    };

    rehydrate();
  }, []);

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
      setAddress(null);
      sessionStorage.removeItem('walletAddress');
    }
  }, [status, network, router]);

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
      setAddress(null);
      setStatus('disconnected');
      sessionStorage.removeItem('walletAddress');
    }

    const returnUrl = new URL(window.location.href).searchParams.get('returnUrl');
    if (returnUrl) {
      router.push(safeRedirectPath(returnUrl));
    }
  }, [router]);

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
