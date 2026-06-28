import { useState, useEffect } from 'react';

export const useWalletConnection = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkSession = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/session');
      if (response.ok) {
        const data = await response.json();
        if (data?.session?.user?.walletAddress) {
          setWalletAddress(data.session.user.walletAddress);
        } else {
          setWalletAddress(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const connect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const stellar = window.stellar;
      if (!stellar) {
        throw new Error("Stellar wallet provider (Freighter) not detected");
      }

      const pubKey = await stellar.getPublicKey();
      if (!pubKey) {
        throw new Error("No public key returned from wallet");
      }

      const challengeResponse = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: pubKey }),
      });

      if (!challengeResponse.ok) {
        const errData = await challengeResponse.json();
        throw new Error(errData.error || "Failed to generate challenge");
      }

      const { transaction } = await challengeResponse.json();
      const signedTransaction = await stellar.signTransaction(transaction, {
        network: "TESTNET",
      });

      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction: signedTransaction }),
      });

      if (!verifyResponse.ok) {
        const errData = await verifyResponse.json();
        throw new Error(errData.error || "Verification failed");
      }

      const { walletAddress: verifiedAddress } = await verifyResponse.json();
      setWalletAddress(verifiedAddress);
    } catch (err: any) {
      console.error("Wallet connection failed:", err);
      setError(err.message || "Wallet connection failed");
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/session", {
        method: "DELETE",
      });
      if (response.ok) {
        setWalletAddress(null);
      } else {
        throw new Error("Failed to clear session");
      }
    } catch (err: any) {
      console.error("Logout failed:", err);
      setError(err.message || "Failed to disconnect");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    walletAddress,
    isConnected: !!walletAddress,
    isLoading,
    error,
    connect,
    disconnect,
  };
};
