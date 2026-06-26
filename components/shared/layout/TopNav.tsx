"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import SearchBar from "@/components/molecules/SearchBar";
import { useSidebar } from "@/context/SidebarContext";
import { Menu } from "lucide-react";

declare global {
  interface Window {
    stellar?: {
      getPublicKey: () => Promise<string>;
      signTransaction: (xdr: string, opts?: { network: string }) => Promise<string>;
    };
  }
}

/** Shared focus-visible classes for TopNav interactive elements */
const focusClasses = "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2 focus-visible:ring-offset-green-600";

export const SidebarToggle = () => {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 ${focusClasses}`}
      aria-label="Toggle sidebar"
    >
      <Menu className="h-6 w-6" aria-hidden="true" />
    </button>
  );
};

const TopNav = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/session");
        if (response.ok) {
          const data = await response.json();
          if (data?.session?.user?.walletAddress) {
            setWalletAddress(data.session.user.walletAddress);
          }
        }
      } catch (err) {
        console.error("Failed to fetch session:", err);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const stellar = window.stellar;
      if (!stellar) {
        throw new Error("Stellar wallet provider (Freighter) not detected");
      }

      // 1. Get client public key
      const pubKey = await stellar.getPublicKey();
      if (!pubKey) {
        throw new Error("No public key returned from wallet");
      }

      // 2. Fetch SEP-10 challenge transaction
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

      // 3. Sign transaction
      const signedTransaction = await stellar.signTransaction(transaction, {
        network: "TESTNET",
      });

      // 4. Verify transaction signature and establish session
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
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/session", {
        method: "DELETE",
      });
      if (response.ok) {
        setWalletAddress(null);
        setIsDropdownOpen(false);
      } else {
        throw new Error("Failed to clear session");
      }
    } catch (err: any) {
      console.error("Logout failed:", err);
      setError(err.message || "Failed to disconnect");
    } finally {
      setLoading(false);
    }
  };

  const getShortAddress = (addr: string) => {
    return `${addr.slice(0, 5)}...${addr.slice(-4)}`;
  };

  return (
    <div className="w-full flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between bg-green-600 px-6 md:px-12 py-4 rounded-md gap-4 sm:gap-0">
      {/* Search Bar */}
      <div className="w-full sm:flex-1 max-w-full sm:max-w-md text-white">
        <SearchBar placeholder="Search for token, asset, wallet address" />
      </div>

      {/* Desktop Controls */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex gap-4 items-center">
          {/* Network Selector */}
          <button
            type="button"
            aria-label="Select network"
            className={`flex cursor-pointer hover:bg-white/30 items-center text-white text-sm justify-between border py-2 px-4 w-[139px] rounded-full ${focusClasses}`}
          >
            <Image src="/icons/stellar.png" alt="Stellar network" width={22} height={22} />
            <span>Stellar</span>
            <svg className="w-3 h-3 text-white" viewBox="0 0 10 6" fill="none" aria-hidden="true">
              <path d="M5 6.0006L0.757324 1.758L2.17154 0.34375L5 3.1722L7.8284 0.34375L9.2426 1.758L5 6.0006Z" fill="#FFFFFF" />
            </svg>
          </button>

          {/* Wallet Address Button or Connect Button */}
          <div className="relative flex items-center">
            {walletAddress ? (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Connected wallet"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`flex cursor-pointer hover:bg-white/30 items-center text-white text-sm justify-between border py-2 px-4 w-[139px] rounded-full ${focusClasses}`}
                >
                  <span>{getShortAddress(walletAddress)}</span>
                  <svg className="w-3 h-3 text-white" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                    <path d="M5 6.0006L0.757324 1.758L2.17154 0.34375L5 3.1722L7.8284 0.34375L9.2426 1.758L5 6.0006Z" fill="#FFFFFF" />
                  </svg>
                </button>
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100 text-red-600 font-medium"
                    >
                      Disconnect Wallet
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                aria-label="Connect wallet"
                onClick={handleConnect}
                disabled={loading && walletAddress === null}
                className={`flex cursor-pointer hover:bg-white/30 items-center text-white text-sm justify-center border py-2 px-4 w-[139px] rounded-full ${focusClasses} ${loading ? 'opacity-80' : ''}`}
              >
                <span>{loading ? "Connecting..." : "Connect Wallet"}</span>
              </button>
            )}
            {error && (
              <span data-testid="wallet-error" className="text-xs text-red-200 absolute -bottom-5 right-0 whitespace-nowrap bg-red-800/80 px-2 py-0.5 rounded">
                {error}
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="h-8 border-l" style={{ borderColor: "#71B48D" }} aria-hidden="true" />

          <div className="flex gap-4 items-center">
            {/* Notification */}
            <button
              type="button"
              className={`p-2 rounded-md hover:bg-white/30 transition-colors ${focusClasses}`}
              aria-label="View notifications"
            >
              <Image src="/icons/notification.png" alt="" width={24} height={24} />
            </button>

            {/* Profile Avatar */}
            <button
              type="button"
              className={`rounded-full hover:ring-2 hover:ring-white/50 transition-all ${focusClasses}`}
              aria-label="View profile"
            >
              <Image src="/images/profile.jpg" alt="User profile" className="rounded-full" width={32} height={32} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden flex justify-between w-full items-center">
        <div className="flex items-center gap-2">
          <SidebarToggle />
          <h1 className="text-white md:text-[24px] text-xl font-bold">Dashboard</h1>
        </div>

        <div className="flex gap-4 items-center">
          {/* Notification */}
          <button
            type="button"
            className={`p-2 rounded-md hover:bg-white/30 transition-colors ${focusClasses}`}
            aria-label="View notifications"
          >
            <Image src="/icons/notification.png" alt="" width={24} height={24} />
          </button>

          {/* Profile Avatar */}
          <button
            type="button"
            className={`rounded-full hover:ring-2 hover:ring-white/50 transition-all ${focusClasses}`}
            aria-label="View profile"
          >
            <Image src="/images/profile.jpg" alt="User profile" className="rounded-full" width={32} height={32} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopNav;
